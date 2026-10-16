import os
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    PROJECT_NAME: str = "YelpCamp API"
    ENVIRONMENT: str = "production"
    SECRET_KEY: str = "yelpcamp-super-secure-production-secret-key-32chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    
    DATABASE_URL: str = "sqlite:///database.db"
    USE_TURSO: bool = True
    TURSO_DATABASE_URL: str = "https://yelpcamp-db-bhupendra123.aws-ap-south-1.turso.io"
    TURSO_AUTH_TOKEN: str = ""
    
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]
    
    UPLOAD_DIR: str = "uploads"
    
    # Cloudinary CDN credentials
    CLOUDINARY_CLOUD_NAME: str = "hp2tdcbi"
    CLOUDINARY_API_KEY: str = "664345645987225"
    CLOUDINARY_API_SECRET: str = "YOUR_CLOUDINARY_API_SECRET"
    CLOUDINARY_URL: str = "cloudinary://664345645987225:YOUR_CLOUDINARY_API_SECRET@hp2tdcbi"
    
    # Google OAuth 2.0 Credentials
    GOOGLE_CLIENT_ID: str = "YOUR_GOOGLE_CLIENT_ID"
    GOOGLE_CLIENT_SECRET: str = "YOUR_GOOGLE_CLIENT_SECRET"
    
    # Gemini Vector RAG & LLM Configuration
    GEMINI_API_KEY: Optional[str] = None
    EMBEDDING_MODEL: str = "gemini-embedding-2"
    CHAT_MODEL: str = "gemini-3.5-flash"
    VISION_MODEL: str = "gemini-3.5-flash"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
