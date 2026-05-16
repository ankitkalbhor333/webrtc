function resolveServiceUrl(envValue, localDefault) {
  const raw = envValue || localDefault;
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw.replace(/\/$/, '');
  }
  return `https://${raw.replace(/\/$/, '')}`;
}

export const API_URL = resolveServiceUrl(
  import.meta.env.VITE_API_URL,
  'http://localhost:3000'
);

export const SOCKET_URL = resolveServiceUrl(
  import.meta.env.VITE_SOCKET_URL,
  'http://localhost:3000'
);
