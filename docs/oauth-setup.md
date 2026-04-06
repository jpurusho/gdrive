# Google OAuth Setup & Authentication Flow

## How Authentication Works

gsync uses Google's OAuth 2.0 protocol to access Google Drive on behalf of each user. There are two sets of credentials involved:

| Credential | Belongs to | Created by | Purpose |
|-----------|-----------|------------|---------|
| **Client ID + Secret** | The app (gsync) | Developer (one-time) | Identifies gsync to Google — "this request is from gsync" |
| **Access Token + Refresh Token** | Each user | Google (after user approves) | Grants gsync access to that user's Drive |

The Client ID and Secret are embedded in the app at build time. Users never need to see or enter them. Each user signs in with their own Google account and gets their own tokens.

## Authentication Flow

```mermaid
sequenceDiagram
    participant App as gsync App
    participant Server as Local HTTP Server
    participant Browser as System Browser
    participant Google as Google OAuth

    Note over App: User clicks "Sign in with Google"

    App->>Server: Start HTTP server on localhost:48620-48640
    App->>Browser: Open Google OAuth URL<br/>(includes Client ID + scopes)

    Browser->>Google: User enters email + password
    Google->>Google: Verify user identity (password, 2FA, passkey)
    Google->>Browser: Show consent screen:<br/>"gsync wants to access your Drive"
    Browser->>Google: User clicks "Allow"

    Google->>Server: Redirect to localhost:PORT/callback?code=AUTH_CODE
    Server->>Browser: Show "Signed in successfully" page

    Note over App: Exchange auth code for tokens

    App->>Google: POST token request:<br/>Client ID + Client Secret + Auth Code
    Google->>Google: Verify Client ID is valid<br/>Verify Secret matches<br/>Verify Code was issued for this Client
    Google->>App: Return access_token (1hr) + refresh_token (permanent)

    App->>App: Save tokens to SQLite

    Note over App: Now gsync can access user's Drive

    App->>Google: Drive API calls with access_token
    Google->>App: Drive files and folders

    Note over App: When access_token expires (~1 hour)

    App->>Google: Send refresh_token + Client ID + Secret
    Google->>App: New access_token
    App->>App: Save new token to SQLite
```

## Who Provides What

```mermaid
graph LR
    subgraph Developer [Developer — one time]
        CID[Client ID]
        CS[Client Secret]
    end

    subgraph Google [Google — per user]
        AC[Auth Code<br/>one-time, expires in minutes]
        AT[Access Token<br/>short-lived, ~1 hour]
        RT[Refresh Token<br/>long-lived, permanent]
    end

    subgraph User [User — signs in once]
        PW[Password + 2FA<br/>never touches the app]
    end

    subgraph App [gsync App]
        DB[(SQLite DB)]
    end

    CID -->|embedded at build time| App
    CS -->|embedded at build time| App
    PW -->|entered in browser only| Google
    Google -->|auth code via redirect| App
    Google -->|tokens after code exchange| App
    App -->|stores| DB

    style Developer fill:#1a1a2e,stroke:#6366f1,color:#e2e8f0
    style Google fill:#1a1a2e,stroke:#10b981,color:#e2e8f0
    style User fill:#1a1a2e,stroke:#f59e0b,color:#e2e8f0
    style App fill:#1a1a2e,stroke:#8b5cf6,color:#e2e8f0
```

## Token Lifecycle

```mermaid
stateDiagram-v2
    [*] --> NoTokens: App installed
    NoTokens --> SigningIn: User clicks "Sign in"
    SigningIn --> HasTokens: Google returns tokens
    HasTokens --> UsingDrive: Access token valid
    UsingDrive --> Refreshing: Access token expired (~1hr)
    Refreshing --> UsingDrive: New access token obtained
    Refreshing --> NoTokens: Refresh token revoked
    UsingDrive --> NoTokens: User clicks "Sign out"
    HasTokens --> NoTokens: User clicks "Sign out"
```

## Security Model

- **User's password** never touches gsync — it's entered directly in Google's page in the system browser
- **Client Secret** is embedded in the app binary — Google classifies desktop apps as "public clients" and accounts for this. The real security is the user clicking "Allow" on Google's consent screen
- **Tokens are stored locally** in SQLite on the user's machine — never transmitted to any server other than Google
- **Refresh tokens** can be revoked by the user at any time via Google Account settings → Security → Third-party apps
- **Safe sync mode** — even with full Drive access tokens, gsync never deletes files

## Prerequisites

- A Google Cloud Platform account
- A GCP project ([console.cloud.google.com](https://console.cloud.google.com))

## Developer Setup (One Time)

### 1. Enable the Google Drive API

1. Go to **APIs & Services > Library**
2. Search for "Google Drive API"
3. Click **Enable**

### 2. Configure OAuth Consent Screen

1. Go to **APIs & Services > OAuth consent screen**
2. Select **External** user type (or Internal for Workspace orgs)
3. Fill in:
   - App name: `gsync`
   - User support email: your email
   - Developer contact: your email
4. Add scopes:
   - `https://www.googleapis.com/auth/drive`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
5. Add test users (anyone who needs to sign in while app is in Testing mode)

### 3. Create OAuth Credentials

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth 2.0 Client ID**
3. Application type: **Desktop app**
4. Name: `gsync`
5. Click **Create**
6. Copy the **Client ID** and **Client Secret**

### 4. Configure for Development

Create a `.env` file in the project root:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
GSYNC_UPDATE_TOKEN=github_pat_your-token  # optional, for auto-updates
```

### 5. Configure for CI/CD

Add as GitHub repository secrets:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GSYNC_UPDATE_TOKEN` (optional)

These are embedded into the app at build time via `dist/oauth-config.json`.

### 6. Add Test Users

Until your app passes Google's OAuth verification review:
- Go to **OAuth consent screen > Test users**
- Add each user's email
- Maximum 100 test users
- Users not in this list will see "Access blocked"

## User Experience

For end users who download the packaged app:

1. Open gsync
2. Click **"Sign in with Google"**
3. Browser opens → sign in with their Google account → click Allow
4. Browser shows "Signed in successfully — you can close this tab"
5. gsync loads their Drive

No credentials to enter, no setup required.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Access blocked" | User's email not in test users list. Add in OAuth consent screen. |
| "invalid_client" | Client ID or Secret is wrong. Check Settings > Google OAuth Credentials. |
| "redirect_uri_mismatch" | Ensure OAuth client type is Desktop app (not Web). |
| Token refresh fails | Sign out and sign in again. Refresh tokens can be invalidated by Google. |
| "API not enabled" | Enable Google Drive API in GCP Console > APIs & Services > Library. |
| Stuck on passkey screen | System browser handles this natively. Choose password if passkey fails. |
