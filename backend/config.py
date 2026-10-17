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
    
    # Cloudinary CDN credentials (loaded from .env / Cloud environment)
    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None
    CLOUDINARY_URL: Optional[str] = None
    
    # Google OAuth 2.0 Credentials (loaded from .env / Cloud environment)
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    
    # Gemini Vector RAG & LLM Configuration
    GEMINI_API_KEY: Optional[str] = None
    EMBEDDING_MODEL: str = "gemini-embedding-2"
    CHAT_MODEL: str = "gemini-3.5-flash"
    VISION_MODEL: str = "gemini-3.5-flash"
    
    # Rate Limiting Configuration
    RATE_LIMIT_ENABLED: bool = True
    REDIS_URL: Optional[str] = None
    RATE_LIMIT_DEFAULT: str = "120/minute"
    RATE_LIMIT_AI_INTERACT: str = "15/minute"
    RATE_LIMIT_AI_CHAT: str = "12/minute"
    RATE_LIMIT_AI_SEARCH: str = "30/minute"
    RATE_LIMIT_AUTH_LOGIN: str = "5/minute"
    RATE_LIMIT_AUTH_REGISTER: str = "3/minute"
    RATE_LIMIT_CONTENT_CREATE: str = "10/minute"
    RATE_LIMIT_SOCIAL_ACTION: str = "40/minute"
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
