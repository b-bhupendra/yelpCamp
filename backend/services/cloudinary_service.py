import cloudinary
import cloudinary.uploader
from cloudinary.utils import cloudinary_url
from config import settings

# Initialize Cloudinary credentials
cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True
)

def upload_campground_image(file_data, public_id: str = None) -> str:
    """
    Uploads a campsite image to Cloudinary CDN in the 'yelpcamp/campgrounds' folder.
    Automatically applies delivery optimization (q_auto, f_auto).
    """
    options = {
        "folder": "yelpcamp/campgrounds",
        "resource_type": "image",
        "transformation": [
            {"quality": "auto", "fetch_format": "auto"}
        ]
    }
    if public_id:
        options["public_id"] = public_id

    result = cloudinary.uploader.upload(file_data, **options)
    return result.get("secure_url")

def upload_user_avatar(file_data, user_id: int = None) -> str:
    """
    Uploads a user profile picture/display picture to Cloudinary CDN.
    Applies face-detecting square thumbnail transformation.
    """
    options = {
        "folder": "yelpcamp/avatars",
        "resource_type": "image",
        "transformation": [
            {"width": 300, "height": 300, "crop": "thumb", "gravity": "face"},
            {"quality": "auto", "fetch_format": "auto"}
        ]
    }
    if user_id:
        options["public_id"] = f"user_avatar_{user_id}"
        options["overwrite"] = True

    result = cloudinary.uploader.upload(file_data, **options)
    return result.get("secure_url")

def get_optimized_avatar_url(public_id: str) -> str:
    url, _ = cloudinary_url(
        public_id,
        width=200,
        height=200,
        crop="thumb",
        gravity="face",
        fetch_format="auto",
        quality="auto"
    )
    return url

def get_user_avatar_url(username: str, avatar_url: str = None) -> str:
    """
    Returns the user's custom avatar if present, or a deterministic, aesthetic adventurer avatar.
    """
    if avatar_url and avatar_url.strip():
        return avatar_url
    clean_username = (username or "scout").lower().replace(" ", "_")
    return f"https://api.dicebear.com/7.x/adventurer/svg?seed={clean_username}"

def upload_visitor_photo(file_data, public_id: str = None) -> str:
    """
    Uploads a visitor story/photo to Cloudinary in the 'yelpcamp/visitor_photos' folder.
    """
    options = {
        "folder": "yelpcamp/visitor_photos",
        "resource_type": "auto",
        "transformation": [
            {"quality": "auto", "fetch_format": "auto"}
        ]
    }
    if public_id:
        options["public_id"] = public_id

    result = cloudinary.uploader.upload(file_data, **options)
    return result.get("secure_url")
