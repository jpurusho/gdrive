# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a desktop-like web application for Google Drive synchronization that allows bidirectional sync between local folders and Google Drive (both user drives and shared drives). The application runs entirely via Docker Compose with an intuitive, desktop-like UI experience.

## Key Requirements & Constraints

### Core Functionality
- **Authentication**: Google OAuth login with credentials stored via Docker secrets/volumes
- **Browse**: Navigate both local filesystem and Google Drive (user drives and shared drives)
- **Sync Profiles**: Support multiple sync configurations with per-profile filtering
- **Conflict Resolution**: When files exist in both locations, offer user choice (keep newer, keep both, create copy)
- **Filtering**: Per sync profile/folder pair filtering by folder, file type, or filename patterns
- **Progress**: Display progress bars showing sync status and file counts with chunked/resumable transfers
- **Activity Tracking**: Log all sync operations with timestamp, source, destination, and user info
- **Scheduling**: Both cron-like scheduling and event-based triggers for automatic synchronization
- **Deletion Handling**: Prompt user for permission before any deletion operations
- **Google Workspace Files**: User-selectable export format (docx/xlsx/pptx, PDF, etc.)
- **Performance**: Highly performant with chunked/resumable transfers for large files
- **Nested Folders**: Sync entire folder hierarchies unless filtered otherwise

### Technical Constraints
- **Deployment**: Must run via `docker compose up` with zero additional setup after first run
- **First Run**: Auto-open browser for OAuth or provide QR code option
- **State Management**: Track last sync timestamp and sync profiles in SQLite
- **No LLM Dependency**: Application must not require LLMs for any processing
- **Metadata**: Display file/folder sizes, bytes transferred, and other relevant information

## Architecture Notes

When implementing this application, consider:

### Technology Stack
- **Backend**: Python with FastAPI or Flask (Google Drive API, OAuth2, chunked transfer support)
- **Frontend**: Desktop-like web app using Electron-style framework (e.g., Tauri with React/Vue or Electron itself)
- **Database**: SQLite for sync profiles, state, settings, and activity logs
- **Storage**: Docker volumes/secrets for OAuth credentials
- **Scheduler**: APScheduler for cron-like scheduling + Watchdog for file system events
- **Containerization**: Docker Compose with proper volume mounting for local folder access

### Project Structure
The codebase should be organized into:
- **API Layer**: Google Drive API integration and OAuth handling
- **Sync Engine**: Core bidirectional sync logic with conflict resolution
- **UI Layer**: Web interface for browsing, configuration, and monitoring
- **Scheduler**: Background task system for periodic syncs
- **Storage**: Database models for sync state, settings, and activity logs

### Security Considerations
- OAuth tokens and credentials must be securely stored and never committed to version control
- Use environment variables or encrypted storage for sensitive data
- Implement proper error handling for authentication failures

### Development Commands

Once the codebase is developed, typical commands will be:
```bash
# Start the application
docker compose up

# Start in development mode (with live reload if configured)
docker compose up --build

# Run tests
docker compose run app pytest

# View logs
docker compose logs -f

# Stop the application
docker compose down
```

## Context Files

- **requirements.txt**: Contains the full project specification and requirements
- **README.md**: Basic project description
- **.gitignore**: Standard Python gitignore with Docker and environment exclusions

## Development Guidelines

### When Building Features
- Always prioritize user experience and intuitive design choices
- Show clear progress indicators for long-running operations
- Provide meaningful error messages with actionable guidance
- Implement proper logging for debugging and activity tracking
- Handle Google API rate limits and quota errors gracefully

### Sync Logic Implementation Details

#### Conflict Resolution
- Present UI dialog when conflicts detected with options:
  - Keep newer version (show timestamps)
  - Keep both (rename with suffix)
  - Create backup copy
  - Preview differences (for text files)

#### Deletion Handling
- Never auto-delete files
- Show confirmation dialog with file details
- Option to move to trash vs permanent delete
- Maintain deletion log for recovery

#### Performance Optimizations
- Implement chunked transfers (5-10MB chunks)
- Support resumable uploads/downloads
- Parallel transfers for multiple small files
- Delta sync for modified portions of large files
- Progress tracking at chunk level

#### Google Workspace Handling
- Detect Google Docs/Sheets/Slides
- Present export format options:
  - Microsoft Office formats (docx, xlsx, pptx)
  - PDF for archival
  - OpenDocument formats
  - Plain text/CSV where applicable
- Cache user's format preferences per file type

### Testing Strategy
- Test OAuth flow end-to-end
- Test sync scenarios: create, update, delete, rename
- Test filtering and nested folder traversal
- Test error conditions: network failures, API errors, permission issues
- Test scheduler reliability

## Sync Profiles & Scheduling

### Sync Profile Structure
Each sync profile should contain:
- Profile name and description
- Source path (local or Drive)
- Destination path (Drive or local)
- Sync direction (bidirectional, upload-only, download-only)
- Filter rules (include/exclude patterns)
- Conflict resolution preference
- Schedule configuration
- Last sync timestamp
- Active/inactive status

### Scheduling Features
- **Cron-like scheduling**: Standard cron expressions (e.g., "0 */2 * * *" for every 2 hours)
- **Event-based triggers**:
  - File system watch on local folders
  - Webhook listener for Drive changes (if available)
  - Manual trigger via UI
- **Schedule management**: Enable/disable, modify intervals, blackout periods

## UI/UX Specifications

### Desktop-like Interface Components
- **Dual-pane file browser**: Local on left, Drive on right (or configurable)
- **Drag-and-drop support**: Between panes for quick sync setup
- **Context menus**: Right-click for sync options
- **Status bar**: Current operations, connection status, last sync time
- **System tray integration**: If possible within Docker, for background operation
- **Native-like styling**: Material Design or similar for familiar experience

### First-Run Experience
1. Welcome screen explaining the app
2. OAuth setup with options:
   - "Connect with Google" button (auto-opens browser)
   - QR code for mobile device authentication
   - Manual URL copy option
3. Initial profile creation wizard
4. Tutorial overlay for main features

## Current State

This is an early-stage project. The requirements are fully specified in `requirements.txt` but no implementation code exists yet. The first steps should be:

1. Set up Docker Compose configuration with proper volumes
2. Implement Google OAuth flow with browser auto-open and QR code options
3. Build desktop-like web UI with dual-pane browser
4. Implement sync profile management system
5. Build chunked transfer engine with resume capability
6. Add conflict resolution UI dialogs
7. Implement cron scheduler and file watchers
8. Add comprehensive activity logging and progress tracking
