const $ = (id) => document.getElementById(id);
const DEFAULTS = { server: 'http://localhost:3000', passcode: '' };

function say(message, kind = '') {
  $('status').textContent = message;
  $('status').className = `status ${kind}`;
}

function normalize(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

chrome.storage.sync.get(DEFAULTS).then((saved) => {
  $('server').value = saved.server;
  $('passcode').value = saved.passcode;
});

$('save').addEventListener('click', async () => {
  const server = normalize($('server').value);
  const passcode = $('passcode').value;

  if (!server) return say('Nhập địa chỉ máy chủ đã.', 'err');

  let origin;
  try {
    origin = `${new URL(server).origin}/*`;
  } catch {
    return say('Địa chỉ không hợp lệ. Ví dụ: https://ten-app.onrender.com', 'err');
  }

  say('Đang xin quyền truy cập máy chủ…');
  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) return say('Bạn chưa cho phép tiện ích gọi tới máy chủ này.', 'err');

  await chrome.storage.sync.set({ server, passcode });

  say('Đang kiểm tra kết nối…');
  try {
    const res = await fetch(`${server}/api/health`, {
      headers: passcode ? { 'x-passcode': passcode } : {},
    });
    const health = await res.json();

    if (!health.ok) return say('Máy chủ chạy nhưng chưa cấu hình công cụ dịch nào.', 'err');
    if (health.authRequired && !health.authed) {
      return say(passcode ? 'Mật khẩu không đúng.' : 'Máy chủ có đặt mật khẩu — điền vào ô trên.', 'err');
    }

    const engine = health.active[0] === 'claude' ? `Claude (${health.model})` : 'Google Dịch';
    say(`✓ Đã lưu. Máy chủ chạy tốt — đang dùng ${engine}.`, 'ok');
  } catch {
    say('Không nối được tới máy chủ. Kiểm tra địa chỉ và xem server có đang chạy không.', 'err');
  }
});
