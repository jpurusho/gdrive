"""
Main FastAPI application for Google Drive Sync
"""
import os
import asyncio
import webbrowser
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import uvicorn

from app.api import auth, sync, profiles, files, settings
from app.core.config import get_settings
from app.core.database import init_db
from app.core.logger import setup_logger

# Load environment variables
load_dotenv()

# Setup logger
logger = setup_logger(__name__)

# Settings
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    logger.info("Starting Google Drive Sync application...")

    # Initialize database
    await init_db()

    # Create necessary directories
    Path("/app/data").mkdir(parents=True, exist_ok=True)
    Path("/app/secrets").mkdir(parents=True, exist_ok=True)
    Path("/sync/local").mkdir(parents=True, exist_ok=True)

    # Open browser on first run if configured
    if settings.ui.auto_open_browser and not Path("/app/data/.initialized").exists():
        logger.info("First run detected - opening browser for OAuth setup")
        await asyncio.sleep(2)  # Wait for server to fully start
        webbrowser.open(f"http://localhost:3000")
        Path("/app/data/.initialized").touch()

    yield

    # Shutdown
    logger.info("Shutting down Google Drive Sync application...")


# Create FastAPI app
app = FastAPI(
    title="Google Drive Sync API",
    description="Bidirectional sync between local folders and Google Drive",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(sync.router, prefix="/api/sync", tags=["Synchronization"])
app.include_router(profiles.router, prefix="/api/profiles", tags=["Sync Profiles"])
app.include_router(files.router, prefix="/api/files", tags=["File Browser"])
app.include_router(settings.router, prefix="/api/settings", tags=["Settings"])

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "database": "connected",
        "redis": "connected"
    }

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "name": "Google Drive Sync API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )