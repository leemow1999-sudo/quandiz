'use strict';

const $ = (sel) => document.querySelector(sel);

const MODE_HINT = {
  off: 'Bot đang tắt — không đọc, không trả lời tin nào.',
  shadow: 'Bot đọc tin và soạn câu trả lời nhưng KHÔNG gửi cho khách. Xem câu bot định trả lời ở Nhật ký để đánh giá trước khi bật thật.',
  auto: 'Bot tự trả lời khách. Nhân viên nhắn tay vào hội thoại thì bot tự lùi lại.',
};

let status = null;
let logTimer = null;

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: options.body ? { 'content-type': 'application/json' } : undefined,
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    showLogin();
    throw new Error(data.error || 'Cần đăng nhập');
  }
  if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
  return data;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function fmtTime(ms) {
  const d = new Date(ms);
  const sameDay = d.toDateString() === new Date().toDateString();
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    ...(sameDay ? {} : { day: '2-digit', month: '2-digit' }),
  });
}

/* ---------- Đăng nhập ---------- */

function showLogin() {
  $('#login').hidden = false;
  $('#app').hidden = true;
  $('#sub').textContent = 'Cần mật khẩu';
  clearInterval(logTimer);
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-err').textContent = '';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ passcode: $('#passcode').value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Sai mật khẩu');
    $('#login').hidden = true;
    boot();
  } catch (err) {
    $('#login-err').textContent = err.message;
  }
});

$('#logout').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
  location.reload();
});

/* ---------- Trạng thái + chế độ ---------- */

function renderStatus() {
  const s = status;
  for (const btn of document.querySelectorAll('#mode button')) {
    btn.classList.toggle('on', btn.dataset.mode === s.mode);
  }
  $('#mode-hint').textContent = MODE_HINT[s.mode] || '';

  const sub = $('#sub');
  sub.textContent = `${s.mode === 'auto' ? 'Đang tự trả lời' : s.mode === 'shadow' ? 'Chế độ thử' : 'Đang tắt'} · ${s.pages.length} page`;
  sub.className = `sub ${s.mode === 'auto' ? 'ok' : s.mode === 'shadow' ? 'warn' : ''}`;

  const warnings = $('#warnings');
  warnings.replaceChildren(...s.warnings.map((w) => el('li', '', w)));

  // Hội thoại đang tạm dừng
  const paused = $('#paused');
  paused.replaceChildren();
  if (s.paused.length) {
    const box = el('div', 'paused');
    box.append(el('div', 'hint', 'Hội thoại bot đang tạm dừng:'));
    for (const p of s.paused) {
      const item = el('div', 'item');
      item.append(el('span', '', `${p.reason} · đến ${fmtTime(p.until)} · ${p.conversationId}`));
      const btn = el('button', 'ghost small', 'Bật lại');
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        await api('/api/bot/resume', { method: 'POST', body: JSON.stringify(p) }).catch(() => {});
        loadStatus();
      });
      item.append(btn);
      box.append(item);
    }
    paused.append(box);
  }

  // Tab cài đặt
  const kv = $('#setup');
  kv.replaceChildren();
  const add = (k, v) => {
    kv.append(el('dt', '', k));
    const dd = el('dd');
    if (v instanceof Node) dd.append(v);
    else dd.textContent = v;
    kv.append(dd);
  };
  if (s.webhookUrl) {
    const wrap = el('div', 'row');
    const code = el('code', '', s.webhookUrl);
    const copy = el('button', 'ghost small', 'Chép');
    copy.addEventListener('click', () => {
      navigator.clipboard?.writeText(s.webhookUrl).then(
        () => (copy.textContent = 'Đã chép'),
        () => (copy.textContent = 'Không chép được')
      );
    });
    wrap.append(code, copy);
    add('URL webhook', wrap);
  } else {
    add('URL webhook', 'Chưa bật — đặt PANCAKE_WEBHOOK_SECRET');
  }
  add('Page', s.pages.length ? s.pages.map((p) => p.id).join(', ') : 'Chưa khai báo');
  add(
    'Thẻ chuyển người',
    s.pauseTag
      ? `"${s.pauseTag}" — ${s.pages.every((p) => p.pauseTagId !== null) && s.pages.length ? 'đã tìm thấy' : 'chưa tìm thấy trên Pancake'}`
      : 'Không dùng'
  );
  add('Model', `${s.model} (effort ${s.effort})`);
  add('Chờ khách gõ xong', `${s.replyDelaySec} giây`);
  add('Nhân viên vào thì bot nghỉ', `${s.humanPauseMin} phút`);
  $('#kb-file').textContent = `Bot chỉ nói những gì có trong file: ${s.knowledge.file} (${s.knowledge.chars} ký tự). Sửa file này để dạy bot.`;
}

async function loadStatus() {
  status = await api('/api/bot/status');
  renderStatus();
}

$('#mode').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-mode]');
  if (!btn || btn.dataset.mode === status?.mode) return;
  if (btn.dataset.mode === 'auto' && !confirm('Bật tự trả lời? Bot sẽ nhắn cho khách thật.')) return;
  try {
    status = await api('/api/bot/mode', { method: 'POST', body: JSON.stringify({ mode: btn.dataset.mode }) });
    renderStatus();
    // Server có thể hạ auto xuống shadow (file kiến thức còn là mẫu) — status đã nói rõ lý do.
  } catch (err) {
    alert(err.message);
  }
});

/* ---------- Nhật ký ---------- */

const STATUS_LABEL = { sent: 'Đã gửi', shadow: 'Soạn thử', error: 'Lỗi' };

function renderEntry(e) {
  const box = el('div', 'entry');
  const meta = el('div', 'meta');
  meta.append(el('span', '', fmtTime(e.at)));
  if (e.customer) meta.append(el('span', 'who', e.customer));

  if (e.type === 'reply') {
    meta.append(el('span', `badge ${e.status}`, STATUS_LABEL[e.status] || e.status));
    if (e.handoff) meta.append(el('span', 'badge handoff', 'Chuyển nhân viên'));
  } else if (e.type === 'human') {
    meta.append(el('span', 'badge human', 'Nhân viên trả lời'));
  } else if (e.type === 'skip') {
    meta.append(el('span', 'badge skip', 'Bỏ qua'));
  } else if (e.type === 'error') {
    meta.append(el('span', 'badge error', 'Lỗi'));
  }
  box.append(meta);

  if (e.incoming) box.append(el('div', 'in', e.incoming));
  if (e.replies?.length) {
    const out = el('div', 'out');
    for (const r of e.replies) out.append(el('div', 'bubble', r));
    box.append(out);
  } else if (e.type === 'reply') {
    box.append(el('div', 'detail', '(bot không gửi tin nào)'));
  }
  if (e.handoff && (e.handoffReason || e.staffNote)) {
    box.append(el('div', 'note', [e.handoffReason, e.staffNote].filter(Boolean).join('\n')));
  }
  if (e.detail) box.append(el('div', 'detail', e.detail));
  if (e.error) box.append(el('div', 'detail error', e.error));
  if (e.problems?.length) box.append(el('div', 'detail error', e.problems.join('\n')));
  return box;
}

async function loadLog() {
  const { entries } = await api('/api/bot/log?limit=100');
  const log = $('#log');
  if (!entries.length) {
    log.replaceChildren(el('div', 'empty', 'Chưa có hoạt động. Khi khách nhắn vào page, bot sẽ ghi lại ở đây.'));
    return;
  }
  log.replaceChildren(...entries.map(renderEntry));
}

$('#refresh').addEventListener('click', () => {
  loadStatus().catch(() => {});
  loadLog().catch(() => {});
});

/* ---------- Tabs ---------- */

$('#tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tab]');
  if (!btn) return;
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b === btn);
  for (const sec of document.querySelectorAll('section.tab')) sec.hidden = sec.dataset.tab !== btn.dataset.tab;
  if (btn.dataset.tab === 'setup') loadKnowledge();
});

async function loadKnowledge() {
  try {
    const { text } = await api('/api/bot/knowledge');
    $('#kb').textContent = text || '(trống)';
  } catch (err) {
    $('#kb').textContent = err.message;
  }
}

/* ---------- Chat thử ---------- */

const turns = [];

function addMsg(kind, text) {
  const chat = $('#test-chat');
  chat.append(el('div', `msg ${kind}`, text));
  chat.scrollTop = chat.scrollHeight;
}

$('#test-reset').addEventListener('click', () => {
  turns.length = 0;
  $('#test-chat').replaceChildren();
});

$('#test-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('#test-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  turns.push({ who: 'customer', text });
  addMsg('customer', text);

  const send = $('#test-send');
  send.disabled = true;
  const typing = el('div', 'typing', 'Bot đang soạn…');
  $('#test-chat').append(typing);
  try {
    const r = await api('/api/bot/test', {
      method: 'POST',
      body: JSON.stringify({ turns, customerName: 'Khách thử' }),
    });
    typing.remove();
    for (const reply of r.replies) {
      turns.push({ who: 'shop', text: reply });
      addMsg('shop', reply);
    }
    if (!r.replies.length) addMsg('sys', '(bot không gửi tin nào)');
    if (r.handoff) addMsg('sys', `→ Chuyển nhân viên: ${r.handoffReason || ''}${r.staffNote ? `\n${r.staffNote}` : ''}`);
  } catch (err) {
    typing.remove();
    addMsg('sys error', err.message);
  } finally {
    send.disabled = false;
    input.focus();
  }
});

/* ---------- Khởi động ---------- */

async function boot() {
  try {
    const health = await fetch('/api/health', { credentials: 'same-origin' }).then((r) => r.json());
    $('#logout').hidden = !health.authRequired;
    if (health.authRequired && !health.authed) return showLogin();
    await loadStatus();
    $('#app').hidden = false;
    await loadLog();
    clearInterval(logTimer);
    logTimer = setInterval(() => {
      if (document.hidden) return;
      loadLog().catch(() => {});
      loadStatus().catch(() => {});
    }, 15_000);
  } catch (err) {
    $('#sub').textContent = err.message;
  }
}

boot();
