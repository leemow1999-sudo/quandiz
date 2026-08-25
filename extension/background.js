// Mọi lệnh gọi mạng đi qua đây: service worker của extension không bị CORS
// chặn khi đã được cấp quyền cho địa chỉ máy chủ.

const DEFAULTS = { server: 'http://localhost:3000', passcode: '' };

export async function getSettings() {
  return { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
}

function normalizeServer(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

async function translate({ text, direction }) {
  const { server, passcode } = await getSettings();
  const base = normalizeServer(server);
  if (!base) return { ok: false, error: 'Chưa đặt địa chỉ máy chủ. Mở phần cài đặt của tiện ích.' };

  let res;
  try {
    res = await fetch(`${base}/api/translate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(passcode ? { 'x-passcode': passcode } : {}),
      },
      body: JSON.stringify({ text, direction }),
    });
  } catch {
    return { ok: false, error: `Không nối được tới ${base}. Máy chủ đang chạy chứ?` };
  }

  const data = await res.json().catch(() => ({}));
  if (res.status === 401) return { ok: false, error: 'Sai mật khẩu — sửa lại trong cài đặt tiện ích.' };
  if (!res.ok) return { ok: false, error: data.error || `Máy chủ báo lỗi ${res.status}` };
  return { ok: true, ...data };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== 'translate') return;
  translate(msg).then(sendResponse);
  return true; // giữ kênh mở cho phản hồi bất đồng bộ
});
