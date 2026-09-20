import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer as createViteServer } from 'vite';
import { createApi } from './api.js';
import { FileScoreStore } from './store.js';

await mkdir('.local', { recursive: true });
let secret: string;
try { secret = await readFile('.local/session-secret', 'utf8'); }
catch { secret = randomBytes(48).toString('base64url'); await writeFile('.local/session-secret', secret, { mode: 0o600 }); }
const app = createApi({ store: new FileScoreStore(resolve('.local/leaderboard.json')), secret, production: false });
const server = createServer(app);
const vite = await createViteServer({ server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
app.use(vite.middlewares);
server.listen(5173, '0.0.0.0', () => console.log('Jihan game preview: http://localhost:5173'));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void vite.close(); server.close(() => process.exit(0)); });
