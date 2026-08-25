import express from 'express';
import { config, hasClaude } from './config.js';
import { availableProviders, translateText } from './translate.js';
import { providerStatus } from './providers/index.js';
import { GLOSSARY, QUICK_PHRASES } from './glossary.js';

const app = express();

app.use(express.json({ limit: '256kb' }));
app.use(
  express.static(config.publicDir, {
    setHeaders(res, filePath) {
      // Service worker phải luôn được kiểm tra lại, không cache cứng.
      if (filePath.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
    },
  })
);

app.get('/api/health', (req, res) => {
  res.json({
    ok: availableProviders().length > 0,
    provider: config.provider,
    fallback: config.fallbackProvider,
    active: availableProviders(),
    providers: providerStatus(),
    model: hasClaude() ? config.anthropic.model : null,
    maxInputChars: config.maxInputChars,
  });
});

app.get('/api/phrases', (req, res) => res.json({ groups: QUICK_PHRASES }));

app.get('/api/glossary', (req, res) => res.json({ terms: GLOSSARY }));

app.post('/api/translate', async (req, res) => {
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
  if (!hasClaude()) {
    console.log('  Mẹo: thêm ANTHROPIC_API_KEY vào .env để dịch chuẩn tiếng lóng 1688.');
  }
  console.log('  Mở trên điện thoại: dùng IP LAN của máy này, ví dụ http://192.168.1.x:' + config.port + '\n');
});
