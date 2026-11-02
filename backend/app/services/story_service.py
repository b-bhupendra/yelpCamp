import os
import uuid
import logging
from typing import Optional, List, Dict, Any
from fastapi import HTTPException, UploadFile, BackgroundTasks
from sqlmodel import Session
from app.models.visitor_photo import VisitorPhoto
from app.models.campground import Campground
from app.models.user import User
from app.schemas.visitor_photo import VisitorPhotoOut, VisitorStoryGroupOut, VisitorPhotoLikeResponse
from app.repositories.story_repo import story_repo
from app.services.cloudinary_service import upload_visitor_photo
from app.services.image_validator import sanitize_campground_image
from app.services.multimodal_embedder import process_story_ingestion
from app.core.config import settings

logger = logging.getLogger(__name__)

class StoryService:
    """Business logic for visitor stories and moments."""

    async def create_photo(
        self,
        session: Session,
        campground_id: int,
        current_user: User,
        background_tasks: BackgroundTasks,
        file: Optional[UploadFile] = None,
        image_url: Optional[str] = None,
        caption: Optional[str] = "",
        media_type: str = "photo",
        expires_hours: Optional[int] = None
    ) -> VisitorPhotoOut:
        campground = session.get(Campground, campground_id)
        if not campground:
            raise HTTPException(status_code=404, detail="Campground not found")

        final_image_url = None
        if file and file.filename:
            try:
                final_image_url = upload_visitor_photo(file.file)
            except Exception as e:
                logger.warning(f"Cloudinary upload failed for visitor photo, saving locally: {e}")
                os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
                ext = os.path.splitext(file.filename)[1] or ".jpg"
                filename = f"story_{uuid.uuid4().hex}{ext}"
                file_path = os.path.join(settings.UPLOAD_DIR, filename)
                file.file.seek(0)
                with open(file_path, "wb") as buffer:
                    buffer.write(file.file.read())
                final_image_url = f"/uploads/{filename}"
        elif image_url:
            final_image_url = image_url

        if not final_image_url:
            raise HTTPException(status_code=400, detail="Image file or image_url is required")

        final_image_url = sanitize_campground_image(final_image_url, campground_id)

        new_photo = story_repo.create(
            session=session,
            campground_id=campground_id,
            user_id=current_user.id,
            image_url=final_image_url,
            caption=caption or "",
            media_type=media_type,
            expires_hours=expires_hours
        )

        background_tasks.add_task(process_story_ingestion, new_photo.id)

        res = story_repo.get_by_id(session, new_photo.id, current_user.id)
        if not res:
            raise HTTPException(status_code=500, detail="Failed to retrieve created photo")
        return res

    def get_campground_photos(
        self,
        session: Session,
        campground_id: int,
        user_id: Optional[int] = None
    ) -> List[VisitorPhotoOut]:
        return story_repo.get_campground_photos(session, campground_id, user_id)

    def get_active_story_tray(
        self,
        session: Session,
        user_id: Optional[int] = None
    ) -> List[VisitorStoryGroupOut]:
        return story_repo.get_active_story_tray(session, user_id)

    def get_user_moments(
        self,
        session: Session,
        user_id: int
    ) -> List[VisitorPhotoOut]:
        return story_repo.get_user_moments(session, user_id)

    def get_photo_detail(
        self,
        session: Session,
        photo_id: int,
        user_id: Optional[int] = None
    ) -> VisitorPhotoOut:
        photo_out = story_repo.get_by_id(session, photo_id, user_id)
        if not photo_out:
            raise HTTPException(status_code=404, detail="Visitor photo not found")
        return photo_out

    def delete_photo(
        self,
        session: Session,
        photo_id: int,
        current_user: User
    ) -> Dict[str, Any]:
        photo = session.get(VisitorPhoto, photo_id)
        if not photo:
            raise HTTPException(status_code=404, detail="Visitor photo not found")

        if photo.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="You do not have permission to delete this photo")

        story_repo.delete(session, photo)
        return {"message": "Visitor moment deleted successfully", "photo_id": photo_id}

    def toggle_like(
        self,
        session: Session,
        photo_id: int,
        user_id: int
    ) -> VisitorPhotoLikeResponse:
        photo = session.get(VisitorPhoto, photo_id)
        if not photo:
            raise HTTPException(status_code=404, detail="Visitor photo not found")

        return story_repo.toggle_like(session, photo_id, user_id)

story_service = StoryService()

