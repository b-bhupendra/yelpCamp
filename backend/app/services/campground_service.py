import os
from typing import Optional, List, Dict, Any
from fastapi import HTTPException, UploadFile, BackgroundTasks
from sqlmodel import Session
from app.models.campground import Campground
from app.models.user import User
from app.schemas.campground import (
    CampgroundCreate, CampgroundUpdate, CampgroundOut, PaginatedCampgrounds
)
from app.schemas.common import FileUploadResponse
from app.repositories.campground_repo import campground_repo
from app.services.cloudinary_service import upload_campground_image
from app.services.multimodal_embedder import process_campground_ingestion

class CampgroundService:
    """Business logic layer for Campground operations."""

    def list_campgrounds(
        self,
        session: Session,
        page: int = 1,
        limit: int = 12,
        search: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        tag: Optional[str] = None,
        sort: Optional[str] = None,
    ) -> PaginatedCampgrounds:
        return campground_repo.get_paginated(
            session=session,
            page=page,
            limit=limit,
            search=search,
            min_price=min_price,
            max_price=max_price,
            tag=tag,
            sort=sort
        )

    def get_campground(
        self,
        session: Session,
        campground_id: int,
        user_id: Optional[int] = None
    ) -> CampgroundOut:
        res = campground_repo.get_by_id(session, campground_id, user_id)
        if not res:
            raise HTTPException(status_code=404, detail="Campground not found")
        return res

    def create_campground(
        self,
        session: Session,
        data: CampgroundCreate,
        user_id: int,
        background_tasks: BackgroundTasks
    ) -> CampgroundOut:
        new_campground = campground_repo.create(session, data, user_id)
        background_tasks.add_task(process_campground_ingestion, new_campground.id)

        res = campground_repo.get_by_id(session, new_campground.id, user_id)
        if not res:
            raise HTTPException(status_code=500, detail="Failed to retrieve created campground")
        return res

    def update_campground(
        self,
        session: Session,
        campground: Campground,
        data: CampgroundUpdate,
        background_tasks: BackgroundTasks
    ) -> CampgroundOut:
        updated = campground_repo.update(session, campground, data)
        background_tasks.add_task(process_campground_ingestion, updated.id)

        res = campground_repo.get_by_id(session, updated.id, campground.author_id)
        if not res:
            raise HTTPException(status_code=500, detail="Failed to retrieve updated campground")
        return res

    def delete_campground(self, session: Session, campground: Campground) -> Dict[str, Any]:
        c_id = campground.id
        campground_repo.delete(session, campground)
        return {"message": "Campground deleted successfully", "id": c_id}

    def upload_image(self, file: UploadFile) -> FileUploadResponse:
        allowed_exts = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
        ext = os.path.splitext(file.filename or "")[1].lower()
        if ext not in allowed_exts:
            raise HTTPException(status_code=400, detail="Invalid file format. Allowed: JPG, PNG, WEBP, GIF.")

        cdn_url = upload_campground_image(file.file)
        return FileUploadResponse(
            url=cdn_url,
            filename=file.filename or "image.jpg"
        )

campground_service = CampgroundService()
