"""
Standalone RAG Ingestion Script
Run from project root: python ingest.py
"""
import os
import sys
import re
import hashlib
from pathlib import Path
from typing import List, Dict

import numpy as np
from pymongo import MongoClient
from sentence_transformers import SentenceTransformer
import fitz  # PyMuPDF

# Config
MONGO_URI = os.environ.get(
    "MONGO_URI",
    "mongodb+srv://mepavaniitkgp_db_user:OkeDvLvXNdK2Xr2y@urjasetu.2f5foqc.mongodb.net/?retryWrites=true&w=majority&appName=urjasetu"
)
MONGO_DB = os.environ.get("MONGO_DB_NAME", "urjasetu_database")
CHUNK_SIZE = 400
CHUNK_OVERLAP = 50
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

PROJECT_ROOT = Path(__file__).parent
PAPERS_DIR = PROJECT_ROOT / "documented pdfs for RAG"
TARIFF_DIR = PROJECT_ROOT / "tariff data for RAG"

client = MongoClient(MONGO_URI)
db = client[MONGO_DB]
chunks_col = db["urjasetu_collection"]
docs_col = db["documents"]

embedder = None


def get_embedder():
    global embedder
    if embedder is None:
        print("Loading embedding model (all-MiniLM-L6-v2)...")
        embedder = SentenceTransformer(EMBEDDING_MODEL)
        print("Embedding model loaded.")
    return embedder


def extract_text_from_pdf(pdf_path: str) -> List[Dict]:
    try:
        doc = fitz.open(pdf_path)
        pages = []
        for page_num, page in enumerate(doc):
            text = page.get_text()
            if text.strip():
                pages.append({"page": page_num + 1, "text": text.strip()})
        doc.close()
        return pages
    except Exception as e:
        print(f"  Error extracting {pdf_path}: {e}")
        return []


def chunk_text(text: str, source_file: str, section: str = None, doc_type: str = "paper") -> List[Dict]:
    chunks = []
    paragraphs = re.split(r'\n\s*\n', text)
    current_chunk = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        if len(current_chunk) + len(para) > CHUNK_SIZE * 4:
            if current_chunk.strip():
                chunks.append({
                    "text": current_chunk.strip(),
                    "source_file": source_file,
                    "section": section,
                    "doc_type": doc_type,
                })
            overlap_text = current_chunk[-(CHUNK_OVERLAP * 4):] if len(current_chunk) > CHUNK_OVERLAP * 4 else ""
            current_chunk = overlap_text + "\n\n" + para
        else:
            current_chunk += "\n\n" + para if current_chunk else para

    if current_chunk.strip():
        chunks.append({
            "text": current_chunk.strip(),
            "source_file": source_file,
            "section": section,
            "doc_type": doc_type,
        })
    return chunks


def detect_section(text: str) -> str:
    lines = text.split('\n')
    for line in lines[:3]:
        line = line.strip()
        if re.match(r'^(?:\d+\.?\d*\.?\s+|Section\s+|CHAPTER\s+)', line, re.IGNORECASE):
            return line[:100]
        if re.match(r'^[A-Z][A-Z\s]{5,}$', line):
            return line[:100]
    return None


def ingest_pdf(pdf_path: Path, doc_type: str = "paper"):
    print(f"\nProcessing: {pdf_path.name}")

    existing = docs_col.find_one({"filename": pdf_path.name})
    if existing:
        print(f"  Already ingested, skipping.")
        return 0

    pages = extract_text_from_pdf(str(pdf_path))
    if not pages:
        print(f"  No text extracted, skipping.")
        return 0

    all_chunks = []
    for page_data in pages:
        text = page_data["text"]
        section = detect_section(text)
        chunks = chunk_text(text, pdf_path.name, section, doc_type)
        for chunk in chunks:
            chunk["page"] = page_data["page"]
            all_chunks.append(chunk)

    if not all_chunks:
        print(f"  No chunks generated, skipping.")
        return 0

    print(f"  Embedding {len(all_chunks)} chunks...")
    model = get_embedder()
    texts = [c["text"] for c in all_chunks]
    embeddings = model.encode(texts, show_progress_bar=False)

    for chunk, embedding in zip(all_chunks, embeddings):
        chunk["embedding"] = embedding.tolist()
        chunks_col.insert_one(chunk)

    docs_col.insert_one({
        "filename": pdf_path.name,
        "doc_type": doc_type,
        "chunk_count": len(all_chunks),
        "license": "open_access",
        "access_basis": "open_access",
    })

    print(f"  Ingested {len(all_chunks)} chunks.")
    return len(all_chunks)


def main():
    print("=" * 60)
    print("Urjasetu RAG Document Ingestion Pipeline")
    print("=" * 60)

    total_chunks = 0

    # Ingest papers
    if PAPERS_DIR.exists():
        pdfs = list(PAPERS_DIR.glob("*.pdf"))
        print(f"\nFound {len(pdfs)} PDFs in 'documented pdfs for RAG/'")
        for pdf in pdfs:
            count = ingest_pdf(pdf, doc_type="paper")
            total_chunks += count
    else:
        print(f"\nWARNING: {PAPERS_DIR} does not exist!")

    # Ingest tariff documents
    if TARIFF_DIR.exists():
        tariff_pdfs = list(TARIFF_DIR.glob("*.pdf"))
        if tariff_pdfs:
            print(f"\nFound {len(tariff_pdfs)} PDFs in 'tariff data for RAG/'")
            for pdf in tariff_pdfs:
                count = ingest_pdf(pdf, doc_type="tariff")
                total_chunks += count
        else:
            print(f"\nNo PDFs found in 'tariff data for RAG/'")
    else:
        print(f"\nWARNING: {TARIFF_DIR} does not exist!")

    # Summary
    total_in_db = chunks_col.count_documents({})
    total_docs = docs_col.count_documents({})
    print(f"\n{'=' * 60}")
    print(f"DONE! {total_docs} documents, {total_in_db} total chunks in MongoDB.")
    print(f"This run ingested {total_chunks} new chunks.")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
