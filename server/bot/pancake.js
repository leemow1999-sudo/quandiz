/**
 * Gọi Pancake Public API (https://developer.pancake.biz).
 * Mỗi page có page_access_token riêng, lấy trong Pancake → Cài đặt → Công cụ.
 */
import { config } from '../config.js';

const MAX_TEXT = 1900; // Pancake/Facebook cắt tin ~2000 ký tự

export class PancakeError extends Error {
  constructor(message, { status, code, data } = {}) {
    super(message);
    this.name = 'PancakeError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

async function call(page, method, path, { query = {}, body } = {}) {
  const url = new URL(config.bot.apiBase.replace(/\/$/, '') + path);
  url.searchParams.set('page_access_token', page.token);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    // Không đưa URL vào lỗi: trong đó có page_access_token.
    throw new PancakeError(`Pancake ${method} ${path}: không kết nối được (${err.name})`);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Một số lỗi trả về HTML hoặc rỗng.
  }

  // Pancake hay trả HTTP 200 kèm success:false, nên phải kiểm tra cả hai.
  if (!res.ok || data?.success === false) {
    const reason = data?.message || data?.message_code || data?.error || `HTTP ${res.status}`;
    throw new PancakeError(`Pancake ${method} ${path}: ${reason}`, {
      status: res.status,
      code: data?.message_code ?? data?.error_code,
      data,
    });
  }
  return data ?? {};
}

const enc = encodeURIComponent;

export function getMessages(page, conversationId) {
  return call(page, 'GET', `/pages/${enc(page.id)}/conversations/${enc(conversationId)}/messages`);
}

/** Cắt tin dài thành nhiều tin, ưu tiên cắt ở xuống dòng / dấu câu. */
export function splitText(text, max = MAX_TEXT) {
  const parts = [];
  let rest = String(text).trim();
  while (rest.length > max) {
    let cut = Math.max(rest.lastIndexOf('\n', max), rest.lastIndexOf('. ', max) + 1);
    if (cut < max / 2) cut = rest.lastIndexOf(' ', max);
    if (cut < max / 2) cut = max;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

/** Gửi một tin văn bản vào inbox. Trả về id tin vừa gửi. */
export async function sendInboxText(page, conversationId, text) {
  const data = await call(
    page,
    'POST',
    `/pages/${enc(page.id)}/conversations/${enc(conversationId)}/messages`,
    { body: { action: 'reply_inbox', message: text } }
  );
  return data.id ?? null;
}

export async function getTags(page) {
  const data = await call(page, 'GET', `/pages/${enc(page.id)}/tags`);
  return Array.isArray(data.tags) ? data.tags : [];
}

export function addTag(page, conversationId, tagId) {
  return call(page, 'POST', `/pages/${enc(page.id)}/conversations/${enc(conversationId)}/tags`, {
    body: { action: 'add', tag_id: String(tagId) },
  });
}

export function assign(page, conversationId, assigneeIds) {
  return call(page, 'POST', `/pages/${enc(page.id)}/conversations/${enc(conversationId)}/assign`, {
    body: { assignee_ids: assigneeIds },
  });
}

export function addCustomerNote(page, pageCustomerId, message) {
  return call(page, 'POST', `/pages/${enc(page.id)}/page_customers/${enc(pageCustomerId)}/notes`, {
    body: { message },
  });
}
