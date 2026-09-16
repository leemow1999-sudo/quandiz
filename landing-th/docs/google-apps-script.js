/**
 * ============================================================
 *  NHẬN ĐƠN COD TỪ LANDING PAGE → GOOGLE SHEET
 * ============================================================
 *  Cách gắn (5 phút):
 *   1. Tạo Google Sheet mới → Extensions → Apps Script.
 *   2. Xoá code mẫu, dán toàn bộ file này vào.
 *   3. Sửa NOTIFY_EMAIL bên dưới (để rỗng '' nếu không cần mail).
 *   4. Deploy → New deployment → Type: Web app
 *        Execute as     : Me
 *        Who has access : Anyone
 *   5. Copy URL dạng https://script.google.com/macros/s/..../exec
 *   6. Dán URL đó vào CONFIG.WEBHOOK_URL trong khối 99-scripts.html.
 *
 *  Mẹo: mở lại Sheet → mỗi đơn là 1 dòng, cột STATUS để team sale tick khi
 *  đã gọi xác nhận. Lọc theo PROVINCE để chia đơn cho hãng vận chuyển.
 * ============================================================
 */

var NOTIFY_EMAIL = '';           // vd: 'sale@yourshop.com' — để rỗng nếu không cần
var SHEET_NAME   = 'ORDERS';

var HEADERS = [
  'ts', 'order_id', 'status', 'name', 'phone', 'address', 'province', 'zip',
  'note', 'product', 'pack', 'qty', 'total', 'currency', 'page_url', 'referrer', 'utm'
];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var p = (e && e.parameter) || {};

    // Cũng chấp nhận JSON body (phòng khi đổi cách gửi)
    if (e && e.postData && e.postData.type === 'application/json') {
      try { p = JSON.parse(e.postData.contents); } catch (err) {}
    }

    var sheet = getSheet_();
    var row = HEADERS.map(function (key) {
      if (key === 'ts')     return new Date();
      if (key === 'status') return 'NEW';
      return p[key] !== undefined ? p[key] : '';
    });
    sheet.appendRow(row);

    if (NOTIFY_EMAIL) {
      MailApp.sendEmail({
        to: NOTIFY_EMAIL,
        subject: '🛒 ออเดอร์ใหม่ ' + (p.order_id || '') + ' — ' + (p.name || '') + ' — ' + (p.total || '') + ' THB',
        body: [
          'ออเดอร์: ' + (p.order_id || ''),
          'ชื่อ    : ' + (p.name || ''),
          'เบอร์   : ' + (p.phone || ''),
          'ที่อยู่  : ' + (p.address || '') + ' ' + (p.province || '') + ' ' + (p.zip || ''),
          'สินค้า  : ' + (p.product || '') + ' (' + (p.pack || '') + ')',
          'ยอดรวม : ' + (p.total || '') + ' ' + (p.currency || 'THB'),
          'หมายเหตุ: ' + (p.note || '-'),
          '',
          'UTM: ' + (p.utm || '-'),
          'Page: ' + (p.page_url || '-')
        ].join('\n')
      });
    }

    return json_({ ok: true, order_id: p.order_id || '' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json_({ ok: true, msg: 'LP order endpoint is live' });
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#F5F7FB');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
