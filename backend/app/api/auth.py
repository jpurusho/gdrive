"""
Authentication API endpoints for Google OAuth
"""
import os
import json
import secrets
import qrcode
from io import BytesIO
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Depends, Query, Response
from fastapi.responses import RedirectResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

from app.core.config import get_settings
from app.core.database import get_db, User
from app.core.logger import setup_logger

router = APIRouter()
logger = setup_logger(__name__)
settings = get_settings()

# OAuth2 flow configuration
SCOPES = settings.oauth.scopes


def get_oauth_flow(state: Optional[str] = None) -> Flow:
    """Create OAuth2 flow instance"""
    client_config = {
        "web": {
            "client_id": settings.oauth.client_id,
            "client_secret": settings.oauth.client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "redirect_uris": [settings.oauth.redirect_uri]
        }
    }

    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri=settings.oauth.redirect_uri
    )

    if state:
        flow.state = state

    return flow


@router.get("/login")
async def login():
    """
    Initiate OAuth2 login flow
    Returns the authorization URL for the user to visit
    """
    try:
        flow = get_oauth_flow()

        # Generate state token for CSRF protection
        state = secrets.token_urlsafe(32)
        flow.state = state

        authorization_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )

        return {
            "authorization_url": authorization_url,
            "state": state
        }
    except Exception as e:
        logger.error(f"Error initiating OAuth flow: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/login/qr")
async def login_qr():
    """
    Generate QR code for OAuth2 login
    """
    try:
        # Get the authorization URL
        login_data = await login()
        authorization_url = login_data["authorization_url"]

        # Generate QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(authorization_url)
        qr.make(fit=True)

        # Create image
        img = qr.make_image(fill_color="black", back_color="white")

        # Convert to bytes
        img_byte_arr = BytesIO()
        img.save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)

        return StreamingResponse(
            img_byte_arr,
            media_type="image/png",
            headers={
                "X-Authorization-URL": authorization_url,
                "X-State": login_data["state"]
            }
        )
    except Exception as e:
        logger.error(f"Error generating QR code: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/callback")
async def oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """
    OAuth2 callback endpoint
    Exchanges authorization code for access token and saves user
    """
    try:
        # Create flow with state
        flow = get_oauth_flow(state=state)

        # Exchange authorization code for tokens
        flow.fetch_token(code=code)

        # Get credentials
        credentials = flow.credentials

        # Get user info from Google
        service = build('oauth2', 'v2', credentials=credentials)
        user_info = service.userinfo().get().execute()

        # Check if user exists
        result = await db.execute(
            select(User).where(User.google_id == user_info['id'])
        )
        user = result.scalar_one_or_none()

        if user:
            # Update existing user
            user.access_token = credentials.token
            user.refresh_token = credentials.refresh_token or user.refresh_token
            user.token_expiry = credentials.expiry
            user.updated_at = datetime.utcnow()
        else:
            # Create new user
            user = User(
                email=user_info['email'],
                name=user_info.get('name'),
                google_id=user_info['id'],
                access_token=credentials.token,
                refresh_token=credentials.refresh_token,
                token_expiry=credentials.expiry
            )
            db.add(user)

        await db.commit()
        await db.refresh(user)

        # Redirect to frontend with success
        redirect_url = f"{settings.frontend_url}/auth/success?user_id={user.id}"
        return RedirectResponse(url=redirect_url)

    except Exception as e:
        logger.error(f"OAuth callback error: {e}")
        # Redirect to frontend with error
        redirect_url = f"{settings.frontend_url}/auth/error?message={str(e)}"
        return RedirectResponse(url=redirect_url)


@router.get("/user/me")
async def get_current_user(
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get current authenticated user"""
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "created_at": user.created_at.isoformat() if user.created_at else None
    }


@router.post("/refresh")
async def refresh_token(
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Refresh Google OAuth token"""
    try:
        # Get user
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Create credentials
        credentials = Credentials(
            token=user.access_token,
            refresh_token=user.refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.oauth.client_id,
            client_secret=settings.oauth.client_secret,
            scopes=SCOPES
        )

        # Refresh token if expired
        if credentials.expired and credentials.refresh_token:
            credentials.refresh(Request())

            # Update user tokens
            user.access_token = credentials.token
            user.token_expiry = credentials.expiry
            user.updated_at = datetime.utcnow()

            await db.commit()

        return {
            "success": True,
            "token_expiry": user.token_expiry.isoformat() if user.token_expiry else None
        }

    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/logout")
async def logout(
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Logout user by clearing tokens"""
    try:
        # Get user
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Clear tokens
        user.access_token = None
        user.refresh_token = None
        user.token_expiry = None
        user.updated_at = datetime.utcnow()

        await db.commit()

        return {"success": True, "message": "Logged out successfully"}

    except Exception as e:
        logger.error(f"Logout error: {e}")
        raise HTTPException(status_code=500, detail=str(e))