/* ===== OCR 解析：由 Tesseract TSV 重組行、分類、抽取資料 ===== */
const Parser = (() => {
  const MONEY = /(\d{1,3}(?:,\d{3})+|\d+)\.(\d{2})/g;
  const toNum = (s) => parseFloat(String(s).replace(/,/g, ''));
  const cjkCount = (s) => (s.match(/[一-鿿]/g) || []).length;

  function parseTSV(tsv) {
    const words = [];
    const lines = tsv.split('\n');
    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split('\t');
      if (c.length < 12 || c[0] !== '5') continue;
      const text = c.slice(11).join('\t').trim();
      if (!text) continue;
      words.push({ x: +c[6], y: +c[7], w: +c[8], h: +c[9], conf: +c[10], text });
    }
    return words;
  }

  /* 把字按高度聚成視覺行，再按水平空隙切成欄段 */
  function buildRows(words) {
    const ws = [...words].sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2));
    const rows = [];
    for (const w of ws) {
      const cy = w.y + w.h / 2;
      let row = null;
      for (let k = rows.length - 1; k >= Math.max(0, rows.length - 4); k--) {
        const r = rows[k];
        if (Math.abs(r.cy - cy) < Math.max(r.h, w.h) * 0.5) { row = r; break; }
      }
      if (row) { row.words.push(w); row.h = Math.max(row.h, w.h); }
      else rows.push({ cy, h: w.h, words: [w] });
    }
    for (const r of rows) {
      r.words.sort((a, b) => a.x - b.x);
      const segs = [[r.words[0]]];
      for (let i = 1; i < r.words.length; i++) {
        const a = r.words[i], p = segs[segs.length - 1].at(-1);
        const gap = a.x - (p.x + p.w);
        if (gap > Math.max(p.h, a.h) * 2.5) segs.push([a]); else segs[segs.length - 1].push(a);
      }
      r.segs = segs.map((s) => ({
        text: s.map((w) => w.text).join(latinJoin(s) ? ' ' : ''),
        x: s[0].x, x2: s.at(-1).x + s.at(-1).w,
        y: Math.min(...s.map((w) => w.y)), y2: Math.max(...s.map((w) => w.y + w.h)),
      }));
      r.text = r.segs.map((s) => s.text).join(' | ');
      r.y = Math.min(...r.words.map((w) => w.y));
      r.y2 = Math.max(...r.words.map((w) => w.y + w.h));
    }
    return rows;
  }
  function latinJoin(s) { return s.every((w) => /^[\x20-\x7e]+$/.test(w.text)); }

  function classify(text) {
    const t = text.replace(/\s/g, '');
    const has = (re) => re.test(t);
    let pps = 0, tb = 0, rc = 0;
    if (has(/付[款欵]方[式武]/)) pps += 2;
    if (has(/T200P\d{6,}/i)) pps += 3;
    if (has(/[商啇][户戶][订訂][单單]/)) pps += 2;
    if (has(/[汇匯其区阶]率|1CNY=/i)) pps += 2;
    if (has(/[手于][续續][费費]/)) pps += 1;
    if (has(/HKD[\d.,]+\(CNY/i)) pps += 3;
    if (has(/[订訂][单單哩][编編][号號]/)) tb += 3;
    if (has(/[实實]付款/)) tb += 2;
    if (has(/拍下宝贝|买家付款|卖家发货|交易快照|商品总价|加入购物车|申请售后/)) tb += 3;
    if (has(/[发發][票栗]|[开開][标票]日期|价税合计|税率|纳税人/)) rc += 3;
    if (has(/收[据據]|RECEIPT|今收到|收款/i)) rc += 3;
    if (pps >= 4 && pps >= tb) return 'pps';
    if (tb >= 3 && tb > rc) return 'taobao';
    return 'receipt';
  }

  const moneyIn = (s) => { const m = [...s.matchAll(MONEY)]; return m.map((x) => toNum(x[0])); };
  const rowAfter = (rows, re) => rows.find((r) => re.test(r.text.replace(/\s/g, '')));

  function parsePPS(rows, text) {
    const flat = text.replace(/\s/g, '');
    const out = { kind: 'pps' };
    // 訂單金額 HKD 545.00(CNY 466.81)
    const om = flat.match(/HKD([\d,]+\.\d{2})\(CNY([\d,]+\.\d{2})\)/i);
    if (om) { out.orderHKD = toNum(om[1]); out.cny = toNum(om[2]); }
    const feeRow = rowAfter(rows, /[手于][续續][费費悍]/);
    if (feeRow) { const m = feeRow.text.match(/HKD\s*([\d,]+\.\d{2})/i) || feeRow.text.match(/([\d,]+\.\d{2})/); if (m) out.fee = toNum(m[1]); }
    const rate = flat.match(/1CNY=([\d.]+)HKD/i); if (rate) out.rate = parseFloat(rate[1]);
    if (out.orderHKD != null) out.hkd = Math.round((out.orderHKD + (out.fee || 0)) * 100) / 100;
    // 大字金額（只作核對）
    const big = rows.slice(0, 6).map((r) => r.text).join(' ').match(/([\d,]+\.\d{2})/);
    if (big) out.bigHKD = toNum(big[1]);
    if (out.hkd == null && out.bigHKD != null) out.hkd = out.bigHKD;
    const on = flat.match(/T200P(\d{15,20})/i); if (on) out.orderNo = on[1];
    const dt = flat.match(/(\d{2})\/(\d{2})\/(\d{2})(\d{2}:\d{2}(?::\d{2})?)?/);
    if (dt) out.date = `20${dt[3]}-${dt[2]}-${dt[1]}`;
    const shopRow = rowAfter(rows, /[订訂][单單哩]?[详詳][情]/);
    if (shopRow && shopRow.segs.length > 1) out.shop = shopRow.segs.slice(1).map((s) => s.text).join('').replace(/[与與]其他.*$/, '').trim();
    // 備註：備註行起至結尾
    const ri = rows.findIndex((r) => /[备備][注註]/.test(r.text.replace(/\s/g, '')) || (r.segs.length > 1 && /^[^\d]{0,3}[注註]$/.test(r.segs[0].text)));
    let startIdx = ri, skipFirst = true;
    if (ri < 0) { const oi = rows.findIndex((r) => /T200P/i.test(r.text)); if (oi >= 0 && oi + 1 < rows.length) { startIdx = oi + 1; skipFirst = rows[oi + 1].segs.length > 1; } }
    if (startIdx >= 0) {
      const ri = startIdx;
      const parts = [];
      rows.slice(ri).forEach((r, i) => {
        const segs = i === 0 && skipFirst ? r.segs.slice(1) : r.segs;
        segs.forEach((s) => parts.push(s.text));
      });
      out.remark = parts.join('').replace(/\s+/g, ' ').trim();
    }
    return out;
  }

  function parseTaobao(rows, text, imgW) {
    const out = { kind: 'taobao', titles: [] };
    const flat = text.replace(/\s/g, '');
    const noRow = rowAfter(rows, /[订訂][单單哩][编編][号號]/);
    let m = noRow && noRow.text.replace(/\s/g, '').match(/(\d{17,20})/);
    if (!m) m = flat.match(/[订訂][单單哩][编編][号號]\D{0,4}(\d{17,20})/);
    if (!m) { const all = [...flat.matchAll(/(?<!\d)(\d{18,19})(?!\d)/g)].map((x) => x[1]).filter((x) => !/^20\d{2}/.test(x)); if (all.length) m = [0, all[0]]; }
    if (m) out.orderNo = m[1];
    const payRow = rowAfter(rows, /[实實]付款/);
    let hk = payRow && payRow.text.match(/HKD\s*([\d,]+\.\d{2})/i);
    if (!hk) { const all = [...flat.matchAll(/HKD([\d,]+\.\d{2})/gi)].map((x) => toNum(x[1])); if (all.length) hk = [0, Math.max(...all)]; }
    if (hk) out.hkd = toNum(hk[1]);
    const totRow = rowAfter(rows, /商品[总總]价/);
    if (totRow) { const v = moneyIn(totRow.text); if (v.length) out.goodsCNY = v.at(-1); }
    let disc = 0;
    rows.filter((r) => /优惠|立减|红包|券|折扣/.test(r.text) && /-/.test(r.text)).forEach((r) => { const v = moneyIn(r.text); if (v.length) disc += v.at(-1); });
    out.discountCNY = disc;
    let ship = 0;
    rows.filter((r) => /[运運]费/.test(r.text) && !/海外|HKD/i.test(r.text)).forEach((r) => { const v = moneyIn(r.text); if (v.length) ship += v.at(-1); });
    out.shipCNY = ship;
    const dts = [...flat.matchAll(/(20\d{2})-(\d{2})-(\d{2})/g)];
    if (dts.length) out.date = `${dts[0][1]}-${dts[0][2]}-${dts[0][3]}`;
    // 商品標題：左欄、長中文、非物流/地址
    const BAD = /快递|快遞|物流|签收|簽收|已送达|运费|地址|省.*市|[区區].*[路街号號]|价保|退款|退货|售后|购物车|交易成功|交易快照|订单|收货|发票|评价|再买|删除|特别行政区|转运|集运|仓|电话|联系|微信|公众号|官方物流|旗舰店|专营店|旗艦店|^\W*$/;
    const leftLimit = imgW ? imgW * 0.68 : Infinity;
    const itemPrices = [];
    rows.forEach((r, idx) => {
      r.segs.forEach((s) => {
        if (s.x > leftLimit) return;
        const t = s.text.replace(/\s/g, '');
        if (cjkCount(t) < 8 || BAD.test(t)) return;
        // 去掉黏住的價錢
        const clean = t.replace(/[¥羊半芋苦对芭￥]?\d+\.\d{2}.*$/, '');
        if (cjkCount(clean) < 8) return;
        out.titles.push(clean);
      });
      if (/(¥|羊|半|芋|￥)?\d+\.\d{2}/.test(r.text) && (!imgW || r.segs.some((s) => s.x < leftLimit && s.x2 > imgW * 0.5))) {
        const v = r.segs.filter((s) => s.x < leftLimit).flatMap((s) => moneyIn(s.text));
        if (v.length) itemPrices.push(v[0]);
      }
    });
    // 合併斷開的標題（同一商品標題被切成兩行時，短的併入前一個）
    out.titles = dedupe(out.titles);
    out.itemPrices = itemPrices;
    return out;
  }
  function dedupe(arr) {
    const res = [];
    for (const t of arr) {
      if (res.some((r) => r.includes(t) || t.includes(r) || similar(r, t) > 0.8)) continue;
      res.push(t);
    }
    return res;
  }
  function similar(a, b) {
    const A = new Set(a), B = new Set(b);
    let n = 0; A.forEach((c) => { if (B.has(c)) n++; });
    return n / Math.max(A.size, B.size);
  }

  function parseReceipt(rows, text) {
    const out = { kind: 'receipt' };
    const flat = text.replace(/\s/g, '');
    out.isInvoice = /[发發][票栗]|价税合计|纳税人|税率/.test(flat);
    const small = flat.match(/[(（]小[写寫号號][)）]\D{0,2}([\d,]+\.\d{2})/);
    if (small) out.cny = toNum(small[1]);
    if (out.cny == null) {
      const tot = rows.find((r) => /价税合计|合[计計]|金[额額]|[¥￥]/.test(r.text) && /\d+\.\d{2}/.test(r.text));
      if (tot) { const v = moneyIn(tot.text); if (v.length) out.cny = Math.max(...v); }
    }
    const on = flat.match(/[订訂][单單][编編]?[号號]\D{0,3}(\d{17,20})/); if (on) out.orderNo = on[1];
    const d = flat.match(/(20\d{2})年(\d{1,2})月(\d{1,2})日/); if (d) out.date = `${d[1]}-${d[2].padStart(2, '0')}-${d[3].padStart(2, '0')}`;
    const seller = rows.map((r) => r.text).join('|').match(/名称[:：]?([^|]*?(?:公司|商行|店|厂|廠))/g);
    if (seller && seller.length) out.seller = seller.at(-1).replace(/^名称[:：]?/, '');
    return out;
  }

  /* PPS 截圖的自動裁剪：由「淘寶交易」標題（或金額）開始，到最後一行文字為止 */
  function autoCropFromWords(kind, words, W, H) {
    if (!words.length) return null;
    const rows = buildRows(words.filter((w) => w.h < H * 0.2 && w.conf > 20));
    if (!rows.length) return null;
    let top = rows[0].y, bottom = rows.at(-1).y2;
    if (kind === 'pps') {
      // 原始 iPhone 截圖（很長）先跳過頂部狀態列；已裁過的截圖由頂開始
      if (H / W > 2) { const first = buildRows(words.filter((w) => w.h < H * 0.2)).find((r) => r.y > H * 0.045); if (first) top = first.y; }
      else top = Math.min(top, H * 0.02);
      const ri = rows.findIndex((r) => /[备備][注註]/.test(r.text.replace(/\s/g, '')));
      if (ri >= 0) { let end = ri; while (end + 1 < rows.length && rows[end + 1].y - rows[end].y2 < rows[end].h * 1.6) end++; bottom = rows[end].y2; }
      const pad = W * 0.04;
      return clampCrop({ x: 0, y: (top - pad) / H, w: 1, h: (bottom - top + pad * 2) / H });
    }
    const left = Math.min(...words.map((w) => w.x)), right = Math.max(...words.map((w) => w.x + w.w));
    const pad = W * 0.02;
    return clampCrop({ x: (left - pad) / W, y: (top - pad) / H, w: (right - left + pad * 2) / W, h: (bottom - top + pad * 2) / H });
  }
  function clampCrop(c) {
    const x = Math.max(0, c.x), y = Math.max(0, c.y);
    return { x, y, w: Math.min(1 - x, c.w + Math.min(0, c.x)), h: Math.min(1 - y, c.h + Math.min(0, c.y)) };
  }

  function analyse(tsv, text, W, H) {
    const words = parseTSV(tsv);
    const rows = buildRows(words);
    const joined = rows.map((r) => r.text).join('\n');
    const kind = classify(joined + '\n' + (text || ''));
    let data;
    if (kind === 'pps') data = parsePPS(rows, joined);
    else if (kind === 'taobao') data = parseTaobao(rows, joined, W);
    else data = parseReceipt(rows, joined);
    data.crop = autoCropFromWords(kind, words, W, H);
    data.rawRows = rows.map((r) => r.text);
    return data;
  }
  /* 純文字（PDF 電子發票文字層） */
  function analyseText(text) {
    const lines = text.split('\n').map((t) => ({ text: t, segs: [{ text: t, x: 0, x2: 1 }] }));
    const kind = classify(text);
    if (kind === 'pps') return parsePPS(lines, text);
    if (kind === 'taobao') return parseTaobao(lines, text, 0);
    return parseReceipt(lines, text);
  }
  return { analyse, analyseText, parseTSV, buildRows, classify };
})();
if (typeof module !== 'undefined') module.exports = Parser;
