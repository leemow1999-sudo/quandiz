import express from 'express';
import { config, hasClaude } from './config.js';
import { availableProviders, translateText } from './translate.js';
import { providerStatus } from './providers/index.js';
import { GLOSSARY, QUICK_PHRASES } from './glossary.js';
import {
  authEnabled,
  checkPasscode,
  clearSessionCookie,
  createRateLimit,
  isLoggedIn,
  requireAuth,
  setSessionCookie,
} from './auth.js';

const app = express();

// Sau reverse proxy (Render, Fly, Cloudflare) thì req.ip và req.secure mới đúng.
app.set('trust proxy', 1);

app.use(express.json({ limit: '256kb' }));
app.use(
  express.static(config.publicDir, {
    setHeaders(res, filePath) {
      // Service worker phải luôn được kiểm tra lại, không cache cứng.
      if (filePath.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
    },
  })
);

const loginLimit = createRateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  message: 'Sai mật khẩu quá nhiều lần.',
});

const translateLimit = createRateLimit({
  windowMs: 60_000,
  max: 60,
  message: 'Dịch quá nhanh.',
});

/* ---------- Công khai ---------- */

app.get('/api/health', (req, res) => {
  res.json({
    ok: availableProviders().length > 0,
    authRequired: authEnabled(),
    authed: isLoggedIn(req),
    provider: config.provider,
    fallback: config.fallbackProvider,
    active: availableProviders(),
    providers: providerStatus(),
    model: hasClaude() ? config.anthropic.model : null,
    maxInputChars: config.maxInputChars,
  });
});

app.post('/api/login', loginLimit, (req, res) => {
  if (!authEnabled()) return res.json({ ok: true, authRequired: false });
  if (!checkPasscode(req.body?.passcode)) {
    return res.status(401).json({ error: 'Mật khẩu không đúng.' });
  }
  setSessionCookie(req, res);
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

/* ---------- Cần đăng nhập ---------- */

app.get('/api/phrases', requireAuth, (req, res) => res.json({ groups: QUICK_PHRASES }));

app.get('/api/glossary', requireAuth, (req, res) => res.json({ terms: GLOSSARY }));

app.post('/api/translate', requireAuth, translateLimit, async (req, res) => {
  const { text, direction, context } = req.body ?? {};
  try {
    const result = await translateText({ text, direction, context });
    res.json(result);
  } catch (err) {
    const status = err.status ?? 500;
    if (status >= 500) console.error('[translate]', err.message);
    res.status(status).json({ error: err.message });
  }
});

app.use((req, res) => res.status(404).json({ error: 'Không tìm thấy' }));

// eslint-disable-next-line no-unused-vars -- Express nhận diện error handler qua 4 tham số
app.use((err, req, res, next) => {
  console.error('[server]', err);
  res.status(500).json({ error: 'Lỗi máy chủ' });
});

app.listen(config.port, config.host, () => {
  const ready = availableProviders();
  console.log(`\n  1688 Dịch Chat — http://localhost:${config.port}`);
  console.log(`  Công cụ dịch: ${ready.length ? ready.join(' -> ') : 'CHƯA CẤU HÌNH'}`);
  console.log(`  Mật khẩu: ${authEnabled() ? 'BẬT (APP_PASSCODE)' : 'tắt — chỉ nên vậy khi chạy ở máy nhà'}`);
  if (!hasClaude()) {
    console.log('  Mẹo: thêm ANTHROPIC_API_KEY vào .env để dịch chuẩn tiếng lóng 1688.');
  }
  console.log('  Mở trên điện thoại: dùng IP LAN của máy này, ví dụ http://192.168.1.x:' + config.port + '\n');
});
