import crypto from 'node:crypto';
import express from 'express';
import { config } from '../config.js';
import { createRateLimit, requireAuth } from '../auth.js';
import * as engine from './engine.js';
import * as store from './store.js';
import { loadKnowledge } from './knowledge.js';

function secretMatches(input) {
  const a = Buffer.from(String(input ?? ''));
  const b = Buffer.from(config.bot.webhookSecret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createBotRouter() {
  const router = express.Router();

  /* ---------- Webhook Pancake gọi vào ---------- */

  // Pancake không ký webhook nên đường dẫn chứa chuỗi bí mật: /webhook/pancake/<PANCAKE_WEBHOOK_SECRET>
  const checkSecret = (req, res, next) => {
    if (!engine.webhookEnabled() || !secretMatches(req.params.secret)) {
      return res.status(404).json({ error: 'Không tìm thấy' });
    }
    next();
  };

  // Nút "kiểm tra URL" trong Pancake có thể gọi GET.
  router.get('/webhook/pancake/:secret', checkSecret, (req, res) => res.json({ ok: true }));

  router.post(
    '/webhook/pancake/:secret',
    checkSecret,
    express.json({ limit: '2mb' }),
    (req, res) => {
      // Trả 200 ngay (Pancake tạm khoá webhook nếu lỗi/chậm nhiều), xử lý sau.
      res.json({ ok: true });
      try {
        const result = engine.handleWebhook(req.body);
        if (process.env.BOT_DEBUG) console.log('[bot] webhook', req.body?.event_type, '→', result);
      } catch (err) {
        console.error('[bot] webhook lỗi:', err);
      }
    }
  );

  /* ---------- API cho trang quản trị /bot ---------- */

  const testLimit = createRateLimit({ windowMs: 60_000, max: 20, message: 'Thử quá nhanh.' });

  // Router này gắn trước bộ đọc JSON chung (để webhook có giới hạn riêng), nên tự đọc body.
  router.use('/api/bot', express.json({ limit: '256kb' }));

  router.get('/api/bot/status', requireAuth, (req, res) => {
    const s = engine.status();
    const origin = `${req.protocol}://${req.get('host')}`;
    res.json({
      ...s,
      webhookUrl: s.webhookEnabled ? `${origin}/webhook/pancake/${config.bot.webhookSecret}` : null,
    });
  });

  router.post('/api/bot/mode', requireAuth, (req, res) => {
    try {
      engine.setMode(String(req.body?.mode ?? ''));
      res.json(engine.status());
    } catch (err) {
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  router.get('/api/bot/log', requireAuth, (req, res) => {
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 100, 300);
    res.json({ entries: store.getLog(limit) });
  });

  router.get('/api/bot/knowledge', requireAuth, (req, res) => {
    res.json({ file: config.bot.knowledgeFile, text: loadKnowledge() });
  });

  router.post('/api/bot/resume', requireAuth, (req, res) => {
    const { pageId, conversationId } = req.body ?? {};
    if (!pageId || !conversationId) return res.status(400).json({ error: 'Thiếu pageId / conversationId.' });
    engine.resumeConversation(String(pageId), String(conversationId));
    res.json({ ok: true });
  });

  router.post('/api/bot/test', requireAuth, testLimit, async (req, res) => {
    try {
      res.json(await engine.testReply(req.body ?? {}));
    } catch (err) {
      const status = err.status ?? 500;
      if (status >= 500) console.error('[bot] test:', err.message);
      res.status(status).json({ error: err.message });
    }
  });

  return router;
}
