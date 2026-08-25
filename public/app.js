const STORE_CHAT = 'quandiz.chat.v2';
const STORE_OPTS = 'quandiz.opts.v2';

const $ = (sel) => document.querySelector(sel);

const el = {
  chat: $('#chat'),
  empty: $('#empty'),
  form: $('#composer'),
  input: $('#input'),
  send: $('#send'),
  paste: $('#paste'),
  status: $('#status'),
  toast: $('#toast'),
  backdrop: $('#backdrop'),
  phrasesBody: $('#phrases-body'),
  glossaryBody: $('#glossary-body'),
  glossarySearch: $('#glossary-search'),
  engineInfo: $('#engine-info'),
};

const defaults = { autocopy: true, context: true, showOriginal: true, direction: 'auto' };

let opts = { ...defaults, ...read(STORE_OPTS, {}) };
let messages = read(STORE_CHAT, []);
let glossary = [];

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* hết dung lượng / chế độ riêng tư — bỏ qua */
  }
}

const saveChat = () => write(STORE_CHAT, messages.slice(-200));
const saveOpts = () => write(STORE_OPTS, opts);

/* ---------------- Tiện ích ---------------- */

const CJK = /[㐀-䶿一-鿿豈-﫿぀-ヿ]/;

/** Đoán nhanh phía người gửi để vẽ bong bóng ngay, chưa cần đợi server. */
function guessRole(text, direction) {
  if (direction === 'vi2zh') return 'me';
  if (direction === 'zh2vi') return 'shop';
  return CJK.test(text) ? 'shop' : 'me';
}

let toastTimer;
function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2200);
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* rơi xuống cách dự phòng */
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

/* ---------------- Vẽ tin nhắn ---------------- */

function bubbleHTML(msg) {
  const isMe = msg.role === 'me';
  const label = isMe ? 'Bạn → shop' : 'Shop → bạn';

  if (msg.status === 'pending') {
    return `
      <div class="msg-label">${label}</div>
      <div class="bubble"><div class="primary dots">Đang dịch</div>
        <div class="original">${escapeHTML(msg.original)}</div>
      </div>`;
  }

  if (msg.status === 'error') {
    return `
      <div class="msg-label">${label}</div>
      <div class="bubble"><div class="primary">${escapeHTML(msg.original)}</div>
        <div class="bubble-actions"><button class="chip" data-act="retry">↻ Thử lại</button>
        <button class="chip" data-act="remove">Xoá</button></div>
      </div>
      <div class="msg-error">${escapeHTML(msg.error || 'Dịch lỗi')}</div>`;
  }

  const original = opts.showOriginal
    ? `<div class="original">${escapeHTML(msg.original)}</div>`
    : '';

  return `
    <div class="msg-label">${label}</div>
    <div class="bubble">
      <div class="primary">${escapeHTML(msg.translated)}</div>
      ${original}
      <div class="bubble-actions">
        <button class="chip ${isMe ? 'primary-chip' : ''}" data-act="copy">📋 Chép ${isMe ? '中文' : 'tiếng Việt'}</button>
        <button class="chip" data-act="copy-original">Bản gốc</button>
        <button class="chip" data-act="remove">Xoá</button>
      </div>
    </div>`;
}

function escapeHTML(str = '') {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function renderMessage(msg) {
  let node = el.chat.querySelector(`[data-id="${msg.id}"]`);
  if (!node) {
    node = document.createElement('div');
    node.dataset.id = msg.id;
    el.chat.appendChild(node);
  }
  node.className = `msg ${msg.role} ${msg.status === 'pending' ? 'pending' : ''} ${msg.status === 'error' ? 'failed' : ''}`;
  node.innerHTML = bubbleHTML(msg);
}

function renderAll() {
  el.chat.querySelectorAll('.msg').forEach((n) => n.remove());
  messages.forEach(renderMessage);
  el.empty.hidden = messages.length > 0;
  scrollToEnd();
}

function scrollToEnd() {
  requestAnimationFrame(() => {
    el.chat.scrollTop = el.chat.scrollHeight;
  });
}

/* ---------------- Luồng dịch ---------------- */

function contextFor(id) {
  if (!opts.context) return [];
  const index = messages.findIndex((m) => m.id === id);
  const before = messages.slice(0, index === -1 ? messages.length : index);
  return before
    .filter((m) => m.status === 'done')
    .slice(-6)
    .map((m) => ({ role: m.role, text: m.original }));
}

async function runTranslate(msg) {
  msg.status = 'pending';
  msg.error = '';
  renderMessage(msg);
  scrollToEnd();

  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: msg.original,
        direction: msg.direction || 'auto',
        context: contextFor(msg.id),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);

    msg.translated = data.translated;
    msg.source = data.source;
    msg.target = data.target;
    msg.provider = data.provider;
    msg.role = data.source === 'zh' ? 'shop' : 'me';
    msg.status = 'done';
    renderMessage(msg);
    saveChat();
    scrollToEnd();

    if (msg.role === 'me' && opts.autocopy) {
      const ok = await copyText(msg.translated);
      toast(ok ? '✓ Đã chép tiếng Trung — dán vào 1688' : 'Bấm nút 📋 để chép');
    }
  } catch (err) {
    msg.status = 'error';
    msg.error = err.message;
    renderMessage(msg);
    saveChat();
    scrollToEnd();
  }
}

function addMessage(text, direction = opts.direction) {
  const msg = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role: guessRole(text, direction),
    original: text,
    translated: '',
    direction,
    status: 'pending',
    ts: Date.now(),
  };
  messages.push(msg);
  el.empty.hidden = true;
  saveChat();
  runTranslate(msg);
}

/** Mẫu câu đã có sẵn cả 2 thứ tiếng — chèn thẳng, khỏi gọi API. */
async function addReadyPair({ vi, zh }) {
  const msg = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role: 'me',
    original: vi,
    translated: zh,
    direction: 'vi2zh',
    source: 'vi',
    target: 'zh',
    provider: 'phrasebook',
    status: 'done',
    ts: Date.now(),
  };
  messages.push(msg);
  el.empty.hidden = true;
  saveChat();
  renderMessage(msg);
  scrollToEnd();
  const ok = await copyText(zh);
  toast(ok ? '✓ Đã chép tiếng Trung — dán vào 1688' : 'Bấm nút 📋 để chép');
}

/* ---------------- Sự kiện ---------------- */

el.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = el.input.value.trim();
  if (!text) return;
  addMessage(text);
  el.input.value = '';
  autoGrow();
});

el.input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    el.form.requestSubmit();
  }
});

function autoGrow() {
  el.input.style.height = 'auto';
  el.input.style.height = `${Math.min(el.input.scrollHeight, window.innerHeight * 0.42)}px`;
  el.send.disabled = el.input.value.trim().length === 0;
}
el.input.addEventListener('input', autoGrow);

el.paste.addEventListener('click', async () => {
  try {
    const text = (await navigator.clipboard.readText()).trim();
    if (!text) return toast('Clipboard đang trống');
    el.input.value = text;
    autoGrow();
    el.form.requestSubmit();
  } catch {
    toast('Trình duyệt chặn đọc clipboard — dán tay vào ô nhập nhé');
    el.input.focus();
  }
});

el.chat.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const id = btn.closest('[data-id]')?.dataset.id;
  const msg = messages.find((m) => m.id === id);
  if (!msg) return;

  const act = btn.dataset.act;
  if (act === 'copy') {
    copyText(msg.translated).then((ok) => toast(ok ? '✓ Đã chép' : 'Không chép được'));
  } else if (act === 'copy-original') {
    copyText(msg.original).then((ok) => toast(ok ? '✓ Đã chép bản gốc' : 'Không chép được'));
  } else if (act === 'retry') {
    runTranslate(msg);
  } else if (act === 'remove') {
    messages = messages.filter((m) => m.id !== id);
    saveChat();
    renderAll();
  }
});

// Chọn hướng dịch
document.querySelectorAll('.seg-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.seg-btn').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    opts.direction = btn.dataset.dir;
    saveOpts();
  });
});

/* ---------------- Bảng trượt ---------------- */

function openSheet(name) {
  el.backdrop.hidden = false;
  $(`#sheet-${name}`).hidden = false;
}

function closeSheets() {
  el.backdrop.hidden = true;
  document.querySelectorAll('.sheet').forEach((s) => (s.hidden = true));
}

document.querySelectorAll('[data-sheet]').forEach((btn) =>
  btn.addEventListener('click', () => openSheet(btn.dataset.sheet))
);
document.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', closeSheets));
el.backdrop.addEventListener('click', closeSheets);
document.addEventListener('keydown', (e) => e.key === 'Escape' && closeSheets());

/* ---------------- Cài đặt ---------------- */

const toggles = { autocopy: $('#opt-autocopy'), context: $('#opt-context'), showOriginal: $('#opt-original') };
for (const [key, input] of Object.entries(toggles)) {
  input.checked = opts[key];
  input.addEventListener('change', () => {
    opts[key] = input.checked;
    saveOpts();
    if (key === 'showOriginal') renderAll();
  });
}

$('#clear-history').addEventListener('click', () => {
  if (!confirm('Xoá toàn bộ hội thoại đã lưu?')) return;
  messages = [];
  saveChat();
  renderAll();
  closeSheets();
  toast('Đã xoá hội thoại');
});

/* ---------------- Nạp dữ liệu ---------------- */

async function loadPhrases() {
  try {
    const { groups } = await (await fetch('/api/phrases')).json();
    el.phrasesBody.innerHTML = groups
      .map(
        (g) =>
          `<div class="group-title">${escapeHTML(g.group)}</div>` +
          g.items
            .map(
              (item, i) =>
                `<button class="phrase" data-group="${escapeHTML(g.group)}" data-i="${i}">
                   <b>${escapeHTML(item.vi)}</b><span>${escapeHTML(item.zh)}</span>
                 </button>`
            )
            .join('')
      )
      .join('');

    el.phrasesBody.addEventListener('click', (e) => {
      const btn = e.target.closest('.phrase');
      if (!btn) return;
      const group = groups.find((g) => g.group === btn.dataset.group);
      const item = group?.items[Number(btn.dataset.i)];
      if (!item) return;
      closeSheets();
      addReadyPair(item);
    });
  } catch {
    el.phrasesBody.textContent = 'Không tải được mẫu câu.';
  }
}

function renderGlossary(filter = '') {
  const q = filter.trim().toLowerCase();
  const list = q
    ? glossary.filter(
        (t) =>
          t.zh.toLowerCase().includes(q) ||
          t.vi.toLowerCase().includes(q) ||
          (t.pinyin || '').toLowerCase().includes(q)
      )
    : glossary;

  if (list.length === 0) {
    el.glossaryBody.innerHTML = '<div class="info">Không tìm thấy từ nào.</div>';
    return;
  }

  let html = '';
  let group = null;
  for (const term of list) {
    if (!q && term.group !== group) {
      group = term.group;
      html += `<div class="group-title">${escapeHTML(group)}</div>`;
    }
    html += `<div class="term">
        <span class="term-zh">${escapeHTML(term.zh)}</span>
        <span class="term-py">${escapeHTML(term.pinyin || '')}</span>
        <span class="term-vi">${escapeHTML(term.vi)}</span>
      </div>`;
  }
  el.glossaryBody.innerHTML = html;
}

async function loadGlossary() {
  try {
    glossary = (await (await fetch('/api/glossary')).json()).terms;
    renderGlossary();
  } catch {
    el.glossaryBody.textContent = 'Không tải được từ điển.';
  }
}
el.glossarySearch.addEventListener('input', () => renderGlossary(el.glossarySearch.value));

async function loadHealth() {
  try {
    const health = await (await fetch('/api/health')).json();
    if (health.ok) {
      const label = health.active[0] === 'claude' ? `Claude (${health.model})` : 'Google Dịch';
      el.status.textContent = `Sẵn sàng · ${label}`;
      el.status.className = 'status ok';
    } else {
      el.status.textContent = 'Chưa cấu hình công cụ dịch';
      el.status.className = 'status err';
    }
    el.engineInfo.innerHTML = health.ok
      ? `Công cụ dịch: <strong>${health.active.join(' → ')}</strong><br>Model: ${escapeHTML(health.model || 'không dùng AI')}<br>Giới hạn: ${health.maxInputChars} ký tự / tin.`
      : 'Chưa có công cụ dịch nào chạy được. Thêm <code>ANTHROPIC_API_KEY</code> vào file <code>.env</code> rồi khởi động lại server.';
  } catch {
    el.status.textContent = 'Mất kết nối máy chủ';
    el.status.className = 'status err';
  }
}

/* ---------------- Khởi động ---------------- */

// Nhận nội dung từ nút "Chia sẻ" của Android (share target) hoặc link ?text=
function handleSharedText() {
  const params = new URLSearchParams(location.search);
  const shared = (params.get('text') || params.get('title') || '').trim();
  if (!shared) return;
  history.replaceState(null, '', location.pathname);
  el.input.value = shared;
  autoGrow();
  el.form.requestSubmit();
}

document.querySelectorAll('.seg-btn').forEach((b) =>
  b.classList.toggle('is-active', b.dataset.dir === opts.direction)
);

renderAll();
autoGrow();
loadHealth();
loadPhrases();
loadGlossary();
handleSharedText();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
