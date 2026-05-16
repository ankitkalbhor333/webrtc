const LOCAL_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

function normalizeOrigin(origin) {
  const trimmed = origin?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function getAllowedOrigins() {
  const fromEnv = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map(normalizeOrigin).filter(Boolean)
    : [];

  return [...new Set([...LOCAL_ORIGINS, ...fromEnv])];
}

function isRenderFrontend(origin) {
  try {
    const { hostname } = new URL(origin);
    return hostname.endsWith('.onrender.com');
  } catch {
    return false;
  }
}

export function corsOrigin(origin, callback) {
  if (!origin) {
    return callback(null, true);
  }

  const allowed = getAllowedOrigins();
  if (allowed.includes(origin)) {
    return callback(null, true);
  }

  if (process.env.NODE_ENV === 'production' && isRenderFrontend(origin)) {
    return callback(null, true);
  }

  return callback(new Error(`CORS blocked: ${origin}`));
}
