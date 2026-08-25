import crypto from 'node:crypto';
import { config } from './config.js';

const COOKIE = 'q_auth';
const SESSION_DAYS = 90;

export function authEnabled() {
  return Boolean(config.passcode);
}

function sign(payload) {
  return crypto.createHmac('sha256', config.passcode).update(String(payload)).digest('hex');
}

/** So sánh chống dò thời gian (timing attack). */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

export function issueToken() {
  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  return `${exp}.${sign(exp)}`;
}

export function verifyToken(token = '') {
  const [expText, signature] = String(token).split('.');
  const exp = Number(expText);
  if (!Number.isFinite(exp) || exp < Date.now() || !signature) return false;
  return safeEqual(signature, sign(exp));
}

export function checkPasscode(input) {
  return safeEqual(input ?? '', config.passcode);
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

export function setSessionCookie(req, res) {
  res.cookie(COOKIE, issueToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    maxAge: SESSION_DAYS * 86_400_000,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

export function isLoggedIn(req) {
  if (!authEnabled()) return true;
  // Web app dùng cookie phiên; tiện ích trình duyệt gửi thẳng mật khẩu qua header
  // vì cookie không đi kèm khi gọi từ extension sang máy chủ khác miền.
  if (checkPasscode(req.headers['x-passcode'])) return true;
  return verifyToken(parseCookies(req.headers.cookie).q_auth);
}

export function requireAuth(req, res, next) {
  if (isLoggedIn(req)) return next();
  res.status(401).json({ error: 'Cần nhập mật khẩu để dùng app.', code: 'auth_required' });
}

/**
 * Giới hạn tần suất theo IP, giữ trong RAM.
 * Đủ cho app một người dùng; khởi động lại là quên hết.
 */
export function createRateLimit({ windowMs, max, message }) {
  const hits = new Map();

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const key = req.ip || 'unknown';
    const entry = hits.get(key);

    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
    } else if (entry.count >= max) {
      const wait = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(wait));
      return res.status(429).json({ error: `${message} Thử lại sau ${wait}s.` });
    } else {
      entry.count += 1;
    }

    // Dọn rác định kỳ để Map không phình mãi.
    if (hits.size > 500) {
      for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
    }
    next();
  };
}
