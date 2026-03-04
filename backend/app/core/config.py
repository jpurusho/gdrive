"""
Application configuration and settings
"""
import os
from typing import List, Dict, Any, Optional
from functools import lru_cache
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings


class OAuthConfig(BaseModel):
    """OAuth configuration"""
    client_id: str = Field(default="")
    client_secret: str = Field(default="")
    redirect_uri: str = Field(default="http://localhost:8000/api/auth/callback")
    scopes: List[str] = Field(default_factory=lambda: [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive.metadata.readonly"
    ])


class SyncConfig(BaseModel):
    """Sync configuration"""
    chunk_size_mb: int = Field(default=10)
    max_parallel_transfers: int = Field(default=5)
    conflict_resolution_default: str = Field(default="prompt")
    auto_retry_failed: bool = Field(default=True)
    max_retries: int = Field(default=3)


class PermissionsConfig(BaseModel):
    """Permissions configuration"""
    allow_deletions: bool = Field(default=False)
    require_deletion_confirmation: bool = Field(default=True)
    allow_shared_drives: bool = Field(default=True)
    allow_workspace_export: bool = Field(default=True)
    export_formats: Dict[str, List[str]] = Field(default_factory=lambda: {
        "google-docs": ["docx", "pdf", "txt"],
        "google-sheets": ["xlsx", "csv", "pdf"],
        "google-slides": ["pptx", "pdf"]
    })


class SecurityConfig(BaseModel):
    """Security configuration"""
    credential_storage: str = Field(default="docker_secrets")
    encrypt_tokens: bool = Field(default=True)
    session_timeout_minutes: int = Field(default=480)
    secret_key: str = Field(default="")


class UIConfig(BaseModel):
    """UI configuration"""
    auto_open_browser: bool = Field(default=True)
    show_qr_code: bool = Field(default=True)
    theme: str = Field(default="desktop")
    dual_pane_default: bool = Field(default=True)


class Settings(BaseSettings):
    """Application settings"""
    # Google OAuth
    google_client_id: str = Field(default="", env="GOOGLE_CLIENT_ID")
    google_client_secret: str = Field(default="", env="GOOGLE_CLIENT_SECRET")
    google_redirect_uri: str = Field(
        default="http://localhost:8000/api/auth/callback",
        env="GOOGLE_REDIRECT_URI"
    )

    # Database
    database_url: str = Field(default="/app/data/sync.db", env="DATABASE_URL")

    # Redis
    redis_url: str = Field(default="redis://redis:6379", env="REDIS_URL")

    # URLs
    frontend_url: str = Field(default="http://localhost:3000", env="FRONTEND_URL")
    backend_url: str = Field(default="http://localhost:8000", env="BACKEND_URL")

    # Secret key
    secret_key: str = Field(default="", env="SECRET_KEY")

    # Local sync path
    local_sync_path: str = Field(default="/sync/local", env="LOCAL_SYNC_PATH")

    # Configuration objects
    oauth: OAuthConfig = Field(default_factory=OAuthConfig)
    sync: SyncConfig = Field(default_factory=SyncConfig)
    permissions: PermissionsConfig = Field(default_factory=PermissionsConfig)
    security: SecurityConfig = Field(default_factory=SecurityConfig)
    ui: UIConfig = Field(default_factory=UIConfig)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Update nested configs with environment variables
        self.oauth.client_id = self.google_client_id
        self.oauth.client_secret = self.google_client_secret
        self.oauth.redirect_uri = self.google_redirect_uri
        self.security.secret_key = self.secret_key or os.urandom(32).hex()


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Export for convenience
settings = get_settings()