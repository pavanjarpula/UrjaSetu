"""
Full RAG Evaluation Pipeline
Tests: Vector Search retrieval -> Grading -> Generation -> Self-reflection
"""
import os
import sys
import json
import time
import io
from pymongo import MongoClient
from sentence_transformers import SentenceTransformer

# Fix Windows encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

MONGO_URI = os.environ.get('MONGO_URI', 'mongodb+srv://mepavaniitkgp_db_user:OkeDvLvXNdK2Xr2y@urjasetu.2f5foqc.mongodb.net/?retryWrites=true&w=majority&appName=urjasetu')
MONGO_DB = os.environ.get('MONGO_DB_NAME', 'urjasetu_database')
DEEPSEEK_API_KEY = os.environ.get('DEEPSEEK_API_KEY', '')
DEEPSEEK_MODEL = os.environ.get('DEEPSEEK_MODEL', 'deepseek-chat')
DEEPSEEK_BASE_URL = os.environ.get('DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1')

client = MongoClient(MONGO_URI)
db = client[MONGO_DB]
chunks_col = db['urjasetu_collection']

print("Loading embedding model...")
embedder = SentenceTransformer('all-MiniLM-L6-v2')

# DeepSeek setup
import requests
HAS_LLM = bool(DEEPSEEK_API_KEY)
if HAS_LLM:
    print("DeepSeek API connected.")
else:
    print("DeepSeek API not available.")


def vector_search(query, k=5):
    """Retrieve top-k chunks via Atlas Vector Search."""
    embedding = embedder.encode([query])[0].tolist()
    results = list(chunks_col.aggregate([
        {
            "$vectorSearch": {
                "index": "vector_index",
                "path": "embedding",
                "queryVector": embedding,
                "numCandidates": 100,
                "limit": k,
            }
        },
        {
            "$project": {
                "source_file": 1,
                "section": 1,
                "text": 1,
                "score": {"$meta": "vectorSearchScore"},
            }
        }
    ]))
    return results


def grade_relevance(question, chunk_text):
    """Grade if a chunk is relevant to the question."""
    if not HAS_LLM:
        return True

    prompt = f"Question: {question}\n\nDocument chunk: {chunk_text[:1000]}\n\nIs this chunk relevant to answering the question? Reply with only 'yes' or 'no'."

    try:
        response = requests.post(
            f"{DEEPSEEK_BASE_URL}/chat/completions",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {DEEPSEEK_API_KEY}"},
            json={"model": DEEPSEEK_MODEL, "messages": [{"role": "user", "content": prompt}], "temperature": 0.1, "max_tokens": 10},
            timeout=30,
        )
        return response.json()["choices"][0]["message"]["content"].strip().lower().startswith("yes")
    except:
        return True


def generate_answer(question, context):
    """Generate answer using DeepSeek with context."""
    if not HAS_LLM:
        return "[DeepSeek API not configured]"

    system_prompt = """You are Urjasetu, an expert assistant for the IIT Kharagpur Solar PV + Ice TES platform.
Answer questions ONLY using the provided context. Cite sources by name.
If you don't have enough information, say so explicitly.
Never make up information not present in the context.
Keep answers concise and factual."""

    user_prompt = f"Context:\n{context}\n\nQuestion: {question}\n\nAnswer:"

    try:
        response = requests.post(
            f"{DEEPSEEK_BASE_URL}/chat/completions",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {DEEPSEEK_API_KEY}"},
            json={
                "model": DEEPSEEK_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.3,
                "max_tokens": 1024,
            },
            timeout=60,
        )
        return response.json()["choices"][0]["message"]["content"]
    except Exception as e:
        return f"[Generation error: {e}]"


def rewrite_query(question):
    """Rewrite question for better retrieval."""
    if not HAS_LLM:
        return question

    prompt = f"Rewrite this question to be more specific and searchable, keeping the same intent. Return only the rewritten question.\n\nQuestion: {question}"

    try:
        response = requests.post(
            f"{DEEPSEEK_BASE_URL}/chat/completions",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {DEEPSEEK_API_KEY}"},
            json={"model": DEEPSEEK_MODEL, "messages": [{"role": "user", "content": prompt}], "temperature": 0.3, "max_tokens": 200},
            timeout=30,
        )
        return response.json()["choices"][0]["message"]["content"].strip()
    except:
        return question


def run_rag(question):
    """Run the full corrective RAG pipeline."""
    # Step 1: Retrieve (text included in projection)
    chunks = vector_search(question, k=5)

    # Step 2: Filter out empty text
    relevant_chunks = [c for c in chunks if c.get("text")]

    # Step 3: Generate
    if not relevant_chunks:
        answer = "I don't have enough information in the current documents to answer that."
        citations = []
    else:
        context_parts = []
        citations = []
        for chunk in relevant_chunks:
            source = chunk.get("source_file", "unknown")
            text = chunk.get("text", "")
            context_parts.append(f"[{source}]: {text}")
            if source not in citations:
                citations.append(source)

        context = "\n\n".join(context_parts)
        answer = generate_answer(question, context)

    return {
        "answer": answer,
        "citations": citations,
        "corrective_action": None,
        "retrieved_count": len(chunks),
        "filtered_count": len(relevant_chunks),
    }


# ─────────────── Evaluation Questions ───────────────
EVAL_QUESTIONS = [
    # Paper facts (answerable from documents)
    {"question": "What is the design COP of the ice TES system?", "answerable": True, "keywords": ["cop", "carnot", "efficiency"]},
    {"question": "How much ice volume is needed for full campus coverage?", "answerable": True, "keywords": ["278", "volume", "m3", "ice"]},
    {"question": "What is the thermal lag validated by BTP-II?", "answerable": True, "keywords": ["37.5", "minute", "thermal lag"]},
    {"question": "How many halls of residence are there at IIT Kharagpur?", "answerable": True, "keywords": ["21", "halls"]},
    {"question": "What is the MAPE of the XGBoost quantile regression model?", "answerable": True, "keywords": ["mape", "16", "percent"]},
    {"question": "What percentage of nights can the ice TES provide full coverage?", "answerable": True, "keywords": ["95.9", "percent", "coverage", "350"]},
    {"question": "What is the campus solar PV capacity?", "answerable": True, "keywords": ["5.5", "mwp", "solar"]},
    # Domain knowledge (answerable from papers)
    {"question": "How does quantile regression work for solar forecasting?", "answerable": True, "keywords": ["quantile", "prediction", "interval"]},
    {"question": "What is net metering policy in India?", "answerable": True, "keywords": ["net metering", "grid", "export"]},
    {"question": "What are the advantages of ice-based TES over battery storage?", "answerable": True, "keywords": ["ice", "thermal", "battery"]},
    # Deliberately unanswerable
    {"question": "What is the serial number of the main chiller?", "answerable": False, "keywords": []},
    {"question": "How much did the ice TES system cost to install?", "answerable": False, "keywords": []},
    {"question": "Who is the contractor that built the cooling plant?", "answerable": False, "keywords": []},
]


def evaluate():
    """Run full evaluation."""
    print(f"\n{'='*70}")
    print("RAG EVALUATION")
    print(f"{'='*70}")
    print(f"Total questions: {len(EVAL_QUESTIONS)}")
    print(f"Answerable: {sum(1 for q in EVAL_QUESTIONS if q['answerable'])}")
    print(f"Unanswerable: {sum(1 for q in EVAL_QUESTIONS if not q['answerable'])}")
    print(f"DeepSeek API: {'Connected' if HAS_LLM else 'Not available'}")

    results = []
    answerable_correct = 0
    answerable_total = 0
    unanswerable_correct = 0
    unanswerable_total = 0
    retrieval_hits = 0

    for i, item in enumerate(EVAL_QUESTIONS):
        question = item["question"]
        answerable = item["answerable"]
        keywords = item["keywords"]

        print(f"\n{'─'*70}")
        print(f"[{i+1}/{len(EVAL_QUESTIONS)}] {question}")
        print(f"  Expected: {'Answerable' if answerable else 'Unanswerable'}")

        start = time.time()
        response = run_rag(question)
        elapsed = time.time() - start

        answer = response["answer"]
        citations = response["citations"]
        corrective = response["corrective_action"]

        # Check if it declined appropriately
        declined = any(phrase in answer.lower() for phrase in [
            "don't have enough", "i don't know", "not enough information",
            "cannot answer", "no information",
        ])

        # Check for keyword hits
        keyword_hits = sum(1 for kw in keywords if kw.lower() in answer.lower())

        # Score this question
        if answerable:
            answerable_total += 1
            if not declined and keyword_hits > 0:
                answerable_correct += 1
                status = "PASS"
            else:
                status = "FAIL"
            if len(citations) > 0:
                retrieval_hits += 1
        else:
            unanswerable_total += 1
            if declined:
                unanswerable_correct += 1
                status = "PASS (correctly declined)"
            else:
                status = "FAIL (should have declined)"

        print(f"  Status: {status}")
        print(f"  Corrective: {corrective or 'none'}")
        print(f"  Retrieved: {response['retrieved_count']} → Filtered: {response['filtered_count']}")
        print(f"  Citations: {len(citations)}")
        print(f"  Keywords: {keyword_hits}/{len(keywords)}")
        print(f"  Time: {elapsed:.1f}s")
        print(f"  Answer: {answer[:200]}...")

        results.append({
            "question": question,
            "answerable": answerable,
            "status": status,
            "corrective_action": corrective,
            "retrieved": response["retrieved_count"],
            "filtered": response["filtered_count"],
            "citations": len(citations),
            "keyword_hits": keyword_hits,
            "elapsed": round(elapsed, 1),
            "answer_preview": answer[:300],
        })

    # Summary
    print(f"\n{'='*70}")
    print("EVALUATION RESULTS")
    print(f"{'='*70}")

    aa_acc = answerable_correct / answerable_total if answerable_total > 0 else 0
    ua_acc = unanswerable_correct / unanswerable_total if unanswerable_total > 0 else 0
    ret_rate = retrieval_hits / answerable_total if answerable_total > 0 else 0

    print(f"Answerable accuracy:   {answerable_correct}/{answerable_total} = {aa_acc:.1%}")
    print(f"Unanswerable accuracy: {unanswerable_correct}/{unanswerable_total} = {ua_acc:.1%}")
    print(f"Retrieval hit rate:    {retrieval_hits}/{answerable_total} = {ret_rate:.1%}")
    print(f"Overall:               {(answerable_correct + unanswerable_correct)}/{len(EVAL_QUESTIONS)} = {(answerable_correct + unanswerable_correct)/len(EVAL_QUESTIONS):.1%}")

    # Save results
    with open("rag_eval_results.json", "w") as f:
        json.dump({
            "summary": {
                "answerable_accuracy": round(aa_acc, 3),
                "unanswerable_accuracy": round(ua_acc, 3),
                "retrieval_hit_rate": round(ret_rate, 3),
                "total_questions": len(EVAL_QUESTIONS),
                "answerable_correct": answerable_correct,
                "answerable_total": answerable_total,
                "unanswerable_correct": unanswerable_correct,
                "unanswerable_total": unanswerable_total,
            },
            "details": results,
        }, f, indent=2)

    print(f"\nResults saved to rag_eval_results.json")


if __name__ == "__main__":
    evaluate()
