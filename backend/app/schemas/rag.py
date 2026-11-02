from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel, Field
from app.models.ui_navigation import UINavigationBase

class UINavItem(UINavigationBase):
    parameters: Optional[Dict[str, Any]] = None

class UINavSyncRequest(SQLModel):
    items: List[UINavItem]

class AgentInteractRequest(SQLModel):
    user_message: str = Field(..., min_length=1, description="Adventurer's prompt or question")
    ui_context: Optional[Dict[str, Any]] = Field(default=None, description="Active route, campground_id, modal states")
    available_actions: Optional[List[Dict[str, Any]]] = Field(default=None, description="Dynamic React callbacks executable by agent")
    chat_history: Optional[List[Dict[str, str]]] = Field(default=None, description="Previous message turns")

class AgentInteractResponse(SQLModel):
    reply: str
    campsite_results: List[Dict[str, Any]] = Field(default_factory=list)
    story_results: List[Dict[str, Any]] = Field(default_factory=list)
    trigger_action_id: Optional[str] = None
    action_args: Optional[Dict[str, Any]] = None
    action_plan: Optional[List[Dict[str, Any]]] = None
    ui_highlight: Optional[Dict[str, Any]] = None

class SearchRequest(SQLModel):
    query: str = Field(..., min_length=1, description="Natural language semantic search query")
    limit: Optional[int] = Field(default=6, ge=1, le=20)
    min_score: Optional[float] = Field(default=0.25, ge=0.0, le=1.0)

class ChatMessage(SQLModel):
    role: str = Field(..., description="user or model")
    content: str = Field(..., min_length=1)

class ChatRequest(SQLModel):
    message: str = Field(..., min_length=1, description="User's chat message")
    conversation_history: Optional[List[ChatMessage]] = Field(default=[])
