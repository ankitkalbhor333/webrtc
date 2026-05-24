import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const api = process.env.VITE_API_URL || '';
const socket = process.env.VITE_SOCKET_URL || '';

const content = `// Auto-generated at build time
window.__RUNTIME_CONFIG__ = {
  API_URL: ${JSON.stringify(api)},
  SOCKET_URL: ${JSON.stringify(socket)},
};
`;

writeFileSync(join(root, 'public/runtime-config.js'), content);
console.log('[build] runtime-config.js', {
  API_URL: api || '(will use Render hostname fallback)',
  SOCKET_URL: socket || '(will use Render hostname fallback)',
});
