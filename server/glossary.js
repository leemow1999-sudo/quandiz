// Từ điển thuật ngữ buôn hàng 1688 / Taobao.
// Dùng 2 việc: (1) nhồi vào prompt cho Claude dịch đúng "tiếng lóng" ngành,
// (2) đổ ra panel tra cứu nhanh ở giao diện.

export const GLOSSARY = [
  { zh: '亲', pinyin: 'qīn', vi: 'bạn ơi / shop ơi (cách xưng hô thân mật của người bán TQ)', group: 'Giao tiếp' },
  { zh: '老板', pinyin: 'lǎobǎn', vi: 'ông chủ / anh chị (gọi khách sỉ)', group: 'Giao tiếp' },
  { zh: '亲爱的', pinyin: 'qīn ài de', vi: 'bạn thân mến (xã giao, không phải tỏ tình)', group: 'Giao tiếp' },
  { zh: '加微信', pinyin: 'jiā wēixìn', vi: 'kết bạn WeChat', group: 'Giao tiếp' },

  { zh: '起订量 / 起批量', pinyin: 'qǐdìngliàng', vi: 'số lượng đặt tối thiểu (MOQ)', group: 'Giá & đơn hàng' },
  { zh: '批发价', pinyin: 'pīfājià', vi: 'giá sỉ', group: 'Giá & đơn hàng' },
  { zh: '零售价', pinyin: 'língshòujià', vi: 'giá lẻ', group: 'Giá & đơn hàng' },
  { zh: '拿货价', pinyin: 'náhuòjià', vi: 'giá lấy hàng', group: 'Giá & đơn hàng' },
  { zh: '单价', pinyin: 'dānjià', vi: 'đơn giá', group: 'Giá & đơn hàng' },
  { zh: '报价', pinyin: 'bàojià', vi: 'báo giá', group: 'Giá & đơn hàng' },
  { zh: '改价', pinyin: 'gǎijià', vi: 'sửa giá (shop sửa giá trên đơn)', group: 'Giá & đơn hàng' },
  { zh: '优惠', pinyin: 'yōuhuì', vi: 'ưu đãi / giảm giá', group: 'Giá & đơn hàng' },
  { zh: '拍下 / 下单', pinyin: 'pāixià / xiàdān', vi: 'bấm mua / đặt đơn', group: 'Giá & đơn hàng' },
  { zh: '一件代发', pinyin: 'yī jiàn dài fā', vi: 'dropship — mua 1 cái cũng gửi', group: 'Giá & đơn hàng' },
  { zh: '混批 / 混色', pinyin: 'hùnpī / hùnsè', vi: 'mua sỉ trộn nhiều mẫu / nhiều màu', group: 'Giá & đơn hàng' },
  { zh: '含税', pinyin: 'hánshuì', vi: 'đã bao gồm thuế', group: 'Giá & đơn hàng' },

  { zh: '现货', pinyin: 'xiànhuò', vi: 'hàng có sẵn', group: 'Hàng hoá' },
  { zh: '缺货', pinyin: 'quēhuò', vi: 'hết hàng', group: 'Hàng hoá' },
  { zh: '补货', pinyin: 'bǔhuò', vi: 'nhập thêm hàng', group: 'Hàng hoá' },
  { zh: '断码', pinyin: 'duànmǎ', vi: 'thiếu size', group: 'Hàng hoá' },
  { zh: '库存', pinyin: 'kùcún', vi: 'tồn kho', group: 'Hàng hoá' },
  { zh: '尺码', pinyin: 'chǐmǎ', vi: 'size', group: 'Hàng hoá' },
  { zh: '材质', pinyin: 'cáizhì', vi: 'chất liệu', group: 'Hàng hoá' },
  { zh: '规格', pinyin: 'guīgé', vi: 'quy cách / thông số', group: 'Hàng hoá' },
  { zh: '款式', pinyin: 'kuǎnshì', vi: 'kiểu dáng / mẫu mã', group: 'Hàng hoá' },
  { zh: '色差', pinyin: 'sèchā', vi: 'lệch màu so với ảnh', group: 'Hàng hoá' },
  { zh: '定制', pinyin: 'dìngzhì', vi: 'đặt làm theo yêu cầu (custom)', group: 'Hàng hoá' },
  { zh: '打样 / 样品', pinyin: 'dǎyàng / yàngpǐn', vi: 'làm mẫu / hàng mẫu', group: 'Hàng hoá' },
  { zh: '工期', pinyin: 'gōngqī', vi: 'thời gian sản xuất', group: 'Hàng hoá' },
  { zh: '工厂 / 档口', pinyin: 'gōngchǎng / dàngkǒu', vi: 'xưởng sản xuất / sạp chợ sỉ', group: 'Hàng hoá' },
  { zh: '链接', pinyin: 'liànjiē', vi: 'link sản phẩm', group: 'Hàng hoá' },
  { zh: '实拍', pinyin: 'shípāi', vi: 'ảnh/video chụp thật', group: 'Hàng hoá' },

  { zh: '发货', pinyin: 'fāhuò', vi: 'gửi hàng / xuất hàng', group: 'Vận chuyển' },
  { zh: '包邮', pinyin: 'bāoyóu', vi: 'miễn phí vận chuyển', group: 'Vận chuyển' },
  { zh: '运费', pinyin: 'yùnfèi', vi: 'phí vận chuyển', group: 'Vận chuyển' },
  { zh: '到付', pinyin: 'dàofù', vi: 'người nhận trả phí ship', group: 'Vận chuyển' },
  { zh: '快递', pinyin: 'kuàidì', vi: 'chuyển phát nhanh', group: 'Vận chuyển' },
  { zh: '物流', pinyin: 'wùliú', vi: 'vận chuyển / logistics', group: 'Vận chuyển' },
  { zh: '快递单号', pinyin: 'kuàidì dānhào', vi: 'mã vận đơn', group: 'Vận chuyển' },
  { zh: '揽收', pinyin: 'lǎnshōu', vi: 'shipper đã lấy hàng', group: 'Vận chuyển' },
  { zh: '签收', pinyin: 'qiānshōu', vi: 'đã ký nhận hàng', group: 'Vận chuyển' },
  { zh: '集运仓 / 转运仓', pinyin: 'jíyùn cāng', vi: 'kho gom hàng / kho trung chuyển', group: 'Vận chuyển' },
  { zh: '打包 / 加固', pinyin: 'dǎbāo / jiāgù', vi: 'đóng gói / gia cố kiện hàng', group: 'Vận chuyển' },
  { zh: '木架', pinyin: 'mùjià', vi: 'đóng khung gỗ', group: 'Vận chuyển' },
  { zh: '易碎', pinyin: 'yìsuì', vi: 'hàng dễ vỡ', group: 'Vận chuyển' },

  { zh: '付款', pinyin: 'fùkuǎn', vi: 'thanh toán', group: 'Thanh toán & sau bán' },
  { zh: '定金 / 尾款', pinyin: 'dìngjīn / wěikuǎn', vi: 'tiền cọc / tiền còn lại', group: 'Thanh toán & sau bán' },
  { zh: '退款', pinyin: 'tuìkuǎn', vi: 'hoàn tiền', group: 'Thanh toán & sau bán' },
  { zh: '退货 / 换货', pinyin: 'tuìhuò / huànhuò', vi: 'trả hàng / đổi hàng', group: 'Thanh toán & sau bán' },
  { zh: '售后', pinyin: 'shòuhòu', vi: 'hậu mãi / xử lý sau bán', group: 'Thanh toán & sau bán' },
  { zh: '质量问题', pinyin: 'zhìliàng wèntí', vi: 'lỗi chất lượng', group: 'Thanh toán & sau bán' },
  { zh: '瑕疵', pinyin: 'xiácī', vi: 'tì vết / lỗi nhỏ', group: 'Thanh toán & sau bán' },
  { zh: '补偿', pinyin: 'bǔcháng', vi: 'bồi thường / bù tiền', group: 'Thanh toán & sau bán' },
];

/** Bảng thuật ngữ dạng text, nhét vào system prompt (giữ cố định để cache prompt). */
export const GLOSSARY_PROMPT = GLOSSARY
  .map((t) => `${t.zh} = ${t.vi}`)
  .join('\n');

export const QUICK_PHRASES = [
  {
    group: 'Mở lời',
    items: [
      { vi: 'Xin chào shop, mình quan tâm sản phẩm này.', zh: '你好，我对这款产品有兴趣。' },
      { vi: 'Shop ơi, mẫu này còn hàng không?', zh: '亲，这款还有现货吗？' },
      { vi: 'Mình ở Việt Nam, muốn nhập hàng lâu dài.', zh: '我在越南，想长期拿货。' },
    ],
  },
  {
    group: 'Hỏi giá',
    items: [
      { vi: 'Giá sỉ bao nhiêu một cái?', zh: '批发价多少钱一件？' },
      { vi: 'Đặt tối thiểu bao nhiêu cái?', zh: '起订量是多少件？' },
      { vi: 'Lấy 100 cái có giảm giá không?', zh: '拿100件有优惠吗？' },
      { vi: 'Bạn báo giá tốt nhất giúp mình nhé.', zh: '请给我最优惠的价格。' },
      { vi: 'Giá này đã bao gồm thuế chưa?', zh: '这个价格含税吗？' },
    ],
  },
  {
    group: 'Hỏi hàng',
    items: [
      { vi: 'Cho mình xin video thực tế của sản phẩm.', zh: '可以发一下产品实拍视频吗？' },
      { vi: 'Có những màu và size nào?', zh: '有哪些颜色和尺码？' },
      { vi: 'Chất liệu là gì?', zh: '材质是什么？' },
      { vi: 'Có nhận in logo theo yêu cầu không?', zh: '可以定制印logo吗？' },
      { vi: 'Mình mua trộn nhiều mẫu được không?', zh: '可以混批吗？' },
      { vi: 'Hàng có giống ảnh không, có bị lệch màu không?', zh: '实物和图片一样吗？会不会有色差？' },
    ],
  },
  {
    group: 'Vận chuyển',
    items: [
      { vi: 'Mấy ngày thì gửi hàng?', zh: '几天发货？' },
      { vi: 'Phí ship nội địa bao nhiêu?', zh: '国内运费多少？' },
      { vi: 'Gửi giúp mình về kho gom hàng ở Quảng Châu.', zh: '麻烦发到广州的集运仓。' },
      { vi: 'Đóng gói kỹ giúp mình nhé, hàng dễ vỡ.', zh: '麻烦包装加固，商品易碎。' },
      { vi: 'Cho mình xin mã vận đơn.', zh: '麻烦发一下快递单号。' },
    ],
  },
  {
    group: 'Chốt đơn',
    items: [
      { vi: 'Mình đặt 10 cái mẫu này.', zh: '我要拍10件这个款。' },
      { vi: 'Sửa giá giúp mình rồi mình đặt luôn.', zh: '麻烦改一下价格，我马上下单。' },
      { vi: 'Mình đã thanh toán rồi, shop kiểm tra giúp.', zh: '我已经付款了，麻烦确认一下。' },
    ],
  },
  {
    group: 'Sau bán',
    items: [
      { vi: 'Hàng nhận được bị lỗi, mình gửi ảnh cho bạn xem.', zh: '收到的货有质量问题，我发图片给你看。' },
      { vi: 'Mình muốn đổi hoặc trả hàng.', zh: '我想退换货。' },
      { vi: 'Bạn bù cho mình một phần được không?', zh: '可以补偿一部分吗？' },
      { vi: 'Lần sau mình vẫn lấy hàng của bạn, mong bạn hỗ trợ.', zh: '下次我还会继续拿你家的货，希望你多多支持。' },
    ],
  },
];
