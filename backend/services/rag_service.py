import json
import logging
from typing import List, Dict, Any, Optional
from sqlmodel import Session, select
from config import settings
from services.multimodal_embedder import multimodal_embedder
from services.vector_store import vector_store

logger = logging.getLogger(__name__)

class RAGService:
    """
    RAG Orchestration & Dynamic AI Agent Co-Pilot Service.
    Integrates 3-Stage Hybrid Retrieval (Dense Vector + FTS5 BM25 + Cross-Encoder)
    with Google Gemini 3.5 Flash tool calling to execute in-app React actions and highlight DOM elements.
    """
    def __init__(self):
        self.chat_model = settings.CHAT_MODEL or "gemini-3.5-flash"
        self.fallback_models = [
            "gemini-3.5-flash",
            "gemini-3.5-flash-lite",
            "gemini-2.5-flash-lite",
            "gemini-flash-latest",
            "gemini-3.8-flash"
        ]

    def semantic_search(
        self,
        session: Session,
        query: str,
        limit: int = 6,
        min_score: float = 0.35
    ) -> List[Dict[str, Any]]:
        """3-Stage Hybrid Vector Search for campgrounds."""
        if not query or not query.strip():
            return []
        return vector_store.hybrid_search_campsites(session, query, limit=limit)

    async def interact_with_agent(
        self,
        session: Session,
        user_message: str,
        ui_context: Dict[str, Any],
        available_actions: List[Dict[str, Any]],
        chat_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Dynamic Agent Interaction:
        1. Checks for UI navigation target via distance-guarded vector index (< 0.25).
        2. Retrieves relevant campsites via 3-stage hybrid search.
        3. Prompts Gemini 3.5 Flash with active UI state and dynamic React actions.
        4. Returns structured JSON containing reply, campsite_results, trigger_action_id, action_args, and ui_highlight.
        """
        history = chat_history or []

        # 1. Check UI Navigation Target with strict cutoff
        ui_nav_target = vector_store.find_ui_navigation_target(session, user_message)

        # 2. Retrieve campsites using 3-Stage Hybrid Retrieval
        campsite_results = vector_store.hybrid_search_campsites(session, user_message, limit=3)

        # Build context blocks for LLM
        campsite_summaries = []
        for c in campsite_results:
            campsite_summaries.append(
                f"- [Campground: {c['name']}](campground:{c['id']}) | ${c['price']}/night | "
                f"Rating: {c['avg_rating']} | Location: {c['location']} | {c['description'][:120]}..."
            )
        grounded_campsites = "\n".join(campsite_summaries) if campsite_summaries else "No direct campsite matches found."

        system_instruction = (
            "You are the YelpCamp Aurora Guide and AI Co-Pilot, an intelligent, outdoor-savvy camping concierge.\n"
            "You help adventurers find extraordinary campsites, plan trips, and navigate the application.\n\n"
            f"=== CURRENT REACT UI STATE ===\n{json.dumps(ui_context)}\n\n"
            f"=== DYNAMIC AVAILABLE REACT ACTIONS ===\n{json.dumps(available_actions)}\n\n"
            f"=== UI NAVIGATION RELEVANCE ===\n{json.dumps(ui_nav_target) if ui_nav_target else 'None'}\n\n"
            f"=== RETRIEVED GROUNDED CAMPSITES ===\n{grounded_campsites}\n\n"
            "CRITICAL INSTRUCTIONS:\n"
            "1. Respond ONLY with a valid JSON object matching this schema:\n"
            "{\n"
            '  "reply": "Warm, concise conversational response. When citing a campsite, use [Campground: <Name>](campground:<id>). Do not use bullet emojis.",\n'
            '  "trigger_action_id": "Exact id from Available Actions if the user asks to trigger it (e.g. open_share_modal, populate_campground_form), or null",\n'
            '  "action_args": "Object with arguments for the triggered action, or null",\n'
            '  "ui_highlight": "Object {route, dom_selector, feature_name, description} if user asks where a button is or UI navigation matches, or null"\n'
            "}\n"
            "2. Never make up DOM selectors or action IDs that are not provided in the prompt.\n"
            "3. If no frontend action is requested, set trigger_action_id to null."
        )

        client = multimodal_embedder.client
        reply_json: Optional[Dict[str, Any]] = None

        if client:
            from google.genai import types

            contents = []
            for turn in history[-6:]:
                role = "user" if turn.get("role") == "user" else "model"
                contents.append(types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=turn.get("content", ""))]
                ))
            contents.append(types.Content(
                role="user",
                parts=[types.Part.from_text(text=user_message)]
            ))

            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                temperature=0.3,
                max_output_tokens=600
            )

            models_to_try = [self.chat_model] + [m for m in self.fallback_models if m != self.chat_model]

            for model_name in models_to_try:
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=contents,
                        config=config
                    )
                    if response and response.text:
                        reply_json = json.loads(response.text.strip())
                        break
                except Exception as e:
                    logger.warning(f"Agent generation failed with model {model_name}: {e}")
                    continue

        # If LLM generation failed or client is offline, formulate intelligent fallback
        if not reply_json:
            fallback_text = ""
            matched_action_id = None
            action_args = None

            # Heuristic match against available actions
            msg_lower = user_message.lower()
            for act in available_actions:
                act_id = act.get("id", "")
                if act_id and act_id.lower().replace("_", " ") in msg_lower:
                    matched_action_id = act_id
                    break

            if ui_nav_target:
                fallback_text = (
                    f"You can find the {ui_nav_target['feature_name']} on your screen. "
                    f"{ui_nav_target['description']}"
                )
            elif campsite_results:
                top = campsite_results[0]
                fallback_text = (
                    f"Based on your trail inquiry, I recommend exploring [Campground: {top['name']}](campground:{top['id']}) "
                    f"at ${top['price']}/night ({top['location']}). {top['description'][:100]}..."
                )
            else:
                fallback_text = (
                    "I'm here to guide your wilderness adventures. You can ask me to search for serene campsites, "
                    "or help you share properties and post visitor moments!"
                )

            reply_json = {
                "reply": fallback_text,
                "trigger_action_id": matched_action_id,
                "action_args": action_args,
                "ui_highlight": ui_nav_target
            }

        return {
            "reply": reply_json.get("reply", ""),
            "campsite_results": campsite_results,
            "story_results": [],
            "trigger_action_id": reply_json.get("trigger_action_id"),
            "action_args": reply_json.get("action_args"),
            "ui_highlight": reply_json.get("ui_highlight") or ui_nav_target
        }

    def chat_rag(
        self,
        session: Session,
        message: str,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """Legacy chat endpoint wrapper."""
        camps = self.semantic_search(session, query=message, limit=3)
        campsite_cards = [
            {
                "id": c["id"],
                "name": c["name"],
                "price": c["price"],
                "image": c["image"],
                "description": c["description"][:120] + "...",
                "match_percentage": c["match_percentage"]
            } for c in camps
        ]
        citations = [{"id": c["id"], "name": c["name"], "url": f"/campgrounds/{c['id']}"} for c in camps]

        if camps:
            reply = f"Here are great campsites matching your interest: {', '.join([f'[Campground: {c['name']}](campground:{c['id']})' for c in camps[:2]])}."
        else:
            reply = "I'm searching the trail archives. Try queries like 'quiet lakeside', 'pine forest', or 'under $50'!"

        return {
            "reply": reply,
            "campsite_cards": campsite_cards,
            "citations": citations
        }

rag_service = RAGService()
