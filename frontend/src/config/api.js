function resolveServiceUrl(envValue, localDefault) {
  const raw = envValue || localDefault;
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw.replace(/\/$/, '');
  }
  return `https://${raw.replace(/\/$/, '')}`;
}

function readRuntimeConfig() {
  if (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__) {
    return window.__RUNTIME_CONFIG__;
  }
  return { API_URL: '', SOCKET_URL: '' };
}

/** Known Render hostname → API URL (used when env vars are missing at build). */
const RENDER_API_BY_FRONTEND_HOST = {
  'webrtc-1-fzsr.onrender.com': 'https://webrtc-nn8s.onrender.com',
};

/** Infer API URL on Render when env vars were not set at build time. */
function inferRenderServiceUrl() {
  if (typeof window === 'undefined') return null;

  const { hostname, protocol } = window.location;
  if (!hostname.endsWith('.onrender.com')) return null;

  if (RENDER_API_BY_FRONTEND_HOST[hostname]) {
    return RENDER_API_BY_FRONTEND_HOST[hostname];
  }

  if (hostname.includes('-frontend')) {
    return `${protocol}//${hostname.replace('-frontend', '-api')}`;
  }

  return null;
}

function resolveUrl({ runtimeKey, viteKey, localDefault }) {
  const runtime = readRuntimeConfig();
  const fromRuntime = runtime[runtimeKey];
  const fromVite = import.meta.env[viteKey];
  const raw = fromRuntime || fromVite;

  if (raw) {
    return resolveServiceUrl(raw, localDefault);
  }

  const inferred = inferRenderServiceUrl();
  if (inferred) {
    return inferred;
  }

  return localDefault;
}

export const API_URL = resolveUrl({
  runtimeKey: 'API_URL',
  viteKey: 'VITE_API_URL',
  localDefault: 'http://localhost:3000',
});

export const SOCKET_URL = resolveUrl({
  runtimeKey: 'SOCKET_URL',
  viteKey: 'VITE_SOCKET_URL',
  localDefault: 'http://localhost:3000',
});
