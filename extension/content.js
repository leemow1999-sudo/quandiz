/**
 * Chèn thẳng bản dịch vào trang 1688:
 *  - Alt+Z (hoặc bấm nút tròn 译) : đổi nội dung khung chat đang gõ từ tiếng Việt sang tiếng Trung
 *  - Bôi đen chữ Trung           : hiện nghĩa tiếng Việt ngay tại chỗ
 *
 * Cố ý KHÔNG dò theo class/id của 1688: giao diện của họ đổi liên tục và
 * là mã sinh tự động. Ở đây chỉ dựa vào ô đang được focus và vùng bôi đen,
 * nên 1688 có đổi giao diện thì vẫn chạy.
 */

const CJK = /[㐀-䶿一-鿿豈-﫿぀-ヿ]/;
const HOST_ID = 'quandiz-1688-root';

if (!document.getElementById(HOST_ID) && document.body) {
  init();
}

function init() {
  const host = document.createElement('div');
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .layer {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 2147483647;
        font-family: -apple-system, "Segoe UI", Roboto, "Noto Sans SC", Arial, sans-serif;
      }
      .fab {
        pointer-events: auto;
        position: absolute;
        right: 22px;
        bottom: 22px;
        width: 46px;
        height: 46px;
        border: 0;
        border-radius: 50%;
        background: linear-gradient(135deg, #ff9d4d, #ff5400);
        color: #fff;
        font-size: 20px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(0,0,0,.28);
      }
      .fab:disabled { opacity: .6; cursor: default; }
      .pill {
        pointer-events: auto;
        position: absolute;
        border: 0;
        border-radius: 999px;
        background: #ff5400;
        color: #fff;
        font-size: 12.5px;
        font-weight: 600;
        padding: 6px 12px;
        cursor: pointer;
        box-shadow: 0 3px 10px rgba(0,0,0,.3);
        white-space: nowrap;
      }
      .card {
        pointer-events: auto;
        position: absolute;
        max-width: 340px;
        background: #171a21;
        color: #e8eaf0;
        border: 1px solid #2a2f3a;
        border-radius: 13px;
        padding: 12px 13px;
        box-shadow: 0 8px 26px rgba(0,0,0,.42);
        font-size: 14px;
        line-height: 1.55;
      }
      .card .src {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px dashed #2a2f3a;
        font-size: 12px;
        color: #949bab;
        max-height: 88px;
        overflow-y: auto;
      }
      .card .row { display: flex; gap: 7px; margin-top: 10px; }
      .card button {
        border: 1px solid #2a2f3a;
        background: rgba(255,255,255,.05);
        color: #e8eaf0;
        border-radius: 999px;
        font-size: 12px;
        padding: 5px 11px;
        cursor: pointer;
      }
      .card button.main { background: #ff5400; border-color: #ff5400; color: #fff; font-weight: 700; }
      .toast {
        pointer-events: none;
        position: absolute;
        left: 50%;
        top: 18px;
        transform: translateX(-50%);
        background: rgba(0,0,0,.86);
        color: #fff;
        border-radius: 999px;
        padding: 9px 16px;
        font-size: 13px;
        max-width: 80vw;
        text-align: center;
      }
      [hidden] { display: none !important; }
    </style>
    <div class="layer">
      <button class="fab" part="fab" title="Alt+Z — đổi nội dung đang gõ sang tiếng Trung">译</button>
      <button class="pill" hidden></button>
      <div class="card" hidden></div>
      <div class="toast" hidden></div>
    </div>`;

  document.documentElement.appendChild(host);

  const fab = shadow.querySelector('.fab');
  const pill = shadow.querySelector('.pill');
  const card = shadow.querySelector('.card');
  const toastEl = shadow.querySelector('.toast');

  let lastEditable = null;
  let toastTimer;

  /* ---------- tiện ích ---------- */

  function toast(message, ms = 2400) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.hidden = true), ms);
  }

  function ask(payload) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'translate', ...payload }, (res) =>
        resolve(res || { ok: false, error: 'Tiện ích không phản hồi. Thử tải lại trang.' })
      );
    });
  }

  function isEditable(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.tagName === 'TEXTAREA') return !node.disabled && !node.readOnly;
    if (node.tagName === 'INPUT') {
      return !node.disabled && !node.readOnly && /^(|text|search|url|email|tel)$/i.test(node.type);
    }
    return node.isContentEditable;
  }

  function readEditable(node) {
    return node.tagName === 'TEXTAREA' || node.tagName === 'INPUT' ? node.value : node.innerText;
  }

  /** Ghi lại nội dung sao cho React/Vue của 1688 nhận ra là người dùng vừa gõ. */
  function writeEditable(node, text) {
    node.focus();

    if (node.tagName === 'TEXTAREA' || node.tagName === 'INPUT') {
      const proto = node.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(node, text);
      else node.value = text;
      node.dispatchEvent(new Event('input', { bubbles: true }));
      node.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    // Ô contenteditable: chọn hết rồi "gõ đè" để framework bắt được sự kiện.
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(node);
    sel.removeAllRanges();
    sel.addRange(range);

    let ok = false;
    try {
      ok = document.execCommand('insertText', false, text);
    } catch {
      ok = false;
    }
    if (!ok) {
      node.textContent = text;
      node.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    }
    // Đưa con trỏ về cuối
    const end = document.createRange();
    end.selectNodeContents(node);
    end.collapse(false);
    sel.removeAllRanges();
    sel.addRange(end);
  }

  function currentEditable() {
    const active = document.activeElement;
    if (isEditable(active)) return active;
    if (lastEditable && lastEditable.isConnected) return lastEditable;
    return null;
  }

  /* ---------- đổi ô đang gõ sang tiếng Trung ---------- */

  async function translateInput() {
    const node = currentEditable();
    if (!node) return toast('Bấm vào khung chat của shop trước, rồi bấm lại.');

    const text = readEditable(node).trim();
    if (!text) return toast('Khung chat đang trống — gõ tiếng Việt vào đã.');

    fab.disabled = true;
    fab.textContent = '…';
    const res = await ask({ text, direction: 'vi2zh' });
    fab.disabled = false;
    fab.textContent = '译';

    if (!res.ok) return toast(res.error, 4000);
    writeEditable(node, res.translated);
    toast('✓ Đã đổi sang tiếng Trung — bấm gửi như bình thường');
  }

  fab.addEventListener('mousedown', (e) => e.preventDefault()); // giữ focus ở khung chat
  fab.addEventListener('click', translateInput);

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyZ') {
        e.preventDefault();
        translateInput();
      }
    },
    true
  );

  document.addEventListener('focusin', (e) => {
    if (isEditable(e.target)) lastEditable = e.target;
  });

  /* ---------- bôi đen chữ Trung để đọc nghĩa ---------- */

  let pendingSelection = '';

  function hidePopups() {
    pill.hidden = true;
    card.hidden = true;
  }

  function place(node, rect) {
    const top = rect.top > 60 ? rect.top - 8 : rect.bottom + 8;
    node.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 320))}px`;
    node.style.top = `${top}px`;
    node.style.transform = rect.top > 60 ? 'translateY(-100%)' : 'none';
  }

  document.addEventListener('mouseup', (e) => {
    if (e.target === host) return;
    setTimeout(() => {
      const sel = window.getSelection();
      const text = String(sel).trim();
      if (!text || text.length > 500 || !CJK.test(text)) return hidePopups();

      pendingSelection = text;
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      pill.textContent = '译 → tiếng Việt';
      pill.hidden = false;
      card.hidden = true;
      place(pill, rect);
    }, 10);
  });

  document.addEventListener('mousedown', (e) => {
    if (e.target !== host) hidePopups();
  });

  pill.addEventListener('mousedown', (e) => e.stopPropagation());
  pill.addEventListener('click', async () => {
    const rect = pill.getBoundingClientRect();
    pill.hidden = true;
    card.innerHTML = '<div>Đang dịch…</div>';
    card.hidden = false;
    card.style.left = pill.style.left;
    card.style.top = pill.style.top;
    card.style.transform = pill.style.transform;

    const res = await ask({ text: pendingSelection, direction: 'zh2vi' });
    if (!res.ok) {
      card.innerHTML = `<div style="color:#ff8a80">${escapeHTML(res.error)}</div>`;
      return;
    }

    card.innerHTML = `
      <div class="vi"></div>
      <div class="src"></div>
      <div class="row">
        <button class="main" data-act="copy">📋 Chép</button>
        <button data-act="close">Đóng</button>
      </div>`;
    card.querySelector('.vi').textContent = res.translated;
    card.querySelector('.src').textContent = pendingSelection;
    void rect;

    card.querySelector('[data-act=copy]').onclick = async () => {
      try {
        await navigator.clipboard.writeText(res.translated);
        toast('✓ Đã chép bản tiếng Việt');
      } catch {
        toast('Trình duyệt chặn chép — bôi đen rồi Ctrl+C nhé');
      }
    };
    card.querySelector('[data-act=close]').onclick = hidePopups;
  });

  card.addEventListener('mousedown', (e) => e.stopPropagation());

  window.addEventListener('scroll', hidePopups, true);

  function escapeHTML(str = '') {
    return String(str).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }
}
