/// <reference lib="dom" />

// Disable WebAuthn/Passkey APIs in the Google auth window.
// Without these, Google falls back to password + phone/app-based 2FA,
// which works reliably inside Electron's BrowserWindow.
//
// This is needed because:
// 1. In dev mode (launched from terminal), macOS denies FIDO/Bluetooth access
// 2. Even packaged apps need specific entitlements for passkeys
// 3. Standard 2FA (phone prompt, authenticator app, SMS) works perfectly in-app

try {
  Object.defineProperty(navigator, 'credentials', {
    value: undefined,
    writable: false,
    configurable: false,
  });
} catch {
  // Fallback: overwrite individual methods
  try {
    const creds = navigator.credentials;
    if (creds) {
      (creds as any).get = () => Promise.reject(new DOMException('Not supported', 'NotSupportedError'));
      (creds as any).create = () => Promise.reject(new DOMException('Not supported', 'NotSupportedError'));
    }
  } catch {
    // Best effort
  }
}

// Also remove PublicKeyCredential so feature-detection fails cleanly
try {
  Object.defineProperty(window, 'PublicKeyCredential', {
    value: undefined,
    writable: false,
    configurable: false,
  });
} catch {
  // Best effort
}
