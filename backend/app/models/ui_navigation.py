from typing import Optional
from sqlmodel import Field, SQLModel

class UINavigationBase(SQLModel):
    id: str = Field(primary_key=True)
    feature_name: str
    route: str
    dom_selector: str
    description: str
    risk_level: str = Field(default="SAFE")

class UINavigation(UINavigationBase, table=True):
    __tablename__ = "ui_navigation"
    embedding: Optional[str] = Field(default=None)

