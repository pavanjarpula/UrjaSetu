"""
Fetch open-access documents and ingest into MongoDB with embeddings.
Run this script to populate the RAG corpus.
"""

import os
import sys
import requests
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from ingest_documents import ingest_pdf, client, db, chunks_col, docs_col

# ──────────────────────────────────────────────
# Open-access documents to fetch
# ──────────────────────────────────────────────
DOCUMENTS_TO_FETCH = [
    # Solar PV forecasting
    {
        "url": "https://arxiv.org/pdf/2508.15508",
        "filename": "pv_ensemble_forecast_postprocessing.pdf",
        "doc_type": "paper",
        "title": "Post-processing of ensemble PV power forecasts with quantile regression",
        "license": "arXiv open access",
    },
    {
        "url": "https://arxiv.org/pdf/2304.11732",
        "filename": "qxgboost_quantile_regression.pdf",
        "doc_type": "paper",
        "title": "Quantile Extreme Gradient Boosting for uncertainty estimation",
        "license": "arXiv open access",
    },
    # Ice TES
    {
        "url": "https://arxiv.org/pdf/2509.13371",
        "filename": "ice_tes_optimal_control.pdf",
        "doc_type": "paper",
        "title": "Day-ahead cooling load prediction and optimal control for ice TES",
        "license": "arXiv open access",
    },
    {
        "url": "https://arxiv.org/pdf/2410.19830",
        "filename": "tes_peak_shaving_district_energy.pdf",
        "doc_type": "paper",
        "title": "Peak shaving using thermal energy storage in CHP and district energy",
        "license": "arXiv CC-BY-NC-ND 4.0",
    },
    # NREL reports (public domain)
    {
        "url": "https://www.energy.gov/sites/default/files/2023-07/bto-peer-32256-ices-nrel-woods.pdf",
        "filename": "nrel_ice_storage_decarbonization.pdf",
        "doc_type": "reference",
        "title": "Ice Storage for Efficient and Flexible Decarbonization (NREL)",
        "license": "US Government - Public Domain",
    },
    {
        "url": "https://docs.nlr.gov/docs/fy23osti/83649.pdf",
        "filename": "nrel_campus_chilled_water_storage.pdf",
        "doc_type": "reference",
        "title": "NREL Campus Chilled Water Storage Potential Case Study",
        "license": "US Government - Public Domain",
    },
]


def fetch_document(doc_info: dict, download_dir: Path) -> Path | None:
    """Download a PDF from URL."""
    filepath = download_dir / doc_info["filename"]

    # Skip if already downloaded
    if filepath.exists():
        print(f"  Already exists: {doc_info['filename']}")
        return filepath

    try:
        print(f"  Downloading: {doc_info['filename']}...")
        resp = requests.get(doc_info["url"], timeout=60, allow_redirects=True)
        resp.raise_for_status()

        # Verify it's a PDF
        if resp.content[:4] != b'%PDF':
            print(f"  Warning: Not a valid PDF, skipping: {doc_info['filename']}")
            return None

        filepath.write_bytes(resp.content)
        print(f"  Downloaded: {doc_info['filename']} ({len(resp.content) // 1024} KB)")
        return filepath
    except Exception as e:
        print(f"  Error downloading {doc_info['filename']}: {e}")
        return None


def main():
    print("=" * 60)
    print("Document Fetching & Ingestion Pipeline")
    print("=" * 60)

    # Create download directory
    download_dir = Path(__file__).parent.parent / "fetched_documents"
    download_dir.mkdir(exist_ok=True)

    # Step 1: Fetch open-access documents
    print("\n[1/3] Fetching open-access documents...")
    for doc in DOCUMENTS_TO_FETCH:
        fetch_document(doc, download_dir)

    # Step 2: Ingest local papers
    print("\n[2/3] Ingesting local papers...")
    papers_dir = Path(__file__).parent.parent / "documented pdfs for RAG"
    if papers_dir.exists():
        for pdf in papers_dir.glob("*.pdf"):
            ingest_pdf(pdf, doc_type="paper")

    # Step 3: Ingest local tariff documents
    print("\n[3/3] Ingesting tariff documents...")
    tariff_dir = Path(__file__).parent.parent / "tariff data for RAG"
    if tariff_dir.exists():
        for pdf in tariff_dir.glob("*.pdf"):
            ingest_pdf(pdf, doc_type="tariff")

    # Step 4: Ingest fetched documents
    print("\n[4/4] Ingesting fetched documents...")
    for doc in DOCUMENTS_TO_FETCH:
        filepath = download_dir / doc["filename"]
        if filepath.exists():
            ingest_pdf(filepath, doc_type=doc["doc_type"])

    # Summary
    total_chunks = chunks_col.count_documents({})
    total_docs = docs_col.count_documents({})
    print(f"\n{'=' * 60}")
    print(f"COMPLETE: {total_docs} documents, {total_chunks} chunks")
    print(f"Vector search collection: urjasetu_collection")
    print(f"Database: urjasetu_database")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
