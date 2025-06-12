export const environment = {
  production: import.meta.env.PROD || false,
  wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:8000',
  sentryDsn: import.meta.env.VITE_SENTRY_DSN,
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY,
  debug: import.meta.env.DEV || false
};

export const wsConfig = {
  reconnectInterval: 1000,
  maxRetries: 5
};
