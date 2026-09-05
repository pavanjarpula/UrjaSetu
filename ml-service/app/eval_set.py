"""
RAG Evaluation Set
15-20 test questions spanning: paper facts, SOP facts, live forecast questions,
and deliberately unanswerable questions.
"""

EVAL_QUESTIONS = [
    # Paper facts
    {
        "question": "What is the design COP of the ice TES system?",
        "expected_source": "paper",
        "answerable": True,
        "expected_keywords": ["cop", "carnot", "efficiency"],
    },
    {
        "question": "How much ice volume is needed for full campus coverage?",
        "expected_source": "paper",
        "answerable": True,
        "expected_keywords": ["278", "volume", "m3", "ice"],
    },
    {
        "question": "What is the thermal lag validated by BTP-II?",
        "expected_source": "paper",
        "answerable": True,
        "expected_keywords": ["37.5", "minute", "thermal lag"],
    },
    {
        "question": "How many halls of residence are there at IIT Kharagpur?",
        "expected_source": "paper",
        "answerable": True,
        "expected_keywords": ["21", "halls"],
    },
    {
        "question": "What is the MAPE of the XGBoost quantile regression model?",
        "expected_source": "paper",
        "answerable": True,
        "expected_keywords": ["mape", "16", "percent"],
    },
    {
        "question": "What percentage of nights can the ice TES provide full coverage?",
        "expected_source": "paper",
        "answerable": True,
        "expected_keywords": ["95.9", "percent", "coverage", "350"],
    },
    {
        "question": "What is the campus solar PV capacity?",
        "expected_source": "paper",
        "answerable": True,
        "expected_keywords": ["5.5", "mwp", "solar"],
    },
    # SOP / platform facts
    {
        "question": "How does the corrective RAG grading step work?",
        "expected_source": "sop",
        "answerable": True,
        "expected_keywords": ["grade", "relevant", "chunk"],
    },
    {
        "question": "What embedding model is used for document chunks?",
        "expected_source": "sop",
        "answerable": True,
        "expected_keywords": ["minilm", "sentence", "transformers"],
    },
    # Live data questions
    {
        "question": "What is today's solar generation forecast?",
        "expected_source": "live_data",
        "answerable": True,
        "expected_keywords": ["kwh", "forecast"],
    },
    {
        "question": "How much ice mass will be produced today?",
        "expected_source": "live_data",
        "answerable": True,
        "expected_keywords": ["kg", "ice", "mass"],
    },
    {
        "question": "What is the current coverage percentage?",
        "expected_source": "live_data",
        "answerable": True,
        "expected_keywords": ["percent", "coverage"],
    },
    # Deliberately unanswerable
    {
        "question": "What is the serial number of the main chiller?",
        "expected_source": "none",
        "answerable": False,
        "expected_keywords": [],
    },
    {
        "question": "How much did the ice TES system cost to install?",
        "expected_source": "none",
        "answerable": False,
        "expected_keywords": [],
    },
    {
        "question": "What is the maintenance schedule for the evaporator?",
        "expected_source": "none",
        "answerable": False,
        "expected_keywords": [],
    },
    {
        "question": "Who is the contractor that built the cooling plant?",
        "expected_source": "none",
        "answerable": False,
        "expected_keywords": [],
    },
    {
        "question": "What is the electricity tariff rate at IIT Kharagpur?",
        "expected_source": "none",
        "answerable": False,
        "expected_keywords": [],
    },
]


def evaluate_rag(chat_function):
    """Run evaluation set against the chat function.

    Args:
        chat_function: callable(question) -> {"answer": str, "citations": list}

    Returns:
        dict with metrics
    """
    results = {
        "total": len(EVAL_QUESTIONS),
        "answerable_correct": 0,
        "answerable_total": 0,
        "unanswerable_correct": 0,
        "unanswerable_total": 0,
        "retrieval_hits": 0,
        "details": [],
    }

    for item in EVAL_QUESTIONS:
        question = item["question"]
        answerable = item["answerable"]

        response = chat_function(question)
        answer = response.get("answer", "").lower()
        citations = response.get("citations", [])

        # Check if it declined appropriately
        declined = any(phrase in answer for phrase in [
            "don't have enough",
            "i don't know",
            "not enough information",
            "cannot answer",
            "no information",
        ])

        # Check for keyword hits
        keyword_hits = sum(1 for kw in item["expected_keywords"] if kw in answer)

        if answerable:
            results["answerable_total"] += 1
            if not declined and keyword_hits > 0:
                results["answerable_correct"] += 1
            if len(citations) > 0:
                results["retrieval_hits"] += 1
        else:
            results["unanswerable_total"] += 1
            if declined:
                results["unanswerable_correct"] += 1

        results["details"].append({
            "question": question,
            "answerable": answerable,
            "declined": declined,
            "keyword_hits": keyword_hits,
            "citations_count": len(citations),
            "answer_preview": answer[:200],
        })

    # Compute metrics
    results["answerable_accuracy"] = (
        results["answerable_correct"] / results["answerable_total"]
        if results["answerable_total"] > 0 else 0
    )
    results["unanswerable_accuracy"] = (
        results["unanswerable_correct"] / results["unanswerable_total"]
        if results["unanswerable_total"] > 0 else 0
    )
    results["retrieval_hit_rate"] = (
        results["retrieval_hits"] / results["answerable_total"]
        if results["answerable_total"] > 0 else 0
    )

    return results


if __name__ == "__main__":
    import json
    print(json.dumps(EVAL_QUESTIONS, indent=2))
    print(f"\nTotal questions: {len(EVAL_QUESTIONS)}")
    print(f"Answerable: {sum(1 for q in EVAL_QUESTIONS if q['answerable'])}")
    print(f"Unanswerable: {sum(1 for q in EVAL_QUESTIONS if not q['answerable'])}")
