import logging
from typing import List, Dict, Any, Optional
from sqlmodel import Session, select
from config import settings
from services.multimodal_embedder import multimodal_embedder
from services.vector_store import vector_store

logger = logging.getLogger(__name__)

class RAGService:
    """
    RAG Orchestration & Aurora Guide Chatbot Service.
    Retrieves vector-grounded campsites and queries Gemini LLM for conversational responses.
    """
    def __init__(self):
        self.chat_model = settings.CHAT_MODEL or "gemini-3.5-flash-lite"

    def semantic_search(
        self,
        session: Session,
        query: str,
        limit: int = 6,
        min_score: float = 0.35
    ) -> List[Dict[str, Any]]:
        """Vector semantic search for campgrounds matching natural language query."""
        if not query or not query.strip():
            return []
        
        query_vector = multimodal_embedder.embed_text(query)
        results = vector_store.search_similar(
            session=session,
            query_vector=query_vector,
            limit=limit,
            min_score=min_score
        )
        return results

    def chat_rag(
        self,
        session: Session,
        message: str,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Interactive RAG Chatbot:
        1. Retrieves relevant campsites from Turso Vector.
        2. Grounds prompt with campground info, pricing, description, reviews.
        3. Calls Gemini LLM to generate an intelligent conversational answer.
        4. Provides citations and action cards for UI navigation.
        """
        history = conversation_history or []
        
        # 1. Retrieve grounded campsite knowledge
        retrieved_camps = self.semantic_search(session, query=message, limit=3, min_score=0.25)
        
        # Build context block
        context_blocks = []
        campsite_cards = []
        for c in retrieved_camps:
            context_blocks.append(
                f"- ID: {c['id']}\n"
                f"  Name: {c['name']}\n"
                f"  Price: ${c['price']}/night\n"
                f"  Description: {c['description']}\n"
                f"  Host: {c['author_username']}\n"
                f"  Match Relevancy: {c['match_percentage']}%\n"
            )
            campsite_cards.append({
                "id": c["id"],
                "name": c["name"],
                "price": c["price"],
                "image": c["image"],
                "description": c["description"][:120] + "..." if len(c["description"]) > 120 else c["description"],
                "match_percentage": c["match_percentage"]
            })

        grounded_context = "\n".join(context_blocks) if context_blocks else "No specific campsites directly matched this query."

        system_instruction = (
            "You are the YelpCamp Aurora Guide, an intelligent, warm, and outdoor-savvy camping concierge. "
            "You help adventurers find extraordinary campsites, plan trips, and explore wilderness accommodations.\n\n"
            "CRITICAL CITATION RULES:\n"
            "1. Whenever you mention or recommend any specific campground from the context, always format it as a markdown link using its ID: "
            "[Campground: <Name>](campground:<id>). For example: 'I highly recommend [Campground: Aether Sanctuary](campground:14)'.\n"
            "2. Never use emojis as bullet points or icons in your text.\n"
            "3. Keep answers crisp, inviting, and practical (mention prices, terrain, ambiance).\n"
            "4. Base your recommendations primarily on the retrieved context below, but you may add general camping advice.\n\n"
            f"=== RETRIEVED CAMPSITES CONTEXT ===\n{grounded_context}\n================================="
        )

        reply_text = ""
        client = multimodal_embedder.client

        if client:
            try:
                from google.genai import types
                
                # Format conversation turns
                contents = []
                for turn in history[-6:]:  # Keep recent context window
                    role = "user" if turn.get("role") == "user" else "model"
                    contents.append(types.Content(
                        role=role,
                        parts=[types.Part.from_text(text=turn.get("content", ""))]
                    ))
                
                # Add current user message
                contents.append(types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=message)]
                ))

                config = types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.7,
                    max_output_tokens=800
                )

                # Call Gemini model
                response = client.models.generate_content(
                    model=self.chat_model,
                    contents=contents,
                    config=config
                )
                reply_text = response.text
            except Exception as e:
                logger.warning(f"Gemini chat generation failed: {e}. Falling back to standard concierge response.")
                reply_text = self._fallback_chat_reply(message, retrieved_camps)
        else:
            reply_text = self._fallback_chat_reply(message, retrieved_camps)

        return {
            "reply": reply_text,
            "campsite_cards": campsite_cards,
            "citations": [
                {"id": c["id"], "name": c["name"], "url": f"/campgrounds/{c['id']}"}
                for c in retrieved_camps
            ]
        }

    def _fallback_chat_reply(self, message: str, camps: List[Dict[str, Any]]) -> str:
        """Deterministic offline conversational assistant when Gemini is unreachable."""
        if camps:
            top = camps[0]
            suggestions = ", ".join([f"[Campground: {c['name']}](campground:{c['id']}) (${c['price']}/night)" for c in camps[:3]])
            return (
                f"Based on your interest in '{message}', here are our top wilderness recommendations: {suggestions}.\n\n"
                f"Our top match is [Campground: {top['name']}](campground:{top['id']}), priced at ${top['price']}/night. "
                f"{top['description']} You can click any campsite card below to view details and reviews."
            )
        else:
            return (
                "I couldn't find an exact campsite match for that specific inquiry. "
                "Try searching for keywords like 'lakeside', 'pine forest', 'desert stars', or 'budget friendly under $40'!"
            )

rag_service = RAGService()
