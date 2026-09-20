import express, { type Request, type Response, type NextFunction } from 'express';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { RULES_VERSION, normalizeName, validateRun, type InputEvent } from './shared/rules.js';
import { insertScore } from './shared/leaderboard.js';
import type { ScoreStore } from './store.js';

const YEAR_SECONDS = 365 * 24 * 60 * 60;
const RUN_LIFETIME = 30 * 60 * 1000;
type Session = { kind: 'guest'; uid: string; expiresAt: number };
type RunTicket = { kind: 'run'; guestId: string; owner: string; name: string; seed: number; issuedAt: number; runId: string; rules: string };
export function signToken(value: object, secret: string): string {
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}
export function verifyToken<T>(token: unknown, secret: string): T {
  if (typeof token !== 'string' || token.length > 3000) throw new Error('세션을 확인할 수 없어요. 다시 시작해 주세요.');
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) throw new Error('올바르지 않은 세션입니다.');
  const expected = createHmac('sha256', secret).update(payload).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('세션이 변경되었어요. 다시 시작해 주세요.');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}
function profileId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9-]{36}$/i.test(value)) throw new Error('캐릭터를 다시 선택해 주세요.');
  return value;
}

export function createApi(options: { store: ScoreStore; secret: string; production: boolean; clientAddress?: (req: Request) => string }) {
  const app = express();
  function existingSession(req: Request): Session | undefined {
    const encoded = req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith('__session='))?.slice(10);
    if (!encoded) return;
    try {
      const value = verifyToken<Session>(encoded, options.secret);
      if (value.kind === 'guest' && typeof value.uid === 'string' && value.expiresAt > Date.now()) return value;
    } catch { /* An invalid/expired cookie has no authority. */ }
  }
  app.disable('x-powered-by');
  app.use(express.json({ limit: '200kb' }));
  app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('X-Content-Type-Options', 'nosniff'); next(); });
  // Per-instance protection; the Cloudflare account's free quotas remain the hard limits.
  const attempts = new Map<string, { count: number; reset: number }>();
  app.use((req, res, next) => {
    if (req.method === 'POST' && req.get('sec-fetch-site') === 'cross-site') { res.status(403).json({ error: '게임 화면에서 다시 시도해 주세요.' }); return; }
    if (req.method === 'POST' && !req.is('application/json')) { res.status(415).json({ error: '올바르지 않은 요청입니다.' }); return; }
    const guest = existingSession(req);
    const address = options.clientAddress?.(req) || req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${guest ? `guest:${guest.uid}` : `network:${address}`}:${req.method}`;
    const now = Date.now();
    if (attempts.size > 4000) for (const [id, value] of attempts) if (value.reset < now) attempts.delete(id);
    let entry = attempts.get(key);
    if (!entry || entry.reset < now) { entry = { count: 0, reset: now + 60_000 }; attempts.set(key, entry); }
    if (++entry.count > (req.method === 'POST' ? 100 : 240)) { res.status(429).json({ error: '조금 쉬었다가 다시 해주세요.' }); return; }
    next();
  });

  function session(req: Request, res: Response): Session {
    const existing = existingSession(req);
    if (existing) return existing;
    const value: Session = { kind: 'guest', uid: randomUUID(), expiresAt: Date.now() + YEAR_SECONDS * 1000 };
    // Same-origin, signed guest cookie: no account or server-side session table.
    res.cookie('__session', signToken(value, options.secret), { httpOnly: true, secure: options.production, sameSite: 'lax', maxAge: YEAR_SECONDS * 1000, path: '/' });
    return value;
  }
  function owner(uid: string, id: string): string { return createHmac('sha256', options.secret).update(`${uid}:${id}`).digest('hex'); }

  app.get('/api/leaderboard', async (req, res) => {
    // Reading public rankings must not replace a cookie issued by a concurrent start request.
    const guest = existingSession(req);
    let mine = '';
    if (guest && req.query.profileId) mine = owner(guest.uid, profileId(req.query.profileId));
    const rows = await options.store.read();
    res.json({ local: !options.production, entries: rows.map((row, i) => ({ rank: i + 1, name: row.name, score: row.score, mine: row.playerKey === mine })) });
  });
  app.post('/api/start', (req, res) => {
    const guest = session(req, res);
    const ticket: RunTicket = {
      kind: 'run', guestId: guest.uid, owner: owner(guest.uid, profileId(req.body.profileId)), name: normalizeName(req.body.name),
      seed: randomBytes(4).reduce((value, byte, index) => value + byte * 2 ** (index * 8), 0), issuedAt: Date.now(), runId: randomUUID(), rules: RULES_VERSION,
    };
    res.json({ seed: ticket.seed, token: signToken(ticket, options.secret) });
  });
  app.post('/api/score', async (req, res) => {
    const ticket = verifyToken<RunTicket>(req.body.token, options.secret);
    const guest = session(req, res);
    const elapsed = Date.now() - ticket.issuedAt;
    if (ticket.kind !== 'run' || ticket.rules !== RULES_VERSION || elapsed < 0 || elapsed > RUN_LIFETIME) throw new Error('기록 제출 시간이 지났어요. 다음 게임에서 다시 도전해 주세요.');
    if (ticket.guestId !== guest.uid) throw new Error('다른 플레이어의 기록입니다.');
    const score = validateRun(ticket.seed, req.body.inputs as InputEvent[], elapsed);
    if (score === 0) { res.json({ score: 0, rank: null }); return; }
    const rows = await options.store.update(before => insertScore(before, { playerKey: ticket.owner, name: ticket.name, score, achievedAt: Date.now(), runId: ticket.runId }));
    const index = rows.findIndex(row => row.playerKey === ticket.owner);
    res.json({ score, rank: index < 0 ? null : index + 1 });
  });
  app.post('/api/profile/delete', async (req, res) => {
    const guest = session(req, res);
    const key = owner(guest.uid, profileId(req.body.profileId));
    await options.store.update(rows => rows.filter(row => row.playerKey !== key));
    res.json({ ok: true });
  });
  app.use('/api', (_req, res) => { res.status(404).json({ error: '요청한 기능을 찾을 수 없어요.' }); });
  app.use((error: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    const expected = error instanceof SyntaxError || error.message.includes('요') || error.message.includes('입니다') || (error.status !== undefined && error.status >= 400 && error.status < 500);
    if (!expected) console.error('Game API failed:', error.name);
    res.status(error.status || (expected ? 400 : 500)).json({ error: expected ? error.message : '잠시 연결이 어려워요. 다시 시도해 주세요.' });
  });
  return app;
}
