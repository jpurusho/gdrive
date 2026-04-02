import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppThemeProvider } from './theme/ThemeContext';
import { AppSettingsProvider } from './context/AppSettingsContext';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppThemeProvider>
      <AppSettingsProvider>
        <App />
      </AppSettingsProvider>
    </AppThemeProvider>
  </React.StrictMode>,
);
