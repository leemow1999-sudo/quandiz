/**
 * Trạng thái nhỏ của bot, lưu ra một file JSON để khởi động lại không quên:
 * - hội thoại đang tạm dừng (nhân viên vừa vào trả lời)
 * - id các tin bot đã gửi (để không tưởng nhầm tin của bot là của nhân viên)
 * - nhật ký hoạt động gần nhất
 * - chế độ bật/tắt chỉnh từ trang quản trị
 *
 * Hosting có ổ đĩa tạm (Render free...) thì file mất khi deploy lại — bot vẫn chạy bình thường,
 * chỉ quên các lần tạm dừng. Thẻ "Cần nhân viên" nằm trong Pancake nên không bị ảnh hưởng.
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

const MAX_LOG = 300;
const MAX_SENT = 2000;

const file = path.join(config.bot.dataDir, 'bot-state.json');

const state = {
  modeOverride: null,
  paused: {}, // key -> { until, reason, at }
  sentIds: [],
  log: [],
};

let sentSet = new Set();
let saveTimer = null;
let persistError = null;

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (raw && typeof raw === 'object') {
      state.modeOverride = raw.modeOverride ?? null;
      state.paused = raw.paused && typeof raw.paused === 'object' ? raw.paused : {};
      state.sentIds = Array.isArray(raw.sentIds) ? raw.sentIds.slice(-MAX_SENT) : [];
      state.log = Array.isArray(raw.log) ? raw.log.slice(-MAX_LOG) : [];
    }
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn('[bot] Không đọc được', file, err.message);
  }
  sentSet = new Set(state.sentIds);
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(config.bot.dataDir, { recursive: true });
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(state));
      fs.renameSync(tmp, file);
      persistError = null;
    } catch (err) {
      if (!persistError) console.warn('[bot] Không lưu được trạng thái:', err.message);
      persistError = err.message;
    }
  }, 1000);
  saveTimer.unref?.();
}

load();

export const convKey = (pageId, conversationId) => `${pageId}|${conversationId}`;

/* ---------- Chế độ ---------- */

export function getModeOverride() {
  return state.modeOverride;
}

export function setModeOverride(mode) {
  state.modeOverride = mode;
  scheduleSave();
}

/* ---------- Tạm dừng theo hội thoại ---------- */

export function pause(key, ms, reason) {
  state.paused[key] = { until: Date.now() + ms, reason, at: Date.now() };
  scheduleSave();
}

export function resume(key) {
  delete state.paused[key];
  scheduleSave();
}

export function pausedInfo(key) {
  const entry = state.paused[key];
  if (!entry) return null;
  if (entry.until <= Date.now()) {
    delete state.paused[key];
    scheduleSave();
    return null;
  }
  return entry;
}

export function listPaused() {
  const now = Date.now();
  return Object.entries(state.paused)
    .filter(([, v]) => v.until > now)
    .map(([key, v]) => {
      const [pageId, conversationId] = key.split('|');
      return { pageId, conversationId, ...v };
    });
}

/* ---------- Tin bot đã gửi ---------- */

export function rememberSent(id) {
  if (!id || sentSet.has(id)) return;
  sentSet.add(id);
  state.sentIds.push(id);
  if (state.sentIds.length > MAX_SENT) {
    const drop = state.sentIds.splice(0, state.sentIds.length - MAX_SENT);
    for (const d of drop) sentSet.delete(d);
  }
  scheduleSave();
}

export function isSentByBot(id) {
  return Boolean(id) && sentSet.has(id);
}

/* ---------- Nhật ký ---------- */

export function addLog(entry) {
  const item = { at: Date.now(), ...entry };
  state.log.push(item);
  if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG);
  scheduleSave();
  return item;
}

export function getLog(limit = 100) {
  return state.log.slice(-limit).reverse();
}

export function storageStatus() {
  return { file, error: persistError };
}
