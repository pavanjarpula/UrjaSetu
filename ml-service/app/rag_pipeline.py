"""
Corrective-RAG Pipeline
Implements the full RAG pipeline with:
- Retrieval → grade → rewrite → generate → self-reflect
- Tavily web search fallback
- MongoDB Atlas Vector Search integration
"""

import os
import logging
from typing import TypedDict, List, Optional, Literal
from enum import Enum

from pydantic import BaseModel

logger = logging.getLogger("rag-pipeline")
logging.basicConfig(level=logging.INFO)


# ─────────────── State Schema ───────────────

class GradeRelevance(BaseModel):
    binary_score: str  # "yes" or "no"


class RAGState(TypedDict):
    question: str
    generation: str
    web_search: str
    documents: List[dict]
    filtered_documents: List[dict]
    correct_generation: str
    number_of_retries: int
    corrective_action: Optional[str]
    citations: List[str]
    live_data: Optional[dict]


# ─────────────── Graph Nodes ───────────────

class RAGPipeline:
    """
    Corrective-RAG pipeline using LangGraph state machine.
    
    Flow:
    1. retrieve → Atlas Vector Search (top-k chunks)
    2. grade_documents → LLM grades each chunk relevance
    3. Conditional:
       - If relevant docs exist → generate answer
       - If not enough relevant → rewrite_query → retrieve again (max 1 retry)
       - If still not enough → web_search (Tavily fallback)
    4. generate → LLM generates answer with context
    5. grade_generation → Self-reflection (useful + grounded)
    6. If not useful/grounded → rewrite_query (max 1 retry)
    """
    
    MAX_RETRIES = 1
    
    def __init__(self, llm_provider, vector_search_fn, embed_fn, 
                 tavily_search_fn=None, live_data_fn=None):
        self.llm = llm_provider
        self.vector_search = vector_search_fn
        self.embed = embed_fn
        self.tavily_search = tavily_search_fn
        self.fetch_live_data = live_data_fn
    
    async def retrieve(self, state: RAGState) -> RAGState:
        """Retrieve top-k chunks via Atlas Vector Search."""
        question = state["question"]
        logger.info(f"[RAG] Retrieving for: {question[:80]}...")
        
        query_embedding = await self.embed(question)
        documents = await self.vector_search(query_embedding, k=5)
        
        return {
            **state,
            "documents": documents,
            "number_of_retries": 0,
        }
    
    async def grade_documents(self, state: RAGState) -> RAGState:
        """Grade each retrieved document for relevance using LLM."""
        question = state["question"]
        documents = state["documents"]
        
        logger.info(f"[RAG] Grading {len(documents)} documents...")
        
        filtered = []
        for doc in documents:
            grade = await self.llm.gradeRelevance(question, doc.get("text", ""))
            if grade:
                filtered.append(doc)
        
        logger.info(f"[RAG] {len(filtered)}/{len(documents)} documents passed grading")
        
        return {
            **state,
            "filtered_documents": filtered,
        }
    
    async def rewrite_query(self, state: RAGState) -> RAGState:
        """Rewrite the query for better retrieval."""
        question = state["question"]
        retries = state.get("number_of_retries", 0)
        
        logger.info(f"[RAG] Rewriting query (retry {retries + 1})...")
        
        rewritten = await self.llm.rewriteQuery(question)
        
        return {
            **state,
            "question": rewritten,
            "number_of_retries": retries + 1,
            "corrective_action": "query_rewrite",
        }
    
    async def web_search(self, state: RAGState) -> RAGState:
        """Tavily web search fallback when vector search fails."""
        question = state["question"]
        
        if not self.tavily_search:
            logger.warning("[RAG] Tavily search not configured")
            return {
                **state,
                "web_search": "not_configured",
            }
        
        logger.info(f"[RAG] Performing web search fallback...")
        
        try:
            results = await self.tavily_search(question)
            web_docs = [
                {"text": r.get("content", ""), "source_file": r.get("url", "web"), "section": "web_search"}
                for r in results
            ]
            return {
                **state,
                "documents": state.get("documents", []) + web_docs,
                "filtered_documents": state.get("filtered_documents", []) + web_docs,
                "web_search": "completed",
                "corrective_action": "tavily_web_search",
            }
        except Exception as e:
            logger.error(f"[RAG] Web search failed: {e}")
            return {
                **state,
                "web_search": "failed",
            }
    
    async def generate(self, state: RAGState) -> RAGState:
        """Generate answer using LLM with filtered context."""
        question = state["question"]
        documents = state.get("filtered_documents", [])
        live_data = state.get("live_data")
        
        if not documents and not live_data:
            return {
                **state,
                "generation": "I don't have enough information in the current documents or live data to answer that. Please try rephrasing your question or ask about a specific topic covered in the documentation.",
                "citations": [],
            }
        
        context_parts = []
        citations = []
        
        for doc in documents:
            source = doc.get("source_file", "unknown")
            section = doc.get("section", "N/A")
            context_parts.append(f"[{source} - {section}]: {doc.get('text', '')}")
            citation = f"{source} - {section}" if section != "N/A" else source
            if citation not in citations:
                citations.append(citation)
        
        if live_data:
            import json
            context_parts.append(f"[Live Data]: {json.dumps(live_data)}")
            citations.append("Live forecast/TES data")
        
        context = "\n\n".join(context_parts)
        answer = await self.llm.generateAnswer(question, context)
        
        return {
            **state,
            "generation": answer,
            "citations": citations,
        }
    
    async def grade_generation(self, state: RAGState) -> RAGState:
        """Self-reflect: is the generation useful and grounded in context?"""
        question = state["question"]
        generation = state["generation"]
        documents = state.get("filtered_documents", [])
        
        context = "\n".join([d.get("text", "") for d in documents[:3]])
        
        prompt = f"""You are grading whether the answer is:
1. USEFUL - directly answers the question
2. GROUNDED - supported by the provided context

Question: {question}
Context: {context[:1500]}
Answer: {generation[:1500]}

Reply with only: "useful" or "not_useful" or "hallucination"."""
        
        try:
            grade = await self.llm._call_llm(prompt)
            grade_lower = grade.strip().lower()
            
            if "hallucination" in grade_lower:
                logger.info("[RAG] Generation contains hallucination")
                return {**state, "correct_generation": "not_useful"}
            elif "useful" in grade_lower:
                logger.info("[RAG] Generation is useful and grounded")
                return {**state, "correct_generation": "useful"}
            else:
                logger.info("[RAG] Generation not useful")
                return {**state, "correct_generation": "not_useful"}
        except Exception as e:
            logger.error(f"[RAG] Grading failed: {e}")
            return {**state, "correct_generation": "useful"}  # Default to accepting
    
    async def decide_next_step(self, state: RAGState) -> Literal["generate", "rewrite", "web_search"]:
        """Conditional edge: decide what to do after grading documents."""
        filtered = state.get("filtered_documents", [])
        retries = state.get("number_of_retries", 0)
        
        if len(filtered) >= 2:
            return "generate"
        elif retries < self.MAX_RETRIES:
            return "rewrite"
        elif self.tavily_search:
            return "web_search"
        else:
            return "generate"
    
    async def decide_after_generation(self, state: RAGState) -> Literal["end", "rewrite"]:
        """Conditional edge: decide after self-reflection."""
        correct = state.get("correct_generation", "useful")
        retries = state.get("number_of_retries", 0)
        
        if correct == "useful" or retries >= self.MAX_RETRIES:
            return "end"
        else:
            return "rewrite"
    
    async def run(self, question: str, live_data: dict = None) -> dict:
        """Execute the full RAG pipeline."""
        state: RAGState = {
            "question": question,
            "generation": "",
            "web_search": "",
            "documents": [],
            "filtered_documents": [],
            "correct_generation": "",
            "number_of_retries": 0,
            "corrective_action": None,
            "citations": [],
            "live_data": live_data,
        }
        
        # Step 1: Retrieve
        state = await self.retrieve(state)
        
        # Step 2: Grade documents
        state = await self.grade_documents(state)
        
        # Step 3: Conditional - rewrite or generate
        next_step = await self.decide_next_step(state)
        
        if next_step == "rewrite":
            state = await self.rewrite_query(state)
            state = await self.retrieve(state)
            state = await self.grade_documents(state)
        elif next_step == "web_search":
            state = await self.web_search(state)
        
        # Step 4: Generate
        state = await self.generate(state)
        
        # Step 5: Self-reflect
        state = await self.grade_generation(state)
        
        # Step 6: Conditional - accept or retry
        final_step = await self.decide_after_generation(state)
        
        if final_step == "rewrite" and state["number_of_retries"] <= self.MAX_RETRIES:
            state = await self.rewrite_query(state)
            state = await self.retrieve(state)
            state = await self.grade_documents(state)
            state = await self.generate(state)
        
        return {
            "answer": state["generation"],
            "citations": state["citations"],
            "corrective_action": state["corrective_action"],
            "retrieved_count": len(state.get("documents", [])),
            "filtered_count": len(state.get("filtered_documents", [])),
            "retries": state["number_of_retries"],
            "web_search_used": state.get("web_search") == "completed",
        }
