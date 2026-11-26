/**
 * Điều phối bot: nhận webhook Pancake → chờ khách gõ xong → đọc lại lịch sử chat từ API →
 * nhờ Claude soạn trả lời → gửi (hoặc chỉ ghi nhật ký ở chế độ shadow).
 *
 * Nguyên tắc an toàn:
 * - Webhook chỉ là "chuông báo". Nội dung chat luôn lấy lại từ API Pancake bằng token của page,
 *   nên ai đó gửi webhook giả cũng không nhét được chữ vào miệng bot.
 * - Nhân viên nhắn tay vào hội thoại → bot im một thời gian (BOT_HUMAN_PAUSE_MIN).
 * - Hội thoại có thẻ "Cần nhân viên" → bot không trả lời cho tới khi gỡ thẻ.
 * - Mỗi hội thoại tối đa BOT_MAX_REPLIES_PER_HOUR lượt/giờ, chống lặp vô hạn với bot khác.
 */
import { config, hasClaude } from '../config.js';
import * as pancake from './pancake.js';
import * as store from './store.js';
import { composeReply } from './brain.js';
import { knowledgeStatus } from './knowledge.js';

export const MODES = ['off', 'shadow', 'auto'];

const TAG_REFRESH_MS = 10 * 60_000;
const ECHO_TTL_MS = 3 * 60_000;
const OWN_SEND_WINDOW_MS = 20_000;
const NO_TAG_HANDOFF_PAUSE_MS = 24 * 3_600_000;
const BUBBLE_GAP_MS = Number(process.env.BOT_BUBBLE_GAP_MS ?? 1200);

const pages = new Map(
  config.bot.pages.map((p) => [p.id, { ...p, pauseTagId: null, tagError: null, tagsCheckedAt: 0 }])
);

/** Trạng thái tạm trong RAM của từng hội thoại. */
const convs = new Map();
/** id tin đã xử lý — Pancake có thể gửi một sự kiện nhiều lần. */
const seenMessages = new Map();
/** Tin bot vừa gửi, để nhận ra khi Pancake báo ngược lại qua webhook. */
const echoes = new Map();
/** Page lạ gửi webhook tới (chưa khai báo token) → lần ghi log gần nhất. */
const unknownPages = new Map();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s ?? '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
const normText = (s) =>
  String(s ?? '')
    .normalize('NFC')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function convState(key) {
  let st = convs.get(key);
  if (!st) {
    st = {
      timer: null,
      running: false,
      dirty: false,
      cancelled: false,
      tags: [],
      tagsVersion: -1,
      customerId: null,
      replyTimes: [],
      lastBotSendAt: 0,
      touchedAt: Date.now(),
    };
    convs.set(key, st);
  }
  st.touchedAt = Date.now();
  return st;
}

function tagIds(tags) {
  return (Array.isArray(tags) ? tags : [])
    .map((t) => (t && typeof t === 'object' ? t.id : t))
    .filter((t) => t !== undefined && t !== null)
    .map(String);
}

function updateTags(st, conversation) {
  if (!conversation || !('tags' in conversation)) return;
  const version = Number(conversation.version);
  if (Number.isFinite(version)) {
    if (version < st.tagsVersion) return; // sự kiện đến trễ, bỏ
    st.tagsVersion = version;
  }
  st.tags = tagIds(conversation.tags);
}

/* ---------- Chế độ ---------- */

export function configuredMode() {
  const wanted = store.getModeOverride() || config.bot.mode;
  return MODES.includes(wanted) ? wanted : 'shadow';
}

/** Chế độ thực chạy: file kiến thức còn là bản mẫu thì không cho gửi thật. */
export function effectiveMode() {
  const mode = configuredMode();
  if (mode === 'auto') {
    const kb = knowledgeStatus();
    if (kb.missing || kb.isTemplate) return 'shadow';
  }
  return mode;
}

export function setMode(mode) {
  if (!MODES.includes(mode)) throw Object.assign(new Error('Chế độ không hợp lệ.'), { status: 400 });
  store.setModeOverride(mode);
}

/* ---------- Thẻ "Cần nhân viên" ---------- */

async function refreshTags(page) {
  page.tagsCheckedAt = Date.now();
  if (!config.bot.pauseTag) {
    page.pauseTagId = null;
    page.tagError = null;
    return;
  }
  try {
    const tags = await pancake.getTags(page);
    const want = norm(config.bot.pauseTag);
    const tag = tags.find((t) => norm(t.text) === want);
    page.pauseTagId = tag ? String(tag.id) : null;
    page.tagError = tag ? null : `Chưa có thẻ "${config.bot.pauseTag}" trong Pancake của page này.`;
  } catch (err) {
    page.tagError = `Không đọc được danh sách thẻ: ${err.message}`;
  }
}

/* ---------- Nhận diện tin của chính bot ---------- */

function addEcho(key, text) {
  const list = echoes.get(key) ?? [];
  const now = Date.now();
  list.push({ text: normText(text), at: now });
  echoes.set(
    key,
    list.filter((e) => now - e.at < ECHO_TTL_MS)
  );
}

function takeEcho(key, ...texts) {
  const list = echoes.get(key);
  if (!list?.length) return false;
  const wanted = texts.map(normText).filter(Boolean);
  const idx = list.findIndex((e) => wanted.includes(e.text));
  if (idx === -1) return false;
  list.splice(idx, 1);
  return true;
}

/* ---------- Webhook ---------- */

/**
 * Xử lý một sự kiện webhook. Trả về chuỗi mô tả kết quả (để ghi log / kiểm thử).
 * Hàm này chạy nhanh, việc gọi Claude diễn ra sau (hẹn giờ).
 */
export function handleWebhook(payload) {
  const pageId = String(payload?.page_id ?? '');
  const page = pages.get(pageId);
  if (!page) {
    // Ghi lại (mỗi page tối đa 1 lần/giờ) để người dùng biết ID page mà khai báo token.
    if (pageId && Date.now() - (unknownPages.get(pageId) ?? 0) > 3_600_000) {
      unknownPages.set(pageId, Date.now());
      store.addLog({
        type: 'skip',
        pageId,
        detail: `Nhận tin từ page ${pageId} nhưng page này chưa được khai báo token (PANCAKE_PAGE_ID / PANCAKE_PAGES).`,
      });
    }
    return 'unknown_page';
  }

  const conversation = payload.data?.conversation;
  if (!conversation?.id) return 'no_conversation';
  const key = store.convKey(page.id, conversation.id);

  if (payload.event_type === 'conversation') {
    updateTags(convState(key), conversation);
    return 'tags_updated';
  }
  if (payload.event_type !== 'messaging') return 'ignored_event';

  const message = payload.data?.message;
  if (!message?.id) return 'no_message';
  if ((conversation.type || message.type) !== 'INBOX') return 'not_inbox';

  const st = convState(key);
  updateTags(st, conversation);

  if (seenMessages.has(message.id)) return 'duplicate';
  seenMessages.set(message.id, Date.now());

  const fromId = String(message.from?.id ?? '');
  if (!fromId) return 'no_sender';
  const customerId = String(conversation.from?.id ?? '');
  const fromPage =
    fromId === page.id ||
    Boolean(message.from?.admin_id || message.from?.uid) ||
    (customerId !== '' && fromId !== customerId);

  if (fromPage) return onPageMessage(page, conversation.id, key, st, message);

  if (message.from?.page_customer_id) st.customerId = message.from.page_customer_id;
  scheduleReply(page, conversation.id);
  return 'scheduled';
}

function onPageMessage(page, conversationId, key, st, message) {
  if (store.isSentByBot(message.id)) return 'own_message';
  if (takeEcho(key, message.original_message, message.message)) return 'own_message';
  if (message.from?.is_automated || message.from?.ai_generated) return 'automation';
  // Webhook đến trước khi API gửi tin trả về id: tin không ghi tên nhân viên ngay sau lúc bot gửi
  // gần như chắc chắn là của bot.
  const noStaff = !message.from?.admin_id && !message.from?.uid;
  if (noStaff && Date.now() - st.lastBotSendAt < OWN_SEND_WINDOW_MS) return 'own_message';

  // Nhân viên nhắn tay → bot lùi lại.
  clearTimeout(st.timer);
  st.timer = null;
  if (st.running) st.cancelled = true;
  if (config.bot.humanPauseMs > 0) {
    const already = store.pausedInfo(key);
    store.pause(key, config.bot.humanPauseMs, 'Nhân viên đã trả lời');
    if (!already) {
      store.addLog({
        type: 'human',
        pageId: page.id,
        conversationId,
        staff: message.from?.admin_name || message.from?.name || '',
        detail: `Nhân viên vào trả lời, bot nghỉ ${Math.round(config.bot.humanPauseMs / 60_000)} phút ở hội thoại này.`,
      });
    }
  }
  return 'human_paused';
}

function scheduleReply(page, conversationId, delay = config.bot.replyDelayMs) {
  const key = store.convKey(page.id, conversationId);
  const st = convState(key);
  if (st.running) {
    st.dirty = true; // đang soạn mà khách nhắn thêm → soạn lại sau
    return;
  }
  clearTimeout(st.timer);
  st.timer = setTimeout(() => {
    st.timer = null;
    runReply(page, conversationId).catch((err) => console.error('[bot]', err));
  }, delay);
}

/* ---------- Đọc lịch sử chat ---------- */

function parseTime(value) {
  if (!value) return null;
  const s = String(value);
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`); // Pancake trả giờ UTC không kèm "Z"
  return Number.isNaN(d.getTime()) ? null : d;
}

function messageToTurn(m, who) {
  const images = [];
  const extras = [];
  for (const a of Array.isArray(m.attachments) ? m.attachments : []) {
    if (a?.type === 'photo' && /^https?:\/\//.test(a.url ?? '')) images.push(a.url);
    else if (a?.type === 'sticker') extras.push('[sticker]');
    else if (a?.type === 'video') extras.push('[video]');
    else if (a?.type === 'system_message') continue;
    else if (a?.title || a?.message) extras.push(`[${a.title || a.message}]`);
  }
  const raw = m.original_message ?? m.message ?? '';
  const text = [normText(raw), ...extras].filter(Boolean).join(' ');
  if (!text && !images.length) return null;
  return { who, text, images, at: parseTime(m.inserted_at), id: m.id };
}

export function parseHistory(data, page) {
  const convFromId = String(data?.conv_from?.id ?? '');
  const list = (Array.isArray(data?.messages) ? [...data.messages] : []).filter((m) => !m?.is_removed);
  list.sort((a, b) => (parseTime(a.inserted_at)?.getTime() ?? 0) - (parseTime(b.inserted_at)?.getTime() ?? 0));

  const turns = [];
  for (const m of list.slice(-config.bot.historyMessages)) {
    const fromId = String(m.from?.id ?? '');
    const isCustomer = convFromId ? fromId === convFromId && fromId !== page.id : fromId !== page.id;
    const turn = messageToTurn(m, isCustomer ? 'customer' : 'shop');
    if (turn) turns.push(turn);
  }

  const customer = Array.isArray(data?.customers) ? data.customers[0] : null;
  return {
    turns,
    customerName: data?.conv_from?.name || customer?.name || '',
    customerId: customer?.id || data?.conv_customers?.[0]?.id || null,
    canInbox: data?.can_inbox ?? customer?.can_inbox ?? true,
  };
}

/* ---------- Soạn và gửi ---------- */

function gate(page, key, st) {
  if (page.pauseTagId !== null && st.tags.includes(page.pauseTagId)) {
    return `Hội thoại có thẻ "${config.bot.pauseTag}"`;
  }
  const paused = store.pausedInfo(key);
  if (paused) return `Đang tạm dừng: ${paused.reason}`;

  const hourAgo = Date.now() - 3_600_000;
  st.replyTimes = st.replyTimes.filter((t) => t > hourAgo);
  if (st.replyTimes.length >= config.bot.maxRepliesPerHour) {
    store.pause(key, 3_600_000, 'Quá số lượt trả lời trong 1 giờ');
    return `Đã trả lời ${st.replyTimes.length} lượt trong 1 giờ — tạm dừng để nhân viên xem`;
  }
  return null;
}

function trailingCustomerText(turns) {
  const out = [];
  for (let i = turns.length - 1; i >= 0 && turns[i].who === 'customer'; i -= 1) {
    out.unshift(turns[i].text || '[ảnh]');
  }
  return out.join('\n');
}

async function runReply(page, conversationId) {
  const key = store.convKey(page.id, conversationId);
  const st = convState(key);
  const mode = effectiveMode();
  if (mode === 'off') return 'off';

  if (Date.now() - page.tagsCheckedAt > TAG_REFRESH_MS) await refreshTags(page);

  const base = { pageId: page.id, conversationId, mode };
  const blocked = gate(page, key, st);
  if (blocked) {
    store.addLog({ ...base, type: 'skip', detail: blocked });
    return 'blocked';
  }

  st.running = true;
  st.dirty = false;
  st.cancelled = false;
  try {
    const history = parseHistory(await pancake.getMessages(page, conversationId), page);
    if (history.customerId) st.customerId = history.customerId;
    const last = history.turns.at(-1);
    if (!last || last.who !== 'customer') return 'already_answered';
    if (history.canInbox === false) {
      store.addLog({ ...base, type: 'skip', customer: history.customerName, detail: 'Nền tảng không cho nhắn lại khách này (quá hạn 24h?).' });
      return 'cannot_inbox';
    }

    const incoming = trailingCustomerText(history.turns);
    const result = await composeReply({ customerName: history.customerName, turns: history.turns });
    st.replyTimes.push(Date.now());

    if (st.dirty) return 'superseded'; // khách vừa nhắn thêm, finally sẽ soạn lại
    if (st.cancelled || store.pausedInfo(key)) return 'cancelled';

    const entry = {
      ...base,
      type: 'reply',
      customer: history.customerName,
      incoming,
      replies: result.replies,
      handoff: result.handoff,
      handoffReason: result.handoffReason,
      staffNote: result.staffNote,
      model: result.model,
      tokens: result.usage
        ? {
            input: result.usage.input_tokens,
            output: result.usage.output_tokens,
            cacheRead: result.usage.cache_read_input_tokens ?? 0,
          }
        : undefined,
    };

    if (mode !== 'auto') {
      store.addLog({ ...entry, status: 'shadow' });
      return 'shadow';
    }

    const sent = await sendBubbles(page, conversationId, key, st, result.replies);
    if (sent.error) {
      store.addLog({ ...entry, status: 'error', sentCount: sent.count, error: sent.error });
      return 'send_error';
    }

    let handoffProblems = [];
    if (result.handoff) handoffProblems = await handOff(page, conversationId, key, st, result);
    store.addLog({ ...entry, status: 'sent', problems: handoffProblems.length ? handoffProblems : undefined });
    return 'sent';
  } catch (err) {
    console.error('[bot] Lỗi khi trả lời', conversationId, err.message);
    store.addLog({ ...base, type: 'error', error: err.message });
    return 'error';
  } finally {
    st.running = false;
    if (st.dirty) {
      st.dirty = false;
      scheduleReply(page, conversationId, 1500);
    }
  }
}

async function sendBubbles(page, conversationId, key, st, replies) {
  let count = 0;
  for (const bubble of replies) {
    for (const part of pancake.splitText(bubble)) {
      if (count > 0) await sleep(BUBBLE_GAP_MS); // nhắn từng tin như người thật
      if (st.cancelled) return { count, error: 'Nhân viên vào trả lời giữa chừng, bot dừng gửi.' };
      addEcho(key, part);
      st.lastBotSendAt = Date.now();
      try {
        const id = await pancake.sendInboxText(page, conversationId, part);
        store.rememberSent(id);
      } catch (err) {
        return { count, error: err.message };
      } finally {
        st.lastBotSendAt = Date.now();
      }
      count += 1;
    }
  }
  return { count };
}

async function handOff(page, conversationId, key, st, result) {
  const problems = [];
  const reason = result.handoffReason || 'Cần nhân viên hỗ trợ';

  if (page.pauseTagId !== null) {
    try {
      await pancake.addTag(page, conversationId, page.pauseTagId);
      if (!st.tags.includes(page.pauseTagId)) st.tags.push(page.pauseTagId);
    } catch (err) {
      problems.push(`Gắn thẻ lỗi: ${err.message}`);
      store.pause(key, NO_TAG_HANDOFF_PAUSE_MS, `Đã chuyển nhân viên: ${reason}`);
    }
  } else {
    // Không có thẻ thì tự nhớ trong máy: im 24h ở hội thoại này (mở lại được ở trang quản trị).
    store.pause(key, NO_TAG_HANDOFF_PAUSE_MS, `Đã chuyển nhân viên: ${reason}`);
  }

  if (config.bot.handoffAssignees.length) {
    try {
      await pancake.assign(page, conversationId, config.bot.handoffAssignees);
    } catch (err) {
      problems.push(`Giao nhân viên lỗi: ${err.message}`);
    }
  }

  if (config.bot.writeNotes && st.customerId) {
    const note = [`🤖 Bot chuyển nhân viên: ${reason}`, result.staffNote].filter(Boolean).join('\n');
    try {
      await pancake.addCustomerNote(page, st.customerId, note);
    } catch (err) {
      problems.push(`Ghi chú lỗi: ${err.message}`);
    }
  }
  return problems;
}

/* ---------- Dành cho trang quản trị ---------- */

export function resumeConversation(pageId, conversationId) {
  store.resume(store.convKey(pageId, conversationId));
}

/** Chat thử với bot ngay trên trang quản trị — không đụng tới Pancake. */
export async function testReply({ turns, customerName }) {
  const clean = (Array.isArray(turns) ? turns : [])
    .slice(-config.bot.historyMessages)
    .map((t) => ({
      who: t?.who === 'shop' ? 'shop' : 'customer',
      text: String(t?.text ?? '').slice(0, 2000),
      images: [],
    }))
    .filter((t) => t.text.trim());
  if (!clean.length || clean.at(-1).who !== 'customer') {
    throw Object.assign(new Error('Cần ít nhất một tin của khách ở cuối.'), { status: 400 });
  }
  return composeReply({ customerName: String(customerName ?? '').slice(0, 100), turns: clean });
}

export function status() {
  const kb = knowledgeStatus();
  const warnings = [];
  if (!hasClaude()) warnings.push('Chưa có ANTHROPIC_API_KEY — bot không soạn được câu trả lời.');
  if (!pages.size) warnings.push('Chưa khai báo page Pancake (PANCAKE_PAGE_ID + PANCAKE_PAGE_ACCESS_TOKEN).');
  if (!webhookEnabled()) warnings.push('Chưa đặt PANCAKE_WEBHOOK_SECRET (ít nhất 16 ký tự) — webhook đang tắt.');
  if (kb.missing) warnings.push(`Không tìm thấy file kiến thức ${kb.file}.`);
  else if (kb.isTemplate)
    warnings.push('File kiến thức vẫn là bản MẪU — bot chỉ chạy shadow (không gửi) cho tới khi bạn điền thông tin thật và xoá dòng "FILE MẪU".');
  if (configuredMode() === 'auto' && effectiveMode() !== 'auto') warnings.push('Đang chọn "auto" nhưng bị hạ xuống "shadow" vì lý do ở trên.');
  for (const p of pages.values()) if (p.tagError) warnings.push(`Page ${p.id}: ${p.tagError}`);
  if (!config.passcode && pages.size)
    warnings.push('Chưa đặt APP_PASSCODE — ai mở được trang này cũng bật/tắt được bot. Đặt mật khẩu trước khi đưa lên mạng.');
  const storage = store.storageStatus();
  if (storage.error) warnings.push(`Không lưu được trạng thái ra đĩa: ${storage.error}`);

  return {
    mode: effectiveMode(),
    configuredMode: configuredMode(),
    model: config.bot.model,
    effort: config.bot.effort,
    replyDelaySec: config.bot.replyDelayMs / 1000,
    humanPauseMin: config.bot.humanPauseMs / 60_000,
    pauseTag: config.bot.pauseTag,
    webhookEnabled: webhookEnabled(),
    pages: [...pages.values()].map((p) => ({ id: p.id, pauseTagId: p.pauseTagId, tagError: p.tagError })),
    knowledge: kb,
    paused: store.listPaused(),
    warnings,
  };
}

export function webhookEnabled() {
  return config.bot.webhookSecret.length >= 16;
}

/* ---------- Khởi động ---------- */

let started = false;
export function start() {
  if (started) return;
  started = true;
  for (const page of pages.values()) refreshTags(page);

  // Dọn RAM định kỳ.
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [id, at] of seenMessages) if (now - at > 3_600_000) seenMessages.delete(id);
    for (const [key, list] of echoes) {
      const fresh = list.filter((e) => now - e.at < ECHO_TTL_MS);
      if (fresh.length) echoes.set(key, fresh);
      else echoes.delete(key);
    }
    for (const [key, st] of convs) {
      if (!st.timer && !st.running && now - st.touchedAt > 24 * 3_600_000) convs.delete(key);
    }
  }, 10 * 60_000);
  cleanup.unref?.();
}

// Cho bài kiểm thử.
export const _internal = { pages, convs, runReply, refreshTags };
