from typing import List, Generic, TypeVar
from sqlmodel import SQLModel

T = TypeVar("T")

class PaginatedResponse(SQLModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    limit: int
    total_pages: int
    has_next: bool
    has_prev: bool

class FileUploadResponse(SQLModel):
    url: str
    filename: str
