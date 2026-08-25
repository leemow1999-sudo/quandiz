const STORE_STATE = 'quandiz.state.v3';
const STORE_OPTS = 'quandiz.opts.v2';
const LEGACY_CHAT = 'quandiz.chat.v2';

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
  shopBtn: $('#shop-btn'),
  shopName: $('#shop-name'),
  shopNote: $('#shop-note'),
  shopsList: $('#shops-list'),
  addShop: $('#add-shop'),
  phrasesBody: $('#phrases-body'),
  glossaryBody: $('#glossary-body'),
  glossarySearch: $('#glossary-search'),
  engineInfo: $('#engine-info'),
  lock: $('#lock'),
  lockForm: $('#lock-form'),
  lockInput: $('#lock-input'),
  lockError: $('#lock-error'),
  logout: $('#logout'),
};

const defaults = { autocopy: true, context: true, showOriginal: true, direction: 'auto' };

let opts = { ...defaults, ...read(STORE_OPTS, {}) };
let state = loadState();
let glossary = [];
let dataLoaded = false;

/* ---------------- Lưu trữ ---------------- */

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

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function newThread(name) {
  return { id: newId(), name, note: '', link: '', messages: [], updatedAt: Date.now() };
}

function loadState() {
  const saved = read(STORE_STATE, null);
  if (saved?.threads?.length) return saved;

  // Nâng cấp từ bản cũ: gom hội thoại đơn lẻ vào một shop.
  const legacy = read(LEGACY_CHAT, []);
  const thread = newThread('Shop đầu tiên');
  if (Array.isArray(legacy) && legacy.length) thread.messages = legacy;
  return { threads: [thread], activeId: thread.id };
}

function saveState() {
  // Giữ 200 tin mỗi shop để localStorage không phình vô hạn.
  const trimmed = {
    activeId: state.activeId,
    threads: state.threads.map((t) => ({ ...t, messages: t.messages.slice(-200) })),
  };
  write(STORE_STATE, trimmed);
}

const saveOpts = () => write(STORE_OPTS, opts);

function activeThread() {
  return state.threads.find((t) => t.id === state.activeId) || state.threads[0];
}

/* ---------------- Gọi API ---------------- */

class AuthError extends Error {}

async function api(path, options = {}) {
  const res = await fetch(path, { credentials: 'same-origin', ...options });
  if (res.status === 401) {
    showLock();
    throw new AuthError('Cần nhập mật khẩu');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
  return data;
}

/* ---------------- Tiện ích ---------------- */

const CJK = /[㐀-䶿一-鿿豈-﫿぀-ヿ]/;

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

function escapeHTML(str = '') {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
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

function renderChat() {
  const thread = activeThread();
  el.chat.querySelectorAll('.msg').forEach((n) => n.remove());
  thread.messages.forEach(renderMessage);
  el.empty.hidden = thread.messages.length > 0;
  scrollToEnd();
}

function renderHeader() {
  const thread = activeThread();
  el.shopName.textContent = thread.name;

  const bits = [];
  if (thread.note) bits.push(escapeHTML(thread.note));
  if (thread.link) {
    const href = /^https?:\/\//i.test(thread.link) ? thread.link : `https://${thread.link}`;
    bits.push(`<a href="${escapeHTML(href)}" target="_blank" rel="noopener">link sản phẩm ↗</a>`);
  }
  el.shopNote.innerHTML = bits.join(' · ');
  el.shopNote.hidden = bits.length === 0;
}

function scrollToEnd() {
  requestAnimationFrame(() => {
    el.chat.scrollTop = el.chat.scrollHeight;
  });
}

/* ---------------- Luồng dịch ---------------- */

function contextFor(thread, id) {
  if (!opts.context) return [];
  const index = thread.messages.findIndex((m) => m.id === id);
  return thread.messages
    .slice(0, index === -1 ? thread.messages.length : index)
    .filter((m) => m.status === 'done')
    .slice(-6)
    .map((m) => ({ role: m.role, text: m.original }));
}

async function runTranslate(thread, msg) {
  msg.status = 'pending';
  msg.error = '';
  if (thread.id === state.activeId) {
    renderMessage(msg);
    scrollToEnd();
  }

  try {
    const data = await api('/api/translate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: msg.original,
        direction: msg.direction || 'auto',
        context: contextFor(thread, msg.id),
      }),
    });

    msg.translated = data.translated;
    msg.source = data.source;
    msg.target = data.target;
    msg.provider = data.provider;
    msg.role = data.source === 'zh' ? 'shop' : 'me';
    msg.status = 'done';
  } catch (err) {
    msg.status = 'error';
    msg.error = err instanceof AuthError ? 'Chưa đăng nhập' : err.message;
  }

  thread.updatedAt = Date.now();
  saveState();
  if (thread.id === state.activeId) {
    renderMessage(msg);
    scrollToEnd();
  }

  if (msg.status === 'done' && msg.role === 'me' && opts.autocopy) {
    const ok = await copyText(msg.translated);
    toast(ok ? '✓ Đã chép tiếng Trung — dán vào 1688' : 'Bấm nút 📋 để chép');
  }
}

function addMessage(text, direction = opts.direction) {
  const thread = activeThread();
  const msg = {
    id: newId(),
    role: guessRole(text, direction),
    original: text,
    translated: '',
    direction,
    status: 'pending',
    ts: Date.now(),
  };
  thread.messages.push(msg);
  el.empty.hidden = true;
  saveState();
  runTranslate(thread, msg);
}

/** Mẫu câu đã có sẵn cả 2 thứ tiếng — chèn thẳng, khỏi gọi API. */
async function addReadyPair({ vi, zh }) {
  const thread = activeThread();
  const msg = {
    id: newId(),
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
  thread.messages.push(msg);
  thread.updatedAt = Date.now();
  el.empty.hidden = true;
  saveState();
  renderMessage(msg);
  scrollToEnd();
  const ok = await copyText(zh);
  toast(ok ? '✓ Đã chép tiếng Trung — dán vào 1688' : 'Bấm nút 📋 để chép');
}

/* ---------------- Quản lý shop ---------------- */

function switchThread(id) {
  state.activeId = id;
  saveState();
  renderHeader();
  renderChat();
  closeSheets();
}

function threadPreview(thread) {
  const last = thread.messages[thread.messages.length - 1];
  if (!last) return 'Chưa có tin nhắn nào';
  const text = last.status === 'done' ? last.translated : last.original;
  return `${last.role === 'me' ? 'Bạn: ' : 'Shop: '}${text}`;
}

function renderShops() {
  const sorted = [...state.threads].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  el.shopsList.innerHTML = sorted
    .map(
      (t) => `
      <div class="shop-row ${t.id === state.activeId ? 'is-active' : ''}" data-id="${t.id}">
        <button type="button" class="shop-pick" data-act="pick">
          <b>${escapeHTML(t.name)}</b>
          <span>${escapeHTML(threadPreview(t)).slice(0, 90)}</span>
          ${t.note ? `<em>${escapeHTML(t.note)}</em>` : ''}
        </button>
        <button type="button" class="icon-btn" data-act="edit" title="Sửa">✎</button>
      </div>
      <form class="shop-edit" data-edit="${t.id}" hidden>
        <input name="name" value="${escapeHTML(t.name)}" placeholder="Tên shop" />
        <input name="note" value="${escapeHTML(t.note || '')}" placeholder="Ghi chú — giá đã chốt, MOQ…" />
        <input name="link" value="${escapeHTML(t.link || '')}" placeholder="Link sản phẩm 1688" />
        <div class="shop-edit-actions">
          <button type="submit" class="chip primary-chip">Lưu</button>
          <button type="button" class="chip" data-act="delete">Xoá shop</button>
        </div>
      </form>`
    )
    .join('');
}

el.shopsList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;

  if (act === 'pick' || act === 'edit') {
    const id = btn.closest('.shop-row').dataset.id;
    if (act === 'pick') return switchThread(id);
    const form = el.shopsList.querySelector(`[data-edit="${id}"]`);
    form.hidden = !form.hidden;
    if (!form.hidden) form.querySelector('[name=name]').focus();
    return;
  }

  if (act === 'delete') {
    const id = btn.closest('.shop-edit').dataset.edit;
    const thread = state.threads.find((t) => t.id === id);
    if (!confirm(`Xoá shop "${thread.name}" và toàn bộ hội thoại?`)) return;
    state.threads = state.threads.filter((t) => t.id !== id);
    if (state.threads.length === 0) state.threads.push(newThread('Shop đầu tiên'));
    if (state.activeId === id) state.activeId = state.threads[0].id;
    saveState();
    renderShops();
    renderHeader();
    renderChat();
    toast('Đã xoá shop');
  }
});

el.shopsList.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target.closest('.shop-edit');
  const thread = state.threads.find((t) => t.id === form.dataset.edit);
  if (!thread) return;
  thread.name = form.name.value.trim() || thread.name;
  thread.note = form.note.value.trim();
  thread.link = form.link.value.trim();
  saveState();
  renderShops();
  renderHeader();
  toast('Đã lưu');
});

el.addShop.addEventListener('click', () => {
  const thread = newThread(`Shop ${state.threads.length + 1}`);
  state.threads.push(thread);
  state.activeId = thread.id;
  saveState();
  renderHeader();
  renderChat();
  renderShops();
  const form = el.shopsList.querySelector(`[data-edit="${thread.id}"]`);
  if (form) {
    form.hidden = false;
    form.querySelector('[name=name]').focus();
    form.querySelector('[name=name]').select();
  }
});

el.shopBtn.addEventListener('click', () => {
  renderShops();
  openSheet('shops');
});

/* ---------------- Sự kiện chính ---------------- */

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
  const thread = activeThread();
  const id = btn.closest('[data-id]')?.dataset.id;
  const msg = thread.messages.find((m) => m.id === id);
  if (!msg) return;

  const act = btn.dataset.act;
  if (act === 'copy') {
    copyText(msg.translated).then((ok) => toast(ok ? '✓ Đã chép' : 'Không chép được'));
  } else if (act === 'copy-original') {
    copyText(msg.original).then((ok) => toast(ok ? '✓ Đã chép bản gốc' : 'Không chép được'));
  } else if (act === 'retry') {
    runTranslate(thread, msg);
  } else if (act === 'remove') {
    thread.messages = thread.messages.filter((m) => m.id !== id);
    saveState();
    renderChat();
  }
});

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
    if (key === 'showOriginal') renderChat();
  });
}

$('#clear-history').addEventListener('click', () => {
  const thread = activeThread();
  if (!confirm(`Xoá toàn bộ hội thoại với "${thread.name}"?`)) return;
  thread.messages = [];
  saveState();
  renderChat();
  closeSheets();
  toast('Đã xoá hội thoại');
});

el.logout.addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
  closeSheets();
  showLock();
});

/* ---------------- Màn khoá ---------------- */

function showLock() {
  el.lock.hidden = false;
  el.lockInput.value = '';
  el.lockInput.focus();
}

function hideLock() {
  el.lock.hidden = true;
  el.lockError.hidden = true;
}

el.lockForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  el.lockError.hidden = true;
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ passcode: el.lockInput.value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Không mở khoá được');
    hideLock();
    await bootData(true);
  } catch (err) {
    el.lockError.textContent = err.message;
    el.lockError.hidden = false;
  }
});

/* ---------------- Nạp dữ liệu ---------------- */

async function loadPhrases() {
  const { groups } = await api('/api/phrases');
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
  el.phrasesBody.dataset.ready = '1';
  el.phrasesBody.onclick = (e) => {
    const btn = e.target.closest('.phrase');
    if (!btn) return;
    const group = groups.find((g) => g.group === btn.dataset.group);
    const item = group?.items[Number(btn.dataset.i)];
    if (!item) return;
    closeSheets();
    addReadyPair(item);
  };
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
  glossary = (await api('/api/glossary')).terms;
  renderGlossary();
}
el.glossarySearch.addEventListener('input', () => renderGlossary(el.glossarySearch.value));

async function loadHealth() {
  const health = await api('/api/health');
  el.logout.hidden = !health.authRequired;

  if (health.ok) {
    const label = health.active[0] === 'claude' ? `Claude (${health.model})` : 'Google Dịch';
    el.status.textContent = `Sẵn sàng · ${label}`;
    el.status.className = 'status ok';
  } else {
    el.status.textContent = 'Chưa cấu hình công cụ dịch';
    el.status.className = 'status err';
  }

  el.engineInfo.innerHTML = health.ok
    ? `Công cụ dịch: <strong>${escapeHTML(health.active.join(' → '))}</strong><br>Model: ${escapeHTML(health.model || 'không dùng AI')}<br>Giới hạn: ${health.maxInputChars} ký tự / tin.`
    : 'Chưa có công cụ dịch nào chạy được. Thêm <code>ANTHROPIC_API_KEY</code> vào file <code>.env</code> rồi khởi động lại server.';

  return health;
}

/* ---------------- Khởi động ---------------- */

async function bootData(force = false) {
  if (dataLoaded && !force) return;
  try {
    const health = await loadHealth();
    if (health.authRequired && !health.authed) return showLock();
    await Promise.all([loadPhrases(), loadGlossary()]);
    dataLoaded = true;
    handleSharedText();
  } catch (err) {
    if (err instanceof AuthError) return; // showLock đã chạy trong api()
    el.status.textContent = 'Mất kết nối máy chủ';
    el.status.className = 'status err';
  }
}

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

renderHeader();
renderChat();
autoGrow();
bootData();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
