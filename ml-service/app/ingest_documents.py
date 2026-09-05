"""
RAG Document Ingestion Pipeline
Chunks PDFs, embeds with sentence-transformers, writes to MongoDB.
"""

import os
import re
import json
import hashlib
from pathlib import Path
from typing import List, Dict

import numpy as np
from pymongo import MongoClient
from sentence_transformers import SentenceTransformer

# Config
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.environ.get("MONGO_DB_NAME", "urjasetu_database")
CHUNK_SIZE = 400  # tokens (approx chars/4)
CHUNK_OVERLAP = 50
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# Directories — both are at the project root (2 levels up from ml-service/app/)
PROJECT_ROOT = Path(__file__).parent.parent.parent
PAPERS_DIR = PROJECT_ROOT / "documented pdfs for RAG"
TARIFF_DIR = PROJECT_ROOT / "tariff data for RAG"

client = MongoClient(MONGO_URI)
db = client[MONGO_DB]
chunks_col = db["urjasetu_collection"]  # Vector search collection
docs_col = db["documents"]

# Embedding model (loaded once)
embedder = None


def get_embedder():
    global embedder
    if embedder is None:
        embedder = SentenceTransformer(EMBEDDING_MODEL)
    return embedder


def extract_text_from_pdf(pdf_path: str) -> List[Dict]:
    """Extract text from PDF, split by sections where possible."""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(pdf_path)
        pages = []
        for page_num, page in enumerate(doc):
            text = page.get_text()
            if text.strip():
                pages.append({
                    "page": page_num + 1,
                    "text": text.strip(),
                })
        doc.close()
        return pages
    except ImportError:
        print("PyMuPDF not installed. Install with: pip install PyMuPDF")
        return []
    except Exception as e:
        print(f"Error extracting {pdf_path}: {e}")
        return []


def chunk_text(text: str, source_file: str, section: str = None, doc_type: str = "paper") -> List[Dict]:
    """Split text into overlapping chunks, targeting ~400 tokens."""
    chunks = []

    # Split on paragraph breaks first
    paragraphs = re.split(r'\n\s*\n', text)
    current_chunk = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        # If adding this paragraph exceeds chunk size, save current and start new
        if len(current_chunk) + len(para) > CHUNK_SIZE * 4:  # chars ≈ tokens * 4
            if current_chunk.strip():
                chunks.append({
                    "text": current_chunk.strip(),
                    "source_file": source_file,
                    "section": section,
                    "doc_type": doc_type,
                })
            # Start new chunk with overlap from end of previous
            overlap_text = current_chunk[-(CHUNK_OVERLAP * 4):] if len(current_chunk) > CHUNK_OVERLAP * 4 else ""
            current_chunk = overlap_text + "\n\n" + para
        else:
            current_chunk += "\n\n" + para if current_chunk else para

    # Don't forget the last chunk
    if current_chunk.strip():
        chunks.append({
            "text": current_chunk.strip(),
            "source_file": source_file,
            "section": section,
            "doc_type": doc_type,
        })

    return chunks


def detect_section(text: str) -> str:
    """Try to detect section heading from text."""
    lines = text.split('\n')
    for line in lines[:3]:
        line = line.strip()
        # Match common section patterns
        if re.match(r'^(?:\d+\.?\d*\.?\s+|Section\s+|CHAPTER\s+)', line, re.IGNORECASE):
            return line[:100]
        if re.match(r'^[A-Z][A-Z\s]{5,}$', line):
            return line[:100]
    return None


def extract_tables(text: str) -> List[Dict]:
    """Extract table-like content (lines with multiple numeric values)."""
    tables = []
    lines = text.split('\n')
    table_lines = []
    caption = None

    for line in lines:
        # Detect table caption
        if re.match(r'^(?:Table|TABLE)\s+\d+', line):
            caption = line.strip()
            continue

        # Detect table rows (lines with multiple numbers separated by spaces/tabs)
        if re.match(r'^[\d\s\.\-\+\|]+$', line) and len(line.split()) >= 3:
            table_lines.append(line)
        elif table_lines:
            # End of table
            if len(table_lines) >= 2:
                tables.append({
                    "caption": caption or "Table",
                    "text": "\n".join(table_lines),
                })
            table_lines = []
            caption = None

    return tables


def ingest_pdf(pdf_path: Path, doc_type: str = "paper"):
    """Ingest a single PDF file."""
    print(f"Processing: {pdf_path.name}")

    # Check if already ingested
    existing = docs_col.find_one({"filename": pdf_path.name})
    if existing:
        print(f"  Already ingested, skipping.")
        return

    pages = extract_text_from_pdf(str(pdf_path))
    if not pages:
        print(f"  No text extracted, skipping.")
        return

    all_chunks = []

    for page_data in pages:
        text = page_data["text"]
        section = detect_section(text)

        # Extract tables as separate chunks
        tables = extract_tables(text)
        for table in tables:
            all_chunks.append({
                "text": f"{table['caption']}\n\n{table['text']}",
                "source_file": pdf_path.name,
                "section": table["caption"],
                "doc_type": doc_type,
                "page": page_data["page"],
            })

        # Chunk remaining text
        chunks = chunk_text(text, pdf_path.name, section, doc_type)
        for chunk in chunks:
            chunk["page"] = page_data["page"]
            all_chunks.append(chunk)

    if not all_chunks:
        print(f"  No chunks generated, skipping.")
        return

    # Embed all chunks
    print(f"  Embedding {len(all_chunks)} chunks...")
    model = get_embedder()
    texts = [c["text"] for c in all_chunks]
    embeddings = model.encode(texts, show_progress_bar=False)

    # Write to MongoDB
    for chunk, embedding in zip(all_chunks, embeddings):
        chunk["embedding"] = embedding.tolist()
        chunks_col.insert_one(chunk)

    # Record document
    docs_col.insert_one({
        "filename": pdf_path.name,
        "doc_type": doc_type,
        "chunk_count": len(all_chunks),
        "license": "open_access",
        "access_basis": "open_access",
    })

    print(f"  Ingested {len(all_chunks)} chunks.")


def ingest_tariff_pdf(pdf_path: Path):
    """Ingest a tariff/reference PDF."""
    ingest_pdf(pdf_path, doc_type="tariff")


def main():
    """Main ingestion pipeline."""
    print("=" * 60)
    print("RAG Document Ingestion Pipeline")
    print("=" * 60)

    # Ingest papers
    if PAPERS_DIR.exists():
        print(f"\nIngesting papers from {PAPERS_DIR}...")
        for pdf in PAPERS_DIR.glob("*.pdf"):
            ingest_pdf(pdf, doc_type="paper")

    # Ingest tariff documents
    if TARIFF_DIR.exists():
        print(f"\nIngesting tariff docs from {TARIFF_DIR}...")
        for pdf in TARIFF_DIR.glob("*.pdf"):
            ingest_tariff_pdf(pdf)

    # Print summary
    total_chunks = chunks_col.count_documents({})
    total_docs = docs_col.count_documents({})
    print(f"\n{'=' * 60}")
    print(f"Done! {total_docs} documents, {total_chunks} chunks ingested.")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
