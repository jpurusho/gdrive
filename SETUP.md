# Google Drive Sync - Setup Guide

## Prerequisites

1. **Docker and Docker Compose** installed on your system
2. **Google Cloud Console** account with a project
3. **Google Drive API** enabled for your project
4. **OAuth 2.0 credentials** configured

## Step 1: Google Cloud Setup

### 1.1 Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project ID

### 1.2 Enable Google Drive API

1. In the Cloud Console, go to **APIs & Services** > **Library**
2. Search for "Google Drive API"
3. Click on it and press **Enable**

### 1.3 Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
3. If prompted, configure the OAuth consent screen:
   - Choose "External" for user type
   - Fill in required fields (app name, user support email, developer contact)
   - Add scopes:
     - `https://www.googleapis.com/auth/drive`
     - `https://www.googleapis.com/auth/drive.file`
     - `https://www.googleapis.com/auth/drive.metadata.readonly`
   - Add test users if in testing mode

4. For Application type, select **Web application**
5. Add authorized redirect URIs:
   - `http://localhost:8000/api/auth/callback`
   - `http://localhost:3000/auth/success`

6. Click **Create**
7. Download the credentials JSON file
8. Note the **Client ID** and **Client Secret**

## Step 2: Application Setup

### 2.1 Clone the Repository

```bash
git clone <your-repo-url>
cd gdrive
```

### 2.2 Configure Environment Variables

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` file with your credentials:
```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here

# Local sync path (absolute path on host machine)
LOCAL_SYNC_PATH=/path/to/your/local/sync/folder

# Application Secret Key (generate a strong random key)
SECRET_KEY=your-secret-key-here
```

3. Generate a secret key:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### 2.3 Create Local Directories

```bash
# Create data directory for SQLite database
mkdir -p data

# Create your local sync directory
mkdir -p /path/to/your/local/sync/folder
```

## Step 3: Build and Run with Docker Compose

### 3.1 Build the containers

```bash
docker compose build
```

### 3.2 Start the application

```bash
docker compose up
```

The application will start:
- Backend API: http://localhost:8000
- Frontend UI: http://localhost:3000
- Redis: localhost:6379

### 3.3 First-time Setup

1. The browser should automatically open to http://localhost:3000
2. Click **"Sign in with Google"**
3. Authorize the application to access your Google Drive
4. You'll be redirected back to the dashboard

## Step 4: Create Your First Sync Profile

1. Click the **"+"** button in the toolbar
2. Fill in the profile details:
   - **Name**: Give your sync profile a name (e.g., "Documents Backup")
   - **Source Path**: Local path (e.g., `/sync/local/documents`) or Drive path (e.g., `drive://folder-id`)
   - **Destination Path**: Drive path (e.g., `drive://root`) or local path
   - **Sync Direction**: Choose bidirectional, upload only, or download only
   - **Conflict Resolution**: How to handle file conflicts

3. Click **"Create Profile"**

## Step 5: Start Syncing

1. Select your profile from the dropdown
2. Click **"Start Sync"** button
3. Monitor progress in the progress bar

## Troubleshooting

### Common Issues

1. **OAuth Error**: Make sure redirect URIs match exactly in Google Cloud Console
2. **Permission Denied**: Check that LOCAL_SYNC_PATH is accessible by Docker
3. **Database Error**: Ensure `data` directory exists and is writable
4. **Connection Refused**: Check that all containers are running with `docker compose ps`

### Checking Logs

```bash
# View all logs
docker compose logs

# View specific service logs
docker compose logs backend
docker compose logs frontend
docker compose logs scheduler

# Follow logs in real-time
docker compose logs -f
```

### Resetting the Application

```bash
# Stop all containers
docker compose down

# Remove all data (WARNING: This deletes all sync profiles and history)
rm -rf data/*

# Restart
docker compose up
```

## Development Mode

For development with hot-reload:

```bash
# Backend development (with auto-reload)
docker compose up backend

# Frontend development (in separate terminal)
cd frontend
npm install
npm start
```

## Security Notes

1. **Never commit** your `.env` file or credentials to version control
2. **Use strong secret keys** in production
3. **Restrict OAuth scopes** to minimum required permissions
4. **Enable HTTPS** in production environments
5. **Regularly rotate** your OAuth credentials

## Advanced Configuration

### Scheduling Sync

Profiles support cron-like scheduling:
- Edit profile and add schedule: `0 */2 * * *` (every 2 hours)
- Enable file watchers for real-time sync

### Filtering Files

Add filter rules to profiles:
- Include patterns: `*.docx`, `*.pdf`
- Exclude patterns: `~*`, `.DS_Store`, `*.tmp`

### Export Formats for Google Workspace

Configure export formats in settings:
- Google Docs → DOCX, PDF, or TXT
- Google Sheets → XLSX, CSV, or PDF
- Google Slides → PPTX or PDF

## Support

For issues or questions, please check:
- Application logs: `docker compose logs`
- Database: `data/sync.db`
- GitHub Issues: [Create an issue](https://github.com/your-repo/issues)