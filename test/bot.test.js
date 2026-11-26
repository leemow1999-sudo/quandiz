/**
 * Kiểm thử chatbot từ đầu tới cuối với Pancake giả và Claude giả (không tốn tiền, không cần mạng).
 * Chạy: npm test
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const PAGE_ID = '111222333';
const PAGE_TOKEN = 'page-token-xyz';
const SECRET = 'test-secret-0123456789';
const TAG_ID = 7;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-test-'));
const kbFile = path.join(tmp, 'knowledge.md');
fs.writeFileSync(kbFile, '# Shop Test\n- Áo thun: 159.000đ, size S M L\n');

/* ---------- Pancake giả ---------- */

const pancake = {
  calls: [],
  histories: new Map(), // conversationId -> messages (mới → cũ, như API thật)
  sentCount: 0,
  onSend: null,
};

function json(res, code, data) {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => resolve(raw ? JSON.parse(raw) : null));
  });
}

const pancakeServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const body = await readBody(req);
  pancake.calls.push({ method: req.method, path: url.pathname, token: url.searchParams.get('page_access_token'), body });
  if (url.searchParams.get('page_access_token') !== PAGE_TOKEN) return json(res, 200, { success: false, message: 'Invalid access_token' });

  let m;
  if (req.method === 'GET' && url.pathname === `/pages/${PAGE_ID}/tags`) {
    return json(res, 200, { tags: [{ id: 3, text: 'VIP' }, { id: TAG_ID, text: 'Cần nhân viên' }] });
  }
  if ((m = url.pathname.match(/^\/pages\/[^/]+\/conversations\/([^/]+)\/messages$/))) {
    const convId = decodeURIComponent(m[1]);
    if (req.method === 'GET') {
      return json(res, 200, {
        success: true,
        conversation_id: convId,
        conv_from: { id: `cus_${convId}`, name: 'Lan Anh' },
        customers: [{ id: `pc_${convId}`, name: 'Lan Anh', can_inbox: true }],
        messages: pancake.histories.get(convId) ?? [],
      });
    }
    pancake.sentCount += 1;
    const id = `m_bot_${pancake.sentCount}`;
    // Tin bot vừa gửi cũng vào lịch sử, như Pancake thật.
    const list = pancake.histories.get(convId) ?? [];
    list.unshift({ id, from: { id: PAGE_ID, name: 'Shop' }, original_message: body.message, inserted_at: new Date().toISOString() });
    pancake.histories.set(convId, list);
    json(res, 200, { success: true, id });
    pancake.onSend?.(convId, id, body.message);
    return;
  }
  if (req.method === 'POST' && /\/tags$/.test(url.pathname)) return json(res, 200, { success: true, data: [TAG_ID] });
  if (req.method === 'POST' && /\/notes$/.test(url.pathname)) return json(res, 200, { success: true });
  json(res, 404, { success: false, message: 'not found' });
});

/* ---------- Claude giả ---------- */

const claude = { requests: [] };

const claudeServer = http.createServer(async (req, res) => {
  const body = await readBody(req);
  claude.requests.push({ url: req.url, headers: req.headers, body });
  const prompt = JSON.stringify(body.messages);
  const wantsHuman = prompt.includes('gặp nhân viên');
  const out = wantsHuman
    ? { replies: ['Dạ em báo nhân viên hỗ trợ mình ngay ạ'], handoff: true, handoff_reason: 'Khách muốn gặp người', staff_note: 'Khách hỏi đổi hàng' }
    : { replies: ['Dạ áo thun bên em **159.000đ** ạ', 'Mình mặc size gì để em kiểm tra nha'], handoff: false, handoff_reason: '', staff_note: '' };
  json(res, 200, {
    id: `msg_${claude.requests.length}`,
    type: 'message',
    role: 'assistant',
    model: body.model,
    content: [{ type: 'text', text: JSON.stringify(out) }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0 },
  });
});

/* ---------- Khởi động ---------- */

let engine;
let store;
let appServer;
let appUrl;

const listen = (server) =>
  new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));

async function waitFor(fn, ms = 3000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('Hết thời gian chờ');
}

const sends = (convId) =>
  pancake.calls.filter(
    (c) => c.method === 'POST' && c.path.endsWith('/messages') && (!convId || c.path.includes(`/conversations/${convId}/`))
  );

let seq = 0;
function customerMessage(convId, text, extra = {}) {
  seq += 1;
  const msg = {
    id: `m_cus_${seq}`,
    from: { id: `cus_${convId}`, name: 'Lan Anh', page_customer_id: `pc_${convId}` },
    original_message: text,
    message: text,
    type: 'INBOX',
    inserted_at: new Date(Date.now() + seq).toISOString().replace('Z', ''),
    attachments: [],
    ...extra,
  };
  const list = pancake.histories.get(convId) ?? [];
  list.unshift(msg);
  pancake.histories.set(convId, list);
  return {
    page_id: PAGE_ID,
    event_type: 'messaging',
    data: {
      conversation: { id: convId, type: 'INBOX', from: { id: `cus_${convId}`, name: 'Lan Anh' }, tags: extra.tags ?? [] },
      message: msg,
    },
  };
}

function pageMessage(convId, id, text, from = {}) {
  return {
    page_id: PAGE_ID,
    event_type: 'messaging',
    data: {
      conversation: { id: convId, type: 'INBOX', from: { id: `cus_${convId}` }, tags: [] },
      message: { id, from: { id: PAGE_ID, name: 'Shop', ...from }, original_message: text, message: text, type: 'INBOX' },
    },
  };
}

before(async () => {
  const pancakePort = await listen(pancakeServer);
  const claudePort = await listen(claudeServer);
  Object.assign(process.env, {
    PANCAKE_API_BASE: `http://127.0.0.1:${pancakePort}`,
    ANTHROPIC_BASE_URL: `http://127.0.0.1:${claudePort}`,
    ANTHROPIC_API_KEY: 'sk-test',
    PANCAKE_PAGE_ID: PAGE_ID,
    PANCAKE_PAGE_ACCESS_TOKEN: PAGE_TOKEN,
    PANCAKE_WEBHOOK_SECRET: SECRET,
    BOT_MODE: 'auto',
    BOT_REPLY_DELAY_SEC: '0',
    BOT_BUBBLE_GAP_MS: '5',
    BOT_KNOWLEDGE_FILE: kbFile,
    DATA_DIR: tmp,
    APP_PASSCODE: '',
  });
  engine = await import('../server/bot/engine.js');
  store = await import('../server/bot/store.js');
  const { createBotRouter } = await import('../server/bot/routes.js');
  const express = (await import('express')).default;
  const app = express();
  app.use(createBotRouter());
  appServer = http.createServer(app);
  appUrl = `http://127.0.0.1:${await listen(appServer)}`;
  await engine._internal.refreshTags(engine._internal.pages.get(PAGE_ID));
});

after(() => {
  pancakeServer.close();
  claudeServer.close();
  appServer?.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

/* ---------- Các tình huống ---------- */

test('tìm thấy thẻ "Cần nhân viên" trên Pancake', () => {
  assert.equal(engine._internal.pages.get(PAGE_ID).pauseTagId, String(TAG_ID));
});

test('webhook sai mã bí mật bị từ chối, đúng mã thì nhận', async () => {
  const bad = await fetch(`${appUrl}/webhook/pancake/wrong`, { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
  assert.equal(bad.status, 404);
  const ok = await fetch(`${appUrl}/webhook/pancake/${SECRET}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ page_id: 'trang-la', event_type: 'messaging', data: {} }),
  });
  assert.equal(ok.status, 200);
});

test('khách nhắn → bot đọc lịch sử, gửi từng tin, bỏ markdown', async () => {
  const res = await fetch(`${appUrl}/webhook/pancake/${SECRET}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(customerMessage('c1', 'áo thun bao nhiêu shop')),
  });
  assert.equal(res.status, 200);
  await waitFor(() => sends('c1').length >= 2);
  const texts = sends('c1').map((c) => c.body.message);
  assert.deepEqual(texts, ['Dạ áo thun bên em 159.000đ ạ', 'Mình mặc size gì để em kiểm tra nha']);
  assert.ok(sends().every((c) => c.body.action === 'reply_inbox' && c.token === PAGE_TOKEN));

  const req = claude.requests.at(-1);
  assert.equal(req.body.model, 'claude-opus-5-5');
  assert.equal(req.body.output_config.format.type, 'json_schema');
  assert.equal(req.body.fallbacks, 'default');
  assert.match(req.headers['anthropic-beta'], /server-side-fallback-2026-07-01/);
  assert.ok(req.body.system.some((b) => b.text.includes('Áo thun: 159.000đ')));
  assert.match(JSON.stringify(req.body.messages), /KHÁCH: áo thun bao nhiêu shop/);
});

test('tin của chính bot quay lại qua webhook không làm bot tự tạm dừng', async () => {
  const last = sends('c1').at(-1);
  const r = engine.handleWebhook(pageMessage('c1', 'm_bot_x', last.body.message));
  assert.equal(r, 'own_message');
  assert.equal(store.pausedInfo(store.convKey(PAGE_ID, 'c1')), null);
});

test('khách nhắn liền nhiều tin → bot chỉ trả lời một lượt', async () => {
  const claudeBefore = claude.requests.length;
  engine.handleWebhook(customerMessage('c2', 'shop ơi'));
  engine.handleWebhook(customerMessage('c2', 'áo thun còn size M không'));
  engine.handleWebhook(customerMessage('c2', 'màu đen nha'));
  await waitFor(() => claude.requests.length > claudeBefore);
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(claude.requests.length, claudeBefore + 1);
  assert.match(JSON.stringify(claude.requests.at(-1).body.messages), /màu đen nha/);
});

test('sự kiện trùng (Pancake gửi lại) bị bỏ qua', () => {
  const ev = customerMessage('c3', 'alo');
  engine.handleWebhook(ev);
  assert.equal(engine.handleWebhook(ev), 'duplicate');
});

test('nhân viên nhắn tay → bot tạm dừng hội thoại đó', async () => {
  const r = engine.handleWebhook(pageMessage('c4', 'm_staff_1', 'Chị đợi em xíu', { admin_id: 'u1', admin_name: 'Hà' }));
  assert.equal(r, 'human_paused');
  engine.handleWebhook(customerMessage('c4', 'dạ'));
  const entry = await waitFor(() => store.getLog(5).find((e) => e.conversationId === 'c4' && e.type === 'skip'));
  assert.match(entry.detail, /Nhân viên đã trả lời/);
  assert.equal(sends('c4').length, 0);

  engine.resumeConversation(PAGE_ID, 'c4');
  assert.equal(store.pausedInfo(store.convKey(PAGE_ID, 'c4')), null);
});

test('khách đòi gặp người → bot báo khách, gắn thẻ, ghi chú cho nhân viên', async () => {
  engine.handleWebhook(customerMessage('c5', 'cho mình gặp nhân viên'));
  await waitFor(() => pancake.calls.some((c) => c.path.endsWith('/c5/tags')));
  const tagCall = pancake.calls.find((c) => c.path.endsWith('/c5/tags'));
  assert.deepEqual(tagCall.body, { action: 'add', tag_id: String(TAG_ID) });
  const note = await waitFor(() => pancake.calls.find((c) => c.path.endsWith('/page_customers/pc_c5/notes')));
  assert.match(note.body.message, /Khách muốn gặp người/);
  assert.ok(sends('c5').some((c) => c.body.message.includes('báo nhân viên')));

  // Tin tiếp theo của khách, hội thoại đang mang thẻ → bot im.
  const claudeBefore = claude.requests.length;
  engine.handleWebhook(customerMessage('c5', 'alo shop', { tags: [TAG_ID] }));
  await waitFor(() => store.getLog(5).find((e) => e.conversationId === 'c5' && e.type === 'skip'));
  assert.equal(claude.requests.length, claudeBefore);
});

test('ảnh khách gửi được đưa cho Claude xem', async () => {
  const before = claude.requests.length;
  engine.handleWebhook(
    customerMessage('c6', '', { attachments: [{ type: 'photo', url: 'https://content.pancake.vn/anh.jpg' }] })
  );
  await waitFor(() => claude.requests.length > before);
  const content = claude.requests.at(-1).body.messages[0].content;
  assert.ok(content.some((b) => b.type === 'image' && b.source.url === 'https://content.pancake.vn/anh.jpg'));
  assert.match(content.at(-1).text, /KHÁCH: \[Ảnh 1\]/);
});

test('file kiến thức còn là bản MẪU → chỉ soạn thử, không gửi', async () => {
  fs.writeFileSync(kbFile, '<!-- FILE MẪU -->\n# Shop\n');
  const t = new Date(Date.now() + 60_000);
  fs.utimesSync(kbFile, t, t);
  assert.equal(engine.effectiveMode(), 'shadow');

  engine.handleWebhook(customerMessage('c7', 'áo thun giá sao'));
  const entry = await waitFor(() => store.getLog(5).find((e) => e.conversationId === 'c7' && e.type === 'reply'));
  assert.equal(entry.status, 'shadow');
  assert.ok(entry.replies.length > 0);
  assert.equal(sends('c7').length, 0);
});
