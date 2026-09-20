import { env } from 'cloudflare:workers';
import { httpServerHandler } from 'cloudflare:node';
import { createApi } from '../functions/src/api.js';
import { D1ScoreStore } from './store.js';

const bindings = env as unknown as { DB: D1Database; SESSION_SECRET: string };
if (!bindings.SESSION_SECRET || bindings.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET must be configured');
const app = createApi({
  store: new D1ScoreStore(bindings.DB),
  secret: bindings.SESSION_SECRET,
  production: true,
  // Cloudflare overwrites this header at the edge; Node's socket is virtual here.
  clientAddress: req => req.get('CF-Connecting-IP') || 'unknown',
});
app.listen(3000);
export default httpServerHandler({ port: 3000 });
