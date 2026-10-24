(() => {
'use strict';
/* ================= 常數 ================= */
const LOCAL = !!(window.PF_LIBS && window.PF_LIBS.local);
const CDN = Object.assign({
  tess: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  opencc: 'https://cdn.jsdelivr.net/npm/opencc-js@1.0.5/dist/umd/full.js',
  pdfjs: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfjsWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
}, window.PF_LIBS || {});
const absURL = (u) => new URL(u, location.href).href;
const LS_KEY = 'gwjl-settings-v1';
const FORM_FONT = '"Times New Roman", Times, "DFKai-SB", "BiauKai", "標楷體", "LXGW WenKai TC", "Kaiti TC", serif';
const SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
const MAX_SIDE = 2600;

const FIELDS = [
  { k: 'reason', label: '購物原因', opt: 'reason' },
  { k: 'location', label: '貯放位置', opt: 'location' },
  { k: 'dept', label: '支付款項組別', opt: 'dept' },
  { k: 'subgroup', label: '組別內的小組（如適用）', opt: 'subgroup' },
  { k: 'category', label: '支付款項類別', opt: 'category' },
  { k: 'grant', label: '那一筆津貼 (grant) 支付', opt: 'grant' },
  { k: 'person', label: '組別負責人姓名', opt: 'person' },
  { k: 'rdate', label: '日期', opt: null },
];
const OPT_LABELS = { reason: '購物原因', location: '貯放位置', dept: '支付款項組別', subgroup: '組別內的小組', category: '支付款項類別', grant: '津貼 (grant)', person: '組別負責人姓名' };

const DEFAULT_RULES = `送料|挤出机|挤出|喷嘴|喷头|热端|硅胶套|打印头|擦嘴|清洁针|热敏电阻 = 3D打印配件
PEI|打印板|热床|打印平台|磁吸板 = 3D打印板
PLA|PETG|ABS耗材|打印耗材|线材|耗材 = 3D打印耗材
3D打印 = 3D打印配件
杀菌灯|紫外线灯|UV灯|消毒灯|灭菌灯 = UV消毒燈
推杆|推桿 = 推桿
抽湿|除湿 = 抽濕機
502|强力胶|瞬间胶|快干胶 = 502強力膠
热熔胶 = 熱熔膠
AB胶 = AB膠
溶解液|解胶|除胶 = 膠溶解液
胶纸|胶带|美纹纸 = 膠紙
胶水 = 膠水
杜邦线 = 杜邦線
继电器 = 繼電器
舵机|servo = SERVO MOTOR
步进电机 = 步進摩打
电机|马达 = 摩打
水泵 = 水泵
扩展板 = 擴展板
micro:bit|microbit = micro:bit
arduino = Arduino
esp32 = ESP32
树莓派|raspberry = Raspberry Pi
传感器|感应器|探测器 = 感應器
发热片|加热片 = 發熱片
编程小车|智能小车|小车底盘 = 編程小車
机械臂 = 機械臂
机械车|机器人车 = 機械車
按钮|按键 = 按鈕
开关 = 開關
电池|锂电 = 電池
充电器 = 充電器
面包板 = 麵包板
数据线|USB线 = 數據線
电线|导线|硅胶线 = 電線
霓虹 = 霓虹燈帶
灯带 = LED燈帶
LED = LED燈
黑卡 = 黑卡紙
卡纸 = 卡紙
亚克力 = 亞克力板
椴木|木板|夹板 = 木板
螺丝|螺母|螺栓 = 螺絲
齿轮 = 齒輪
轴承 = 軸承
显示屏|OLED|LCD|屏幕 = 顯示屏
摄像头 = 鏡頭
喇叭|扬声器 = 喇叭
电源|适配器 = 電源適配器
万用表 = 萬用表
烙铁|焊锡 = 焊接工具`;
const DEFAULT_STOP = '包郵|包邮|正品|現貨|现货|官方|旗艦店|旗舰店|專營店|专营店|新款|爆款|熱賣|热卖|促銷|促销|特價|特价|順豐|顺丰|當天發|当天发|批發|批发|廠家|厂家|直銷|直销|高品質|高品质|超強|超强|升級版|升级版|適用|适用|專用|专用|2024|2025|2026|多件|等';

const DEFAULT_SETTINGS = {
  v: 1, payee: 'YCH', applicant: 'YCH', layout: 'sets', attach: true, caption: true,
  defaults: { reason: '比賽', consumable: true, location: '', dept: '', subgroup: '', category: '', grant: '', person: '', rdate: '' },
  options: {
    reason: ['比賽', '課程', '活動', '佈置壁報'],
    location: ['N204'],
    dept: ['CCA', '電腦科', '設計與科技科'],
    subgroup: ['School team/Club'],
    category: ['Others'],
    grant: ['School & Class Grant', 'Subject Grant'],
    person: ['CH'],
  },
  rulesText: DEFAULT_RULES,
  stopText: DEFAULT_STOP,
};

/* ================= 狀態 ================= */
const S = {
  settings: clone(DEFAULT_SETTINGS),
  images: new Map(), orders: [], rows: [], openRows: new Set(), deleted: new Set(), active: 'inbox', restoring: false,
  ocr: { worker: null, starting: null, failed: null, queue: [], busy: false },
  conv: null, convTried: false, sync: { ref: null },
};
let seq = 1;
const uid = (p) => `${p}${seq++}`;
function clone(o) { return JSON.parse(JSON.stringify(o)); }
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (v) => (v == null || isNaN(v) ? '' : v.toFixed(2));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
function toast(msg, ms = 2600) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; t.setAttribute('role', 'status');
  document.body.appendChild(t); setTimeout(() => t.remove(), ms);
}
const scriptCache = {};
function loadScript(src) {
  if (!scriptCache[src]) scriptCache[src] = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = res; s.onerror = () => { delete scriptCache[src]; rej(new Error('未能載入 ' + src.split('/').slice(2, 5).join('/'))); };
    document.head.appendChild(s);
  });
  return scriptCache[src];
}
const withTimeout = (p, ms, msg) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);
const claudeUse = async (name) => { try { return window.claude?.use ? await window.claude.use(name) : null; } catch { return null; } };

/* ================= 設定：本機 + 帳戶同步 ================= */
function mergeSettings(obj) {
  if (!obj || typeof obj !== 'object') return;
  const d = clone(DEFAULT_SETTINGS);
  const s = { ...d, ...obj, defaults: { ...d.defaults, ...(obj.defaults || {}) }, options: { ...d.options, ...(obj.options || {}) } };
  S.settings = s;
}
function loadLocal() { try { const raw = localStorage.getItem(LS_KEY); if (raw) mergeSettings(JSON.parse(raw)); } catch { /* 私密瀏覽等情況 */ } }
async function initSync() {
  const [db, user] = await Promise.all([claudeUse('db'), claudeUse('user')]);
  if (!db || !user) return;
  try {
    const id = await user.id(); if (!id) return;
    const ref = db.doc(`data/users/${id}/settings`);
    const snap = await ref.get();
    S.sync.ref = ref;
    if (snap.exists) { const j = snap.data().json; if (j) { mergeSettings(JSON.parse(j)); afterSettingsChange(); } }
    $('#syncChip').textContent = '已同步到你的帳戶'; $('#syncChip').className = 'chip ok';
  } catch { /* 留在本機 */ }
}
const saveSettings = debounce(async () => {
  const json = JSON.stringify(S.settings);
  try { localStorage.setItem(LS_KEY, json); } catch { }
  if (S.sync.ref) { try { await S.sync.ref.set({ json, updatedAt: new Date().toISOString() }); } catch { } }
}, 800);
function rememberOption(opt, value) {
  const v = (value || '').trim(); if (!opt || !v) return;
  const list = S.settings.options[opt] || (S.settings.options[opt] = []);
  if (!list.includes(v)) { list.push(v); buildDatalists(); saveSettings(); }
}

/* ================= 簡轉繁 + 名稱精簡 ================= */
async function ensureConv() {
  if (S.conv || S.convTried) return S.conv;
  S.convTried = true;
  try {
    await withTimeout(loadScript(CDN.opencc), 20000, 'OpenCC 逾時');
    S.conv = window.OpenCC.Converter({ from: 'cn', to: 'hk' });
  } catch (e) { console.warn(e); S.conv = null; }
  return S.conv;
}
const toHK = (s) => { try { return S.conv ? S.conv(s) : s; } catch { return s; } };
function parseRules(text) {
  return (text || '').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => {
    const i = l.lastIndexOf('=');
    return { keys: l.slice(0, i).split('|').map((k) => k.trim().toLowerCase()).filter(Boolean), name: l.slice(i + 1).trim() };
  }).filter((r) => r.keys.length && r.name);
}
function shorten(title) {
  let s = toHK(title || '');
  s = s.replace(/【[^】]*】|\[[^\]]*\]|（[^）]*）|\([^)]*\)/g, ' ');
  const stops = (S.settings.stopText || '').split('|').map((w) => w.trim()).filter(Boolean).sort((a, b) => b.length - a.length);
  for (const w of stops) s = s.split(w).join(' ');
  s = s.replace(/[，,。.!！?？…]+$/g, '').replace(/\s+/g, ' ').trim();
  const chars = [...s];
  return chars.length > 14 ? chars.slice(0, 14).join('').trim() : s;
}
function suggestName(titles) {
  if (!titles.length) return '';
  const rules = parseRules(S.settings.rulesText);
  const names = [];
  for (const t of titles) {
    const hay = (t + ' ' + toHK(t)).toLowerCase();
    const r = rules.find((r) => r.keys.some((k) => hay.includes(k) || hay.includes(toHK(k).toLowerCase())));
    if (r && !names.includes(r.name)) names.push(r.name);
  }
  if (names.length) return names.length > 3 ? names.slice(0, 3).join('、') + '等' : names.join('、');
  return shorten(titles[0]);
}

/* ================= 圖片處理 ================= */
function canvasFrom(src, w, h) {
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale); c.height = Math.round(h * scale);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
async function fileToCanvas(file) {
  if ('createImageBitmap' in window) {
    try { const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); const c = canvasFrom(bmp, bmp.width, bmp.height); bmp.close?.(); return c; } catch { }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('無法讀取圖片')); i.src = url; });
    return canvasFrom(img, img.naturalWidth, img.naturalHeight);
  } finally { URL.revokeObjectURL(url); }
}
function oriented(img) {
  if (!img.rot) return img.base;
  if (img._rot && img._rot.r === img.rot) return img._rot.c;
  const b = img.base, r = img.rot % 360, c = document.createElement('canvas');
  const swap = r === 90 || r === 270;
  c.width = swap ? b.height : b.width; c.height = swap ? b.width : b.height;
  const g = c.getContext('2d'); g.translate(c.width / 2, c.height / 2); g.rotate(r * Math.PI / 180); g.drawImage(b, -b.width / 2, -b.height / 2);
  img._rot = { r: img.rot, c }; return c;
}
function cropped(img) {
  const o = oriented(img), cr = img.crop;
  const key = `${img.rot}|${cr.x}|${cr.y}|${cr.w}|${cr.h}`;
  if (img._crop && img._crop.key === key) return img._crop.c;
  const sx = Math.round(cr.x * o.width), sy = Math.round(cr.y * o.height);
  const sw = Math.max(1, Math.round(cr.w * o.width)), sh = Math.max(1, Math.round(cr.h * o.height));
  const c = document.createElement('canvas'); c.width = sw; c.height = sh;
  c.getContext('2d').drawImage(o, sx, sy, sw, sh, 0, 0, sw, sh);
  img._crop = { key, c }; img._thumb = null; img._big = null; return c;
}
function thumbURL(img) {
  if (img._thumb) return img._thumb;
  const c = cropped(img), sc = Math.min(1, 320 / Math.max(c.width, c.height));
  const t = document.createElement('canvas'); t.width = Math.max(1, Math.round(c.width * sc)); t.height = Math.max(1, Math.round(c.height * sc));
  t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
  img._thumb = t.toDataURL('image/jpeg', 0.8); return img._thumb;
}
/* 像素裁邊：去掉四周單色的邊 */
function trimBorders(canvas) {
  const w = canvas.width, h = canvas.height, sc = Math.min(1, 600 / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * sc)), th = Math.max(1, Math.round(h * sc));
  const t = document.createElement('canvas'); t.width = tw; t.height = th;
  const g = t.getContext('2d', { willReadFrequently: true }); g.drawImage(canvas, 0, 0, tw, th);
  const d = g.getImageData(0, 0, tw, th).data;
  const px = (x, y) => { const i = (y * tw + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
  const bg = px(0, 0);
  const diff = (p) => Math.abs(p[0] - bg[0]) + Math.abs(p[1] - bg[1]) + Math.abs(p[2] - bg[2]) > 40;
  const rowHas = (y) => { let n = 0; for (let x = 0; x < tw; x++) if (diff(px(x, y))) n++; return n > tw * 0.004; };
  const colHas = (x) => { let n = 0; for (let y = 0; y < th; y++) if (diff(px(x, y))) n++; return n > th * 0.004; };
  let top = 0, bot = th - 1, left = 0, right = tw - 1;
  while (top < bot && !rowHas(top)) top++;
  while (bot > top && !rowHas(bot)) bot--;
  while (left < right && !colHas(left)) left++;
  while (right > left && !colHas(right)) right--;
  const pad = 0.012;
  const c = { x: left / tw - pad, y: top / th - pad, w: (right - left + 1) / tw + pad * 2, h: (bot - top + 1) / th + pad * 2 };
  c.x = Math.max(0, c.x); c.y = Math.max(0, c.y); c.w = Math.min(1 - c.x, c.w); c.h = Math.min(1 - c.y, c.h);
  if (c.w < 0.2 || c.h < 0.1) return { x: 0, y: 0, w: 1, h: 1 };
  return c;
}

/* ================= 上載 ================= */
async function addFiles(files, target) {
  const list = [...files].filter((f) => /^image\//.test(f.type) || /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name));
  if (!list.length) { toast('請選擇圖片或 PDF 檔案'); return; }
  for (const f of list) {
    try {
      if (/pdf/i.test(f.type) || /\.pdf$/i.test(f.name)) await addPDF(f, target);
      else {
        const meta = /png$/i.test(f.type) || /\.png$/i.test(f.name) ? await readPngMeta(f) : null;
        const base = await fileToCanvas(f);
        const img = newImage(f.name, base, target, f);
        if (meta) {
          img.data = extData(meta); img.kind = 'taobao'; img.kindManual = true; img.crop = { x: 0, y: 0, w: 1, h: 1 }; img.fromExt = true;
          if (img.data.titles.length) { img.status = 'done'; autoAssign(img); }
          else { img.extMeta = img.data; autoAssign(img); enqueueOCR(img); } // 擴充功能讀不到商品名稱：用文字辨識補上
        }
        else enqueueOCR(img);
      }
    } catch (e) { console.error(e); toast(`「${f.name}」讀取失敗：${e.message || e}`, 4000); }
  }
  renderAll();
}
/* 讀取「淘寶訂單截圖」擴充功能寫入 PNG 的訂單資料（tEXt: pf-data） */
async function readPngMeta(file) {
  try {
    const b = new Uint8Array(await file.arrayBuffer());
    if (b[0] !== 0x89 || b[1] !== 0x50) return null;
    let i = 8;
    while (i + 8 < b.length) {
      const len = (b[i] << 24 | b[i + 1] << 16 | b[i + 2] << 8 | b[i + 3]) >>> 0;
      const type = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
      if (type === 'tEXt') {
        const body = b.subarray(i + 8, i + 8 + len), z = body.indexOf(0);
        const key = String.fromCharCode(...body.subarray(0, z));
        if (key === 'pf-data') {
          const bin = atob(String.fromCharCode(...body.subarray(z + 1)));
          const u8 = Uint8Array.from(bin, (c) => c.charCodeAt(0));
          return JSON.parse(new TextDecoder().decode(u8));
        }
      }
      if (type === 'IDAT' || type === 'IEND') break;
      i += 12 + len;
    }
  } catch (e) { console.warn('png meta', e); }
  return null;
}
const JUNK_TITLE = /争议|爭議|判断依据|判斷依據|交易快照|查看|复制|申请售后|加入购物车/;
function extData(m) {
  const items = (m.items || []).filter((it) => it && it.title && !JUNK_TITLE.test(it.title)).map((it) => ({ title: it.title, sku: it.sku || '', price: it.price ?? null, qty: it.qty || 1 }));
  return { kind: 'taobao', fromExt: true, orderNo: m.orderNo || '', hkd: m.paidHKD ?? null, goodsCNY: m.goodsCNY ?? null, discountCNY: m.discountCNY || 0,
    shipCNY: m.shipCNY || 0, date: (m.created || '').slice(0, 10), shop: m.shop || '', titles: items.map((it) => it.title), items, itemPrices: items.map((it) => it.price).filter((v) => v != null) };
}
function newImage(name, base, target, blob) {
  const img = { id: uid('i'), name, base, rot: 0, crop: { x: 0, y: 0, w: 1, h: 1 }, kind: target?.kind || null, kindManual: !!target?.kind,
    status: 'queued', data: {}, orderId: null, assignManual: !!target?.orderId, progress: 0, subKey: target?.subKey || null };
  img.crop = trimBorders(base);
  S.images.set(img.id, img);
  if (blob) putBlob(img.id, blob);
  // 在某次購物內上載：先放進該購物（未辨識完先當收據），辨識後再按類別歸位
  if (target?.orderId) { const o = S.orders.find((o) => o.id === target.orderId); if (o) attach(img, o, target.kind || 'receipt'); if (!target.kind) img.kind = null; }
  return img;
}
async function addPDF(file, target) {
  await withTimeout(loadScript(CDN.pdfjs), 20000, 'PDF 程式庫載入逾時');
  const lib = window.pdfjsLib;
  if (!lib.GlobalWorkerOptions.workerPort) {
    try { lib.GlobalWorkerOptions.workerPort = LOCAL ? new Worker(absURL(CDN.pdfjsWorker)) : new Worker(URL.createObjectURL(new Blob([`importScripts("${CDN.pdfjsWorker}");`], { type: 'application/javascript' }))); }
    catch { lib.GlobalWorkerOptions.workerSrc = CDN.pdfjsWorker; }
  }
  const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const n = Math.min(pdf.numPages, 4);
  for (let p = 1; p <= n; p++) {
    const page = await pdf.getPage(p);
    const vp0 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: Math.min(4, 2200 / vp0.width) });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: g, viewport: vp }).promise;
    const tc = await page.getTextContent();
    const lines = []; let lastY = null;
    for (const it of tc.items) { const y = Math.round(it.transform[5]); if (lastY === null || Math.abs(y - lastY) > 3) lines.push(''); lines[lines.length - 1] += it.str; lastY = y; }
    const text = lines.join('\n');
    const pblob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const img = newImage(n > 1 ? `${file.name}（第 ${p} 頁）` : file.name, c, target, pblob);
    if (text.replace(/\s/g, '').length > 20) {
      const d = Parser.analyseText(text);
      img.data = d; if (!img.kindManual) img.kind = d.kind === 'taobao' || d.kind === 'pps' ? d.kind : 'receipt';
      img.status = 'done'; autoAssign(img);
    } else enqueueOCR(img);
  }
}

/* ================= OCR ================= */
function setChip(kind, text) { const c = $('#ocrChip'); c.className = 'chip ' + (kind || ''); c.textContent = text; }
const IDB_KEY = './chi_sim.traineddata';
function idbOpen() {
  return new Promise((res, rej) => { const rq = indexedDB.open('keyval-store'); rq.onupgradeneeded = () => rq.result.createObjectStore('keyval'); rq.onerror = () => rej(rq.error); rq.onsuccess = () => res(rq.result); });
}
async function hasCache() {
  try {
    const db = await idbOpen(); if (!db.objectStoreNames.contains('keyval')) { db.close(); return false; }
    return await new Promise((res) => { const g = db.transaction('keyval').objectStore('keyval').get(IDB_KEY); g.onsuccess = () => { db.close(); res(!!(g.result && g.result.length > 1e6)); }; g.onerror = () => { db.close(); res(false); }; });
  } catch { return false; }
}
async function primeCache() {
  const resp = await fetch('lang/chi_sim.b64.txt');
  if (!resp.ok) throw new Error('辨識資料下載失敗（' + resp.status + '）');
  const b64 = (await resp.text()).replace(/\s/g, '');
  const bin = atob(b64), data = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
  await new Promise((res, rej) => {
    const rq = indexedDB.open('keyval-store');
    rq.onupgradeneeded = () => rq.result.createObjectStore('keyval');
    rq.onerror = () => rej(rq.error);
    rq.onsuccess = () => { const db = rq.result; const tx = db.transaction('keyval', 'readwrite'); tx.objectStore('keyval').put(data, './chi_sim.traineddata'); tx.oncomplete = () => { db.close(); res(); }; tx.onerror = () => rej(tx.error); };
  });
}
function ensureWorker() {
  if (S.ocr.worker) return Promise.resolve(S.ocr.worker);
  if (S.ocr.failed) return Promise.reject(S.ocr.failed);
  if (S.ocr.starting) return S.ocr.starting;
  S.ocr.starting = (async () => {
    setChip('busy', '文字辨識：載入中…');
    await withTimeout(loadScript(CDN.tess), 30000, '文字辨識程式載入逾時');
    const langPath = new URL('lang', location.href).href;
    const logger = (m) => {
      if (m.status === 'loading language traineddata' && m.progress < 1) setChip('busy', '文字辨識：下載中文資料…');
      if (m.status === 'recognizing text' && S.ocr.current) { S.ocr.current.progress = m.progress; updateThumbState(S.ocr.current); }
    };
    let w;
    if (LOCAL) {
      w = await withTimeout(window.Tesseract.createWorker('chi_sim', 1, { langPath: absURL('lang'), workerPath: absURL(CDN.tessWorker), corePath: absURL(CDN.tessCore), workerBlobURL: false, gzip: false, logger }), 120000, '文字辨識初始化逾時');
    } else {
      if (!(await hasCache())) { setChip('busy', '文字辨識：下載中文資料（約 3 MB）…'); await withTimeout(primeCache(), 120000, '中文資料下載逾時'); }
      w = await withTimeout(window.Tesseract.createWorker('chi_sim', 1, { langPath, gzip: false, logger, cacheMethod: 'readOnly' }), 90000, '文字辨識初始化逾時');
    }
    await w.setParameters({ tessedit_pageseg_mode: '3' });
    S.ocr.worker = w; setChip('ok', '文字辨識：就緒'); return w;
  })().catch((e) => {
    S.ocr.failed = e; S.ocr.starting = null; setChip('bad', '文字辨識：未能載入');
    const n = $('#ocrNote'); n.hidden = false;
    n.innerHTML = `<span>未能啟動文字辨識（${esc(e.message || e)}）。圖片仍可以配對、裁剪和排版，訂單編號、金額和名稱請在下面手動填寫。</span><button class="btn small" type="button" id="btnRetryOCR">再試一次</button>`;
    throw e;
  });
  return S.ocr.starting;
}
function enqueueOCR(img) { img.status = 'queued'; S.ocr.queue.push(img.id); runQueue(); }
async function runQueue() {
  if (S.ocr.busy) return; S.ocr.busy = true;
  try {
    while (S.ocr.queue.length) {
      const id = S.ocr.queue.shift(), img = S.images.get(id);
      if (!img || img.status === 'done') continue;
      let w;
      try { w = await ensureWorker(); } catch { img.status = 'err'; S.ocr.queue.forEach((q) => { const i = S.images.get(q); if (i) i.status = 'err'; }); S.ocr.queue = []; renderAll(); break; }
      img.status = 'ocr'; img.progress = 0; S.ocr.current = img; updateThumbState(img);
      setChip('busy', `文字辨識：處理中（尚餘 ${S.ocr.queue.length + 1} 張）`);
      try {
        const o = oriented(img);
        const sc = Math.min(1, 2200 / Math.max(o.width, o.height));
        const c = document.createElement('canvas'); c.width = Math.round(o.width * sc); c.height = Math.round(o.height * sc);
        c.getContext('2d').drawImage(o, 0, 0, c.width, c.height);
        const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
        const { data } = await w.recognize(blob, {}, { text: true, tsv: true, blocks: false, hocr: false });
        let d = Parser.analyse(data.tsv || '', data.text || '', c.width, c.height);
        if (img.extMeta) d = { ...img.extMeta, titles: d.kind === 'taobao' ? d.titles : [], crop: null };
        img.data = d; img.status = 'done';
        if (!img.kindManual) img.kind = d.kind;
        if (d.crop && (img.kind === 'pps' || img.kind === 'taobao')) img.crop = refineCrop(img.crop, d.crop);
        img.autoCrop = { ...img.crop };
        autoAssign(img);
      } catch (e) { console.error(e); img.status = 'err'; }
      S.ocr.current = null;
      renderAll();
    }
  } finally {
    S.ocr.busy = false;
    if (S.ocr.worker) setChip('ok', '文字辨識：就緒');
  }
}
function refineCrop(pixel, text) {
  // 交集：像素裁邊 ∩ 文字範圍（文字範圍可能較窄，所以左右以像素為準）
  const y = Math.max(pixel.y, text.y), y2 = Math.min(pixel.y + pixel.h, text.y + text.h);
  if (y2 - y < 0.2) return pixel;
  return { x: pixel.x, w: pixel.w, y, h: y2 - y };
}

/* ================= 購物（一次付款）與配對 ================= */
function newOrder(manual = false, type = 'taobao') {
  const o = { id: uid('o'), type, title: '', taobao: [], pps: null, receipts: [], hkdOverride: null, manual, payee: null, appDate: '', includeCode: true, createdAt: Date.now() };
  S.orders.push(o); return o;
}
function detach(img) {
  for (const o of S.orders) {
    o.taobao = o.taobao.filter((x) => x !== img.id); o.receipts = o.receipts.filter((x) => x !== img.id);
    if (o.pps === img.id) o.pps = null;
  }
  img.orderId = null;
}
function attach(img, o, kind) {
  detach(img);
  img.kind = kind; img.orderId = o.id;
  if (kind === 'pps') { if (o.pps && o.pps !== img.id) { const old = S.images.get(o.pps); if (old) old.orderId = null; } o.pps = img.id; }
  else if (kind === 'taobao') o.taobao.push(img.id);
  else o.receipts.push(img.id);
}
/* 時間：'YYYY-MM-DD HH:MM:SS' */
const tms = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(s || ''); return m ? Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null; };
const near = (a, b, sec) => { const x = tms(a), y = tms(b); return x != null && y != null && Math.abs(x - y) <= sec * 1000; };
const imgTimes = (img) => [img.data.paidAt, img.data.createdAt].filter(Boolean);
function purchaseTimes(o) { return [...new Set(o.taobao.map((id) => S.images.get(id)).filter(Boolean).flatMap(imgTimes))]; }
function purchaseWhen(o) {
  const ts = o.taobao.map((id) => S.images.get(id)).filter(Boolean).map((x) => x.data.paidAt || x.data.createdAt).filter(Boolean).sort();
  const pps = o.pps && S.images.get(o.pps);
  return ts[0] || pps?.data.paidAt || '';
}
function orderInfo(o) {
  const tb = o.taobao.map((id) => S.images.get(id)).filter(Boolean);
  const pps = o.pps ? S.images.get(o.pps) : null;
  const rc = o.receipts.map((id) => S.images.get(id)).filter(Boolean);
  const subs = tbGroups(tb);
  const nos = subs.map((g) => g.no).filter(Boolean);
  const orderNo = nos.length ? nos.join('、') : (pps?.data.orderNo || '');
  const hkdPPS = o.hkdOverride ?? pps?.data.hkd ?? null;
  const tbVals = subs.map((g) => g.hkd).filter((v) => v != null);
  const hkdTB = tbVals.length ? Math.round(tbVals.reduce((a, b) => a + b, 0) * 100) / 100 : null;
  const rows = S.rows.filter((r) => r.orderId === o.id);
  const rowSum = rows.map((r) => r.hkd).filter((v) => v != null).reduce((a, b) => a + b, 0);
  const hkd = o.type === 'general' ? (rows.length ? Math.round(rowSum * 100) / 100 : null) : (hkdPPS ?? hkdTB);
  const when = purchaseWhen(o);
  const date = when.slice(0, 10) || pps?.data.date || tb.map((x) => x.data.date).find(Boolean) || '';
  const titles = [...tb.flatMap((x) => x.data.titles || []), pps?.data.remark].filter(Boolean);
  const cands = subs.flatMap(subCands);
  if (pps?.data.cny != null) cands.push(pps.data.cny);
  subs.forEach((g) => { g.rc = rc.filter((r) => receiptSub(subs, r) === g.key); });
  const loose = rc.filter((r) => !subs.some((g) => g.rc.includes(r)));
  // 還欠甚麼
  const missing = [];
  const busy = [...tb, pps, ...rc].filter(Boolean).some((x) => x.status === 'queued' || x.status === 'ocr');
  if (o.type === 'taobao') {
    if (!tb.length) missing.push({ k: 'taobao', text: '淘寶訂單截圖' });
    if (!pps) missing.push({ k: 'pps', text: 'PPS 付款紀錄' });
    subs.forEach((g, i) => { if (!g.rc.length) missing.push({ k: 'receipt', sub: g.key, text: `收據：${subLabel(subs, i)}` }); });
    if (hkdPPS != null && hkdTB != null && Math.abs(hkdPPS - hkdTB) > 0.011) missing.push({ k: 'amount', text: `金額不符：淘寶${subs.length > 1 ? '合計' : ''} HK$${money(hkdTB)}，PPS HK$${money(hkdPPS)}` });
  } else {
    if (!rows.some((r) => r.name)) missing.push({ k: 'rows', text: '貨品' });
    const noAmt = rows.filter((r) => r.name && r.hkd == null).length;
    if (noAmt) missing.push({ k: 'amount', text: `${noAmt} 行未填金額` });
  }
  return { tb, pps, rc, subs, loose, nos, orderNo, hkd, hkdPPS, hkdTB, date, when, titles, cands, missing, busy, shop: pps?.data.shop || '', rows };
}
const subLabel = (subs, i) => (subs.length > 1 ? `訂單 ${String.fromCharCode(65 + i)}` : '淘寶訂單');
/* 同一訂單編號的多張截圖算一張淘寶訂單 */
function tbGroups(tb) {
  const map = new Map();
  tb.forEach((x) => {
    const k = x.data.orderNo || x.id;
    if (!map.has(k)) map.set(k, { key: k, no: x.data.orderNo || '', imgs: [], hkd: null, titles: [], items: [], date: '' });
    const g = map.get(k); g.imgs.push(x);
    if (g.hkd == null && x.data.hkd != null) g.hkd = x.data.hkd;
    if (!g.date && x.data.date) g.date = x.data.date;
    g.titles.push(...(x.data.titles || []));
    (x.data.items || []).forEach((it) => { if (!g.items.some((y) => y.title === it.title && y.sku === it.sku)) g.items.push(it); });
  });
  return [...map.values()];
}
function subCands(g) {
  const c = [];
  g.imgs.forEach((x) => {
    const d = x.data;
    if (d.goodsCNY != null) { const gg = d.goodsCNY, dc = d.discountCNY || 0, sh = d.shipCNY || 0; c.push(gg, gg - dc, gg + sh, gg - dc + sh); }
    (d.itemPrices || []).forEach((v) => c.push(v));
    (d.items || []).forEach((it) => { if (it.price != null) c.push(it.price, it.price * (it.qty || 1)); });
  });
  return c;
}
/* 收據屬於哪張淘寶訂單：手動配對優先，否則按訂單編號或金額 */
function receiptSub(subs, r) {
  if (r.subKey === '__none') return null;
  if (r.subKey && subs.some((s) => s.key === r.subKey)) return r.subKey;
  const no = r.data.orderNo; if (no && subs.some((s) => s.no === no)) return no;
  const v = r.data.cny;
  if (v != null) { const hits = subs.filter((s) => subCands(s).some((c) => Math.abs(c - v) <= 0.05)); if (hits.length === 1) return hits[0].key; }
  if (subs.length === 1) return subs[0].key;
  return null;
}
function receiptRows(img, o, subs) {
  const k = receiptSub(subs || tbGroups(o.taobao.map((id) => S.images.get(id)).filter(Boolean)), img);
  return k ? S.rows.filter((r) => r.orderId === o.id && r.subKey === k).map((r) => r.id) : [];
}
/* 讀不到時間時的後備：用金額組合把同時結帳的訂單併在一起 */
function reconcile() {
  for (const o of S.orders) {
    if (o.type !== 'taobao') continue;
    const info = orderInfo(o);
    if (info.hkdPPS == null || info.hkdTB == null) continue;
    const diff = Math.round((info.hkdPPS - info.hkdTB) * 100) / 100;
    if (diff < 0.05) continue;
    const cands = S.orders.filter((x) => x !== o && x.type === 'taobao' && !x.pps && !x.manual && x.taobao.length && !purchaseTimes(x).length && x.taobao.every((id) => !S.images.get(id)?.assignManual))
      .map((x) => ({ x, v: orderInfo(x).hkdTB })).filter((c) => c.v != null).slice(0, 16);
    let hit = null;
    for (let m = 1; m < (1 << cands.length) && !hit; m++) {
      let s = 0; cands.forEach((c, i) => { if (m & (1 << i)) s += c.v; });
      if (Math.abs(s - diff) < 0.03) hit = cands.filter((c, i) => m & (1 << i)).map((c) => c.x);
    }
    if (!hit) continue;
    hit.forEach((x) => {
      [...x.taobao].forEach((id) => attach(S.images.get(id), o, 'taobao'));
      [...x.receipts].forEach((id) => attach(S.images.get(id), o, 'receipt'));
      S.rows = S.rows.filter((r) => r.orderId !== x.id || r.edited).map((r) => (r.orderId === x.id ? { ...r, orderId: o.id } : r));
    });
    S.orders = S.orders.filter((x) => !hit.includes(x));
  }
}
function findOrderByNo(no) { return no ? S.orders.find((o) => o.type === 'taobao' && (() => { const i = orderInfo(o); return i.nos.includes(no) || i.pps?.data.orderNo === no; })()) : null; }
function autoAssign(img) {
  if (img.assignManual && img.orderId) { const o = S.orders.find((x) => x.id === img.orderId); if (o) attach(img, o, img.kind || 'receipt'); syncRows(); return; }
  const d = img.data, k = img.kind;
  const tbs = () => S.orders.filter((o) => o.type === 'taobao');
  let o = null;
  if (k === 'taobao') {
    const ts = imgTimes(img);
    // 1. 交易時間相同（同一次結帳）
    if (ts.length) o = tbs().find((x) => purchaseTimes(x).some((t) => ts.includes(t)));
    // 2. 只有 PPS 的購物，時間接近
    if (!o && ts.length) o = tbs().find((x) => !x.taobao.length && x.pps && ts.some((t) => near(t, S.images.get(x.pps)?.data.paidAt, 120)));
    // 3. 訂單編號
    if (!o) { const c = findOrderByNo(d.orderNo); if (c && (!ts.length || !purchaseTimes(c).length || purchaseTimes(c).some((t) => ts.some((u) => near(t, u, 120))))) o = c; }
    // 4. 金額（讀不到時間時）
    if (!o && !ts.length && d.hkd != null) o = tbs().find((x) => !x.taobao.length && orderInfo(x).hkdPPS != null && Math.abs(orderInfo(x).hkdPPS - d.hkd) < 0.011);
    if (!o && img.orderId) o = S.orders.find((x) => x.id === img.orderId);
    if (!o) o = newOrder(false, 'taobao');
    attach(img, o, 'taobao');
  } else if (k === 'pps') {
    const t = d.paidAt;
    if (t) {
      let best = null, bd = Infinity;
      tbs().filter((x) => !x.pps).forEach((x) => purchaseTimes(x).forEach((u) => { const dd = Math.abs(tms(u) - tms(t)); if (dd <= 120000 && dd < bd) { bd = dd; best = x; } }));
      o = best;
    }
    if (!o) { const c = findOrderByNo(d.orderNo); if (c && !c.pps) o = c; }
    if (!o && d.hkd != null) o = tbs().find((x) => !x.pps && orderInfo(x).hkdTB != null && Math.abs(orderInfo(x).hkdTB - d.hkd) < 0.011);
    if (!o && img.orderId) o = S.orders.find((x) => x.id === img.orderId);
    if (!o) o = newOrder(false, 'taobao');
    attach(img, o, 'pps');
  } else { img.kind = 'receipt'; matchReceipt(img); }
  if (k === 'taobao' || k === 'pps') [...S.images.values()].filter((x) => !x.orderId && x.kind === 'receipt' && x.status === 'done' && !x.assignManual).forEach(matchReceipt);
  reconcile(); cleanupOrders(); syncRows();
}
function matchReceipt(img) {
  const d = img.data;
  let o = findOrderByNo(d.orderNo);
  if (!o && d.cny != null) {
    const hits = S.orders.filter((x) => x.type === 'taobao' && orderInfo(x).cands.some((v) => Math.abs(v - d.cny) <= 0.05));
    if (hits.length === 1) o = hits[0];
  }
  if (o) attach(img, o, 'receipt');
}
function cleanupOrders() {
  const before = S.orders.length;
  S.orders = S.orders.filter((o) => o.manual || o.type === 'general' || o.taobao.length || o.pps || o.receipts.length);
  if (before !== S.orders.length && S.active !== 'inbox' && !S.orders.some((o) => o.id === S.active)) S.active = 'inbox';
}
function sortOrders() {
  // 列表次序：按交易時間（新到舊），沒有時間的按建立次序
  S.orders.sort((a, b) => {
    const ta = tms(purchaseWhen(a)) ?? a.createdAt, tb = tms(purchaseWhen(b)) ?? b.createdAt;
    return tb - ta;
  });
}

/* ================= 表格行 ================= */
function newRow(orderId, name) {
  const d = S.settings.defaults;
  return { id: uid('r'), orderId, name: name || '', code: '', edited: false, hkd: null, hkdEdited: false, subKey: null, titles: [], reason: d.reason, consumable: d.consumable, location: d.location, dept: d.dept, subgroup: d.subgroup, category: d.category, grant: d.grant, person: d.person, rdate: d.rdate };
}
function rowSpecs(o) {
  if (o.type === 'general') return null;
  const info = orderInfo(o), specs = [];
  if (!info.subs.length) { if (info.pps) specs.push({ key: 'pps#0', subKey: null, titles: info.titles, hkd: info.hkd }); return specs; }
  // 一張淘寶訂單算一行：名稱概括訂單內的商品，金額用該訂單的實付港幣
  info.subs.forEach((g) => specs.push({ key: `${g.key}#0`, subKey: g.key, titles: g.items.length ? g.items.map((it) => it.title) : g.titles, hkd: g.hkd }));
  if (specs.length === 1) {
    if (info.pps?.data.remark) specs[0].titles = [...specs[0].titles, info.pps.data.remark];
    if (specs[0].hkd == null) specs[0].hkd = info.hkd;
  }
  return specs;
}
function syncRows() {
  S.rows = S.rows.filter((r) => S.orders.some((o) => o.id === r.orderId));
  const order = new Map();
  S.orders.forEach((o, oi) => {
    const specs = rowSpecs(o);
    if (!specs) { S.rows.filter((r) => r.orderId === o.id).forEach((r, i) => order.set(r.id, oi * 1000 + i)); return; }
    const keys = new Set(specs.map((s) => s.key));
    S.rows = S.rows.filter((r) => r.orderId !== o.id || !r.auto || keys.has(r.autoKey) || r.edited);
    specs.forEach((sp, si) => {
      if (S.deleted.has(`${o.id}|${sp.key}`)) return;
      let r = S.rows.find((x) => x.orderId === o.id && x.auto && x.autoKey === sp.key);
      if (!r) { r = newRow(o.id, ''); r.auto = true; r.autoKey = sp.key; S.rows.push(r); }
      r.subKey = sp.subKey; r.titles = sp.titles;
      if (!r.edited) r.name = suggestName(sp.titles);
      if (!r.hkdEdited) r.hkd = sp.hkd;
      order.set(r.id, oi * 1000 + si);
    });
    let pending = S.rows.filter((r) => r.orderId === o.id && !order.has(r.id)), guard = 0;
    while (pending.length && guard++ < 50) {
      pending = pending.filter((r) => {
        if (r.after && S.rows.some((x) => x.id === r.after) && !order.has(r.after)) return true;
        const base = r.after && order.has(r.after) ? order.get(r.after) : oi * 1000 + 900;
        let v = base + 0.5; const used = new Set(order.values()); while (used.has(v)) v += 0.01;
        order.set(r.id, v); return false;
      });
    }
    pending.forEach((r) => order.set(r.id, oi * 1000 + 950));
  });
  S.rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/* ================= 暫存（IndexedDB：資料 + 圖片） ================= */
const WORK_DB = 'pf-work';
function wdb() {
  if (!S._wdb) S._wdb = new Promise((res, rej) => {
    const rq = indexedDB.open(WORK_DB, 1);
    rq.onupgradeneeded = () => { const d = rq.result; if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv'); if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs'); };
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
  });
  return S._wdb;
}
async function idb(store, mode, fn) {
  const d = await wdb();
  return new Promise((res, rej) => { const tx = d.transaction(store, mode); const r = fn(tx.objectStore(store)); tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
}
const putBlob = (id, blob) => idb('blobs', 'readwrite', (s) => s.put(blob, id)).catch((e) => { console.warn(e); saveError(e); });
const delBlob = (id) => idb('blobs', 'readwrite', (s) => s.delete(id)).catch(() => {});
const getBlob = (id) => idb('blobs', 'readonly', (s) => s.get(id));
function serialize() {
  const imgs = [...S.images.values()].map((i) => ({ id: i.id, name: i.name, rot: i.rot, crop: i.crop, autoCrop: i.autoCrop, kind: i.kind, kindManual: i.kindManual,
    status: i.status === 'ocr' ? 'queued' : i.status, data: { ...i.data, rawRows: undefined }, orderId: i.orderId, assignManual: i.assignManual, subKey: i.subKey, fromExt: i.fromExt, extMeta: i.extMeta }));
  return { v: 2, seq, active: S.active, orders: S.orders, rows: S.rows, deleted: [...S.deleted], images: imgs, savedAt: Date.now() };
}
const saveState = debounce(async () => {
  try { await idb('kv', 'readwrite', (s) => s.put(serialize(), 'state')); setSaved(); } catch (e) { saveError(e); }
}, 600);
function markDirty() { if (!S.restoring) saveState(); }
async function saveNow() { try { await idb('kv', 'readwrite', (s) => s.put(serialize(), 'state')); } catch { } }
function setSaved() { const c = $('#saveChip'); if (!c) return; const d = new Date(); c.className = 'chip ok'; c.textContent = `已自動儲存 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
function saveError(e) { const c = $('#saveChip'); if (c) { c.className = 'chip bad'; c.textContent = '未能儲存'; c.title = String(e?.message || e); } }
async function restoreState() {
  let st = null;
  try { st = await idb('kv', 'readonly', (s) => s.get('state')); } catch (e) { console.warn(e); }
  if (!st || st.v !== 2) return false;
  S.restoring = true;
  try {
    seq = Math.max(seq, st.seq || 1);
    S.orders = st.orders || []; S.rows = st.rows || []; S.deleted = new Set(st.deleted || []);
    for (const m of st.images || []) {
      try {
        const blob = await getBlob(m.id); if (!blob) continue;
        const base = await fileToCanvas(blob);
        S.images.set(m.id, { ...m, base, progress: 0 });
      } catch (e) { console.warn('restore img', m.id, e); }
    }
    // 圖片遺失時清理參照
    S.orders.forEach((o) => { o.taobao = o.taobao.filter((id) => S.images.has(id)); o.receipts = o.receipts.filter((id) => S.images.has(id)); if (o.pps && !S.images.has(o.pps)) o.pps = null; });
    S.active = st.active && (st.active === 'inbox' || S.orders.some((o) => o.id === st.active)) ? st.active : 'inbox';
  } finally { S.restoring = false; }
  [...S.images.values()].filter((i) => i.status === 'queued').forEach(enqueueOCR);
  return true;
}

/* ================= 介面：共用小元件 ================= */
const KIND_LABEL = { taobao: '淘寶訂單', pps: 'PPS 紀錄', receipt: '收據' };
function stateChip(img) {
  if (img.status === 'queued') return '<span class="chip busy">排隊辨識</span>';
  if (img.status === 'ocr') return `<span class="chip busy">辨識中 ${Math.round((img.progress || 0) * 100)}%</span>`;
  if (img.status === 'err') return '<span class="chip warn">未能辨識</span>';
  return '';
}
function updateThumbState(img) { document.querySelectorAll(`[data-state="${img.id}"]`).forEach((el) => { el.innerHTML = stateChip(img); }); }
function bigURL(img) {
  if (img._big) return img._big;
  const c = cropped(img), sc = Math.min(1, 1400 / Math.max(c.width, c.height));
  const t = document.createElement('canvas'); t.width = Math.max(1, Math.round(c.width * sc)); t.height = Math.max(1, Math.round(c.height * sc));
  t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
  img._big = t.toDataURL('image/jpeg', 0.86); return img._big;
}
function allReceipts() { return [...S.images.values()].filter((x) => x.kind === 'receipt'); }
function rcLabel(img) { return 'R' + (allReceipts().indexOf(img) + 1); }
function purchaseLabel(o, noTitle) {
  if (o.title && !noTitle) return o.title;
  const when = purchaseWhen(o);
  if (o.type === 'general') return `一般購物 ${S.orders.filter((x) => x.type === 'general').indexOf(o) + 1}`;
  return when ? `淘寶 ${when.slice(5, 16).replace('-', '/')}` : '淘寶（未讀到時間）';
}
function moveSelect(img) {
  const opts = S.orders.map((o) => `<option value="${o.id}" ${img.orderId === o.id ? 'selected' : ''}>放入：${esc(purchaseLabel(o))}</option>`).join('');
  return `<select data-move="${img.id}" aria-label="移到其他購物">${img.orderId ? '' : '<option value="" selected>放入購物…</option>'}${opts}<option value="new">放入新的淘寶購物</option>${img.orderId ? '<option value="tray">移出（放回未分類）</option>' : ''}<option value="del">刪除這張圖</option></select>`;
}
function kindSelect(img) {
  const k = img.kind || 'receipt';
  return `<select data-kind="${img.id}" class="k-${k}" aria-label="圖片類別">${['taobao', 'pps', 'receipt'].map((x) => `<option value="${x}" ${x === k ? 'selected' : ''}>${KIND_LABEL[x]}</option>`).join('')}</select>`;
}
function thumbHTML(img) {
  return `<div class="thumb"><div class="th">${kindSelect(img)}${img.fromExt ? '<span class="chip ok" title="由擴充功能截取">已讀取</span>' : ''}</div>
    <div class="img"><img alt="${esc(img.name)}" src="${thumbURL(img)}" data-zoom="${img.id}"><span class="state" data-state="${img.id}">${stateChip(img)}</span></div>
    <div class="tb"><button class="btn small" type="button" data-act="crop" data-img="${img.id}">裁剪</button>${moveSelect(img)}</div></div>`;
}
function bigFig(img, caption, actions) {
  return `<figure class="big" data-fig="${img.id}"><div class="big-img"><img src="${bigURL(img)}" alt="${esc(caption)}" data-zoom="${img.id}" title="按一下放大"><span class="state" data-state="${img.id}">${stateChip(img)}</span></div>
    <figcaption><span class="cap">${caption}</span><span class="cap-acts">${actions || ''}<button class="btn small" type="button" data-act="crop" data-img="${img.id}">裁剪</button></span></figcaption></figure>`;
}
function missingHTML(info, o) {
  if (info.busy) return '<span class="chip busy">辨識中</span>';
  if (!info.missing.length) return '<span class="chip ok">齊單</span>';
  return info.missing.map((m) => `<span class="chip ${m.k === 'amount' ? 'warn' : 'bad'}">${m.k === 'amount' || o.type === 'general' ? '' : '欠 '}${esc(m.text)}</span>`).join('');
}

/* ================= 介面：購物清單 ================= */
function renderNav() {
  sortOrders();
  const tray = [...S.images.values()].filter((x) => !x.orderId);
  const items = S.orders.map((o) => {
    const info = orderInfo(o), n = info.missing.filter((m) => m.k !== 'amount').length;
    const status = info.busy ? '<span class="dot busy" aria-label="辨識中"></span>' : (info.missing.length ? `<span class="nav-miss">${o.type === 'taobao' && n ? `欠 ${n} 項` : '未完成'}</span>` : '<span class="dot ok" aria-label="齊單"></span>');
    return `<button type="button" class="nav-item ${S.active === o.id ? 'on' : ''}" data-tab="${o.id}" role="tab" aria-selected="${S.active === o.id}">
      <span class="nav-type ${o.type}">${o.type === 'taobao' ? '淘寶' : '一般'}</span><span class="nav-main"><b>${esc(purchaseLabel(o))}</b><span class="mono">${info.hkd != null ? 'HK$' + money(info.hkd) : 'HK$ —'}</span></span>${status}</button>`;
  }).join('');
  $('#nav').innerHTML = `<button type="button" class="nav-item inbox ${S.active === 'inbox' ? 'on' : ''}" data-tab="inbox" role="tab" aria-selected="${S.active === 'inbox'}"><span class="nav-main"><b>上載及總覽</b><span>${S.orders.length} 次購物${tray.length ? `・${tray.length} 張未分類` : ''}</span></span></button>
    ${items}
    <button type="button" class="nav-item add" data-act="new-general"><span class="nav-main"><b>＋ 一般購物</b><span>自行輸入貨品，不用上載圖片</span></span></button>`;
}

/* ================= 介面：上載及總覽 ================= */
function renderInbox() {
  const tray = [...S.images.values()].filter((x) => !x.orderId);
  $('#tray').hidden = !tray.length;
  $('#trayList').innerHTML = tray.map(thumbHTML).join('');
  const list = $('#plist');
  if (!S.orders.length) { list.innerHTML = '<div class="empty-state">未有購物紀錄。上載淘寶訂單截圖後，同一交易時間的訂單會自動歸成一次購物；實體店或其他購物可以按左邊「＋ 一般購物」。</div>'; return; }
  list.innerHTML = `<table class="ptable"><thead><tr><th>購物</th><th>交易時間</th><th class="num">金額</th><th>狀態</th><th></th></tr></thead><tbody>${S.orders.map((o) => {
    const info = orderInfo(o), nf = Math.max(1, Math.ceil(info.rows.length / rowsPerForm()));
    return `<tr><td><span class="nav-type ${o.type}">${o.type === 'taobao' ? '淘寶' : '一般'}</span> ${esc(purchaseLabel(o))}</td><td class="mono">${esc(info.when || info.date || '—')}</td><td class="num mono">${info.hkd != null ? 'HK$' + money(info.hkd) : '—'}</td>
      <td class="pstat">${missingHTML(info, o)}</td><td><button class="btn small" type="button" data-tab="${o.id}">打開（${nf} 張申請表）</button></td></tr>`;
  }).join('')}</tbody></table>`;
}

/* ================= 介面：一次購物 ================= */
function renderPurchase() {
  const o = S.orders.find((x) => x.id === S.active), box = $('#viewPurchase');
  if (!o) return;
  const info = orderInfo(o);
  const isTB = o.type === 'taobao';
  let n = 0; const step = (t, sub, right = '') => `<div class="step-h"><span class="n">${++n}</span><h2>${t}</h2><span class="sub">${sub}</span>${right ? `<div class="right">${right}</div>` : ''}</div>`;
  const head = `<div class="p-head"><span class="nav-type ${o.type}">${isTB ? '淘寶購物' : '一般購物'}</span>
      <input class="p-title" data-pf="title" value="${esc(o.title)}" placeholder="${esc(purchaseLabel(o, true))}" aria-label="購物名稱">
      <span class="amt" id="pAmt">${info.hkd != null ? 'HK$' + money(info.hkd) : 'HK$ —'}</span><span class="grow"></span>
      <span id="delHost"><button class="btn small ghost danger" type="button" data-act="del-p">刪除這次購物</button></span></div>
    ${isTB ? `<div class="checklist">${checklistHTML(o, info)}</div>` : ''}`;
  let html = head;
  if (isTB) {
    html += `<section class="step">${step('PPS 付款紀錄', '同一次付款的 PPS 截圖。交易時間會用來核對淘寶訂單。')}${ppsHTML(o, info)}</section>`;
    html += `<section class="step">${step('淘寶訂單及收據', '每張淘寶訂單旁邊放它的收據或發票；對不上的可以在下面「未配對的收據」揀返。', `<button class="btn small" type="button" data-act="add-file" data-order="${o.id}" data-kind="taobao">加入淘寶訂單截圖</button>`)}${ordersHTML(o, info)}</section>`;
  }
  html += `<section class="step">${step('填寫申請表', isTB ? '每張淘寶訂單一行，名稱已概括並轉成繁體，可以直接修改。' : '逐行輸入貨品名稱、編號和金額。')}${formSectionHTML(o, info)}</section>`;
  html += `<section class="step">${step('預覽及列印', '<span id="pvSummary"></span>')}
    <div class="pv-bar"><label>排列 <select id="pv_layout"><option value="sets">每張申請表連附件一套</option><option value="compact">申請表集中，附件在後</option></select></label>
      <label><input type="checkbox" id="pv_att" ${S.settings.attach ? 'checked' : ''}> 附上淘寶訂單、收據和 PPS 紀錄</label>
      <label><input type="checkbox" id="pv_cap" ${S.settings.caption ? 'checked' : ''}> 附件頁頂加上訂單資料</label></div>
    <div class="pages" id="pages"></div>
    <div class="dl-row"><button class="btn primary" id="btnPrint" type="button" ${LOCAL ? '' : 'hidden'}>直接列印</button><button class="btn" id="btnPDF" type="button">下載 PDF</button>
      <span class="sub">${LOCAL ? '「直接列印」會打開瀏覽器的列印視窗：紙張揀 A4、邊界揀「無」。' : '用電腦或手機開啟 PDF 後，以 A4、實際大小 (100%) 列印。'}</span></div></section>`;
  box.innerHTML = html;
  $('#pv_layout').value = S.settings.layout || 'sets';
}
function checklistHTML(o, info) {
  const items = [];
  const ok = (t) => `<li class="ok"><span class="ck">✓</span>${t}</li>`, bad = (t) => `<li class="bad"><span class="ck">✗</span>${t}</li>`, warn = (t) => `<li class="warn"><span class="ck">!</span>${t}</li>`;
  items.push(info.tb.length ? ok(`淘寶訂單截圖 ${info.subs.length} 張`) : bad('欠淘寶訂單截圖'));
  items.push(info.pps ? ok('PPS 付款紀錄') : bad('欠 PPS 付款紀錄'));
  info.subs.forEach((g, i) => items.push(g.rc.length ? ok(`${subLabel(info.subs, i)} 收據 ${g.rc.length} 張`) : bad(`欠收據：${subLabel(info.subs, i)}${g.no ? `（…${g.no.slice(-4)}）` : ''}`)));
  if (info.loose.length) items.push(warn(`${info.loose.length} 張收據未配對`));
  const m = info.missing.find((x) => x.k === 'amount'); if (m) items.push(warn(m.text));
  if (info.busy) items.push('<li class="busy"><span class="ck">…</span>文字辨識中</li>');
  return `<b>${info.missing.length ? '還欠' : '齊單'}</b><ul>${items.join('')}</ul>`;
}
function ppsHTML(o, info) {
  const others = [...S.images.values()].filter((x) => x.kind === 'pps' && x.id !== o.pps && (!x.orderId || x.orderId === o.id));
  const pick = others.length ? `<select data-pickpps="${o.id}"><option value="">${info.pps ? '換另一張' : '揀已上載的 PPS 截圖'}…</option>${others.map((x) => `<option value="${x.id}">${esc(x.data.paidAt || x.name)}${x.data.hkd != null ? `・HK$${money(x.data.hkd)}` : ''}</option>`).join('')}</select>` : '';
  if (!info.pps) return `<div class="slot-empty wide"><span class="tag k-pps">PPS 紀錄</span><span>未有 PPS 付款紀錄</span><button class="btn small" type="button" data-act="add-file" data-order="${o.id}" data-kind="pps">上載 PPS 截圖</button>${pick}</div>`;
  const d = info.pps.data;
  return `<div class="pps-wrap">${bigFig(info.pps, 'PPS 付款紀錄', moveSelect(info.pps))}
    <dl class="kv"><dt>交易時間</dt><dd class="mono">${esc(d.paidAt || d.date || '—')}</dd><dt>付款金額</dt><dd><input inputmode="decimal" data-hkd="${o.id}" value="${info.hkdPPS != null ? money(info.hkdPPS) : ''}" aria-label="PPS 付款金額"> HK$</dd>
      <dt>淘寶實付合計</dt><dd class="mono">${info.hkdTB != null ? 'HK$' + money(info.hkdTB) : '—'}</dd>${d.orderNo ? `<dt>商戶訂單號</dt><dd class="mono">${esc(d.orderNo)}</dd>` : ''}</dl>${pick ? `<div>${pick}</div>` : ''}</div>`;
}
function ordersHTML(o, info) {
  const free = [...info.loose, ...allReceipts().filter((x) => !x.orderId)];
  const subs = info.subs.map((g, i) => {
    const row = S.rows.find((r) => r.orderId === o.id && r.subKey === g.key);
    const picks = free.length ? `<select data-pickrc="${esc(g.key)}"><option value="">配對收據…</option>${free.map((x) => `<option value="${x.id}">${rcLabel(x)}${x.orderId ? '' : '（未分類）'}${x.data.cny != null ? `・¥${money(x.data.cny)}` : ''}</option>`).join('')}</select>` : '';
    return `<article class="mo"><div class="mo-h"><b>${subLabel(info.subs, i)}</b><span class="mono">${esc(g.no || '未讀到訂單編號')}</span><span class="mono">${g.hkd != null ? 'HK$' + money(g.hkd) : ''}</span>${row?.name ? `<span>表格名稱：${esc(row.name)}</span>` : ''}<span class="grow"></span>${g.rc.length ? '<span class="chip ok">已配對收據</span>' : '<span class="chip bad">欠收據</span>'}</div>
      <div class="mo-body"><div class="mo-col">${g.imgs.map((x) => bigFig(x, '淘寶訂單截圖', moveSelect(x))).join('')}</div>
        <div class="mo-col">${g.rc.map((x) => bigFig(x, `收據 ${rcLabel(x)}`, `<button class="btn small" type="button" data-unrc="${x.id}">取消配對</button>`)).join('') || '<div class="slot-empty tall"><span class="tag k-receipt">收據</span><span>這張訂單未有收據</span></div>'}
          <div class="mo-add">${picks}<button class="btn small" type="button" data-act="add-file" data-order="${o.id}" data-kind="receipt" data-sub="${esc(g.key)}">上載收據</button></div></div></div></article>`;
  }).join('');
  const looseHTML = free.length ? `<div class="loose"><h3>未配對的收據（${free.length}）</h3><p class="sub">按收據下面的按鈕，放到對應的淘寶訂單。</p><div class="loose-grid">${free.map((x) => bigFig(x, `收據 ${rcLabel(x)}${x.orderId ? '' : '（未分類）'}${x.data.cny != null ? `・¥${money(x.data.cny)}` : ''}`,
    info.subs.map((g, i) => `<button class="btn small primary" type="button" data-assign="${x.id}" data-sub="${esc(g.key)}">配到${subLabel(info.subs, i)}${g.no ? ` …${g.no.slice(-4)}` : ''}</button>`).join('') + moveSelect(x))).join('')}</div></div>` : '';
  const none = !info.subs.length ? `<div class="slot-empty wide"><span class="tag k-taobao">淘寶訂單</span><span>這次購物未有淘寶訂單截圖</span><button class="btn small" type="button" data-act="add-file" data-order="${o.id}" data-kind="taobao">上載淘寶訂單截圖</button></div>` : '';
  return `${none}<div class="mos">${subs}</div>${looseHTML}<div class="add-rc"><button class="btn small" type="button" data-act="add-file" data-order="${o.id}" data-kind="receipt">上載更多收據</button></div>`;
}
function formSectionHTML(o, info) {
  const d = S.settings.defaults;
  const g = `<div class="global">
      <label class="field"><span>商戶名稱（收票人）</span><input data-pf="payee" value="${esc(o.payee ?? S.settings.payee)}" autocomplete="off"></label>
      <label class="field"><span>申請人姓名</span><input data-gs="applicant" value="${esc(S.settings.applicant)}" autocomplete="off"></label>
      <label class="field"><span>申請日期（可留空，簽名時手寫）</span><input data-pf="appDate" value="${esc(o.appDate || '')}" autocomplete="off" placeholder="例如 22/10/2026"></label>
      ${o.type === 'general' ? `<label class="check"><input type="checkbox" data-pf="includeCode" ${o.includeCode ? 'checked' : ''}> 把編號印在貨品名稱後面</label>` : ''}</div>`;
  const shared = `<div class="shared"><div class="shared-h"><strong>這次購物共用</strong><span class="sub">填好後按「套用到全部」，每行仍可以個別修改；亦會成為以後新貨品的預設。</span><button class="btn small primary" type="button" data-act="apply-all">套用到全部</button></div>
      <div class="fgrid">${FIELDS.map((f) => fieldInput(f, d[f.k], `data-shared="${f.k}"`)).join('')}<label class="check"><input type="checkbox" data-shared="consumable" ${d.consumable ? 'checked' : ''}> 消耗品</label></div></div>`;
  return g + shared + `<div class="rows" id="rows">${rowsHTML(o)}</div>${o.type === 'general' ? `<div class="add-row"><button class="btn" type="button" data-act="add-row-end">＋ 加一行貨品</button></div>` : ''}`;
}
function rowsHTML(o) {
  const forms = buildForms(o);
  if (!forms.some((f) => f.rows.length)) return '<div class="empty-state">未有貨品。</div>';
  return forms.map((f, i) => `<div class="form-group"><div class="form-h"><b>申請表 ${i + 1}</b><span>${f.rows.length} 行</span><span class="mono" data-ftotal="${i}">${f.amountText}</span></div>${f.rows.map((fr) => rowHTML(S.rows.find((r) => r.id === fr.id), o)).join('')}</div>`).join('');
}

/* ================= 介面：表格行 ================= */
function buildDatalists() {
  let host = $('#datalists'); if (!host) { host = document.createElement('div'); host.id = 'datalists'; host.hidden = true; document.body.appendChild(host); }
  host.innerHTML = Object.entries(S.settings.options).map(([k, list]) => `<datalist id="dl-${k}">${list.map((v) => `<option value="${esc(v)}"></option>`).join('')}</datalist>`).join('');
}
function fieldInput(f, value, attrs) {
  return `<label class="field"><span>${f.label}</span><input ${attrs} value="${esc(value)}" ${f.opt ? `list="dl-${f.opt}"` : ''} autocomplete="off" placeholder="${f.k === 'rdate' ? '可留空' : '選擇或輸入'}"></label>`;
}
function rowSummary(r) {
  const v = FIELDS.map((f) => r[f.k]).filter(Boolean);
  if (r.consumable) v.push('消耗品');
  return v.length ? v.join('・') : '未填';
}
function rowHTML(r, o) {
  const info = orderInfo(o), isG = o.type === 'general';
  const titles = r.titles || [], busy = info.busy && !r.name;
  const si = info.subs.findIndex((s) => s.key === r.subKey);
  const ref = isG ? '' : `<div class="ordref">${si >= 0 ? subLabel(info.subs, si) : ''}</div>`;
  return `<div class="row ${isG ? 'gen' : ''}" data-row="${r.id}">
    <div class="row-top">${ref}
      <label class="field"><span>貨品名稱</span><input data-f="name" value="${esc(r.name)}" placeholder="${busy ? '辨識中…' : '輸入貨品名稱'}" autocomplete="off"></label>
      ${isG ? `<label class="field code-f"><span>編號</span><input data-f="code" value="${esc(r.code || '')}" autocomplete="off"></label>` : ''}
      <label class="field amt-f"><span>金額 HK$</span><input data-f="hkd" inputmode="decimal" value="${r.hkd != null ? money(r.hkd) : ''}" autocomplete="off"></label>
      <div class="row-btns"><button class="btn small" type="button" data-act="add-row" title="在下面加一行">＋一行</button><button class="btn small ghost danger" type="button" data-act="del-row" aria-label="刪除這行">刪除</button></div></div>
    ${titles.length ? `<div class="row-src">原標題：${titles.slice(0, 4).map((t, i) => `<button type="button" data-act="use-title" data-t="${i}" title="用這個標題（精簡後）">${esc(toHK(t).slice(0, 40))}${t.length > 40 ? '…' : ''}</button>`).join('')} ${r.edited ? '<button type="button" data-act="remember">記住這個名稱</button>' : ''}</div>` : ''}
    <div class="rule-host"></div>
    <details class="more" ${S.openRows.has(r.id) ? 'open' : ''}><summary>其他欄位：<span data-sum>${esc(rowSummary(r))}</span></summary>
    <div class="fgrid">${FIELDS.map((f) => fieldInput(f, r[f.k], `data-f="${f.k}"`)).join('')}
      <label class="check"><input type="checkbox" data-f="consumable" ${r.consumable ? 'checked' : ''}> 消耗品</label></div></details>
  </div>`;
}
function updateTotals() {
  const o = S.orders.find((x) => x.id === S.active); if (!o) return;
  buildForms(o).forEach((f, i) => { const el = document.querySelector(`[data-ftotal="${i}"]`); if (el) el.textContent = f.amountText; });
  const h = orderInfo(o).hkd, pa = $('#pAmt'); if (pa) pa.textContent = h != null ? 'HK$' + money(h) : 'HK$ —';
}
function renderAll() {
  if (S.active !== 'inbox' && !S.orders.some((o) => o.id === S.active)) S.active = 'inbox';
  renderNav();
  $('#viewInbox').hidden = S.active !== 'inbox';
  $('#viewPurchase').hidden = S.active === 'inbox';
  if (S.active === 'inbox') renderInbox(); else { renderPurchase(); schedulePreview(); }
  markDirty();
}
function rerenderKeepScroll() { const y = window.scrollY; renderAll(); window.scrollTo(0, y); }

/* ================= 裁剪 ================= */
const crop = { img: null, rect: null, drag: null };
function openCrop(img) {
  crop.img = img; crop.rect = { ...img.crop };
  $('#cropTitle').textContent = `裁剪：${KIND_LABEL[img.kind] || '圖片'}`;
  $('#cropDlg').showModal(); drawCropStage();
}
function drawCropStage() {
  const img = crop.img, o = oriented(img), cv = $('#cropCanvas');
  const maxW = Math.min($('#cropWrap').clientWidth || 900, 940), maxH = Math.max(320, window.innerHeight - 190);
  const sc = Math.min(maxW / o.width, maxH / o.height, 1.5);
  cv.width = Math.round(o.width * sc); cv.height = Math.round(o.height * sc);
  cv.getContext('2d').drawImage(o, 0, 0, cv.width, cv.height);
  const st = $('#cropStage'); st.style.width = cv.width + 'px';
  placeCropBox();
}
function placeCropBox() {
  const cv = $('#cropCanvas'), r = crop.rect, b = $('#cropBox');
  const W = cv.clientWidth || cv.width, H = cv.clientHeight || cv.height;
  b.style.left = r.x * W + 'px'; b.style.top = r.y * H + 'px'; b.style.width = r.w * W + 'px'; b.style.height = r.h * H + 'px';
  const o = oriented(crop.img);
  $('#cropInfo').textContent = `${Math.round(r.w * o.width)} × ${Math.round(r.h * o.height)} 像素`;
}
function cropPointer(e) {
  const cv = $('#cropCanvas'), rc = cv.getBoundingClientRect();
  return { x: (e.clientX - rc.left) / rc.width, y: (e.clientY - rc.top) / rc.height };
}
function onCropDown(e) {
  const h = e.target.dataset.h || (e.target.id === 'cropBox' ? 'move' : null);
  if (!h) return;
  e.preventDefault();
  crop.drag = { h, p0: cropPointer(e), r0: { ...crop.rect } };
  $('#cropBox').setPointerCapture?.(e.pointerId);
}
function onCropMove(e) {
  if (!crop.drag) return;
  const p = cropPointer(e), { h, p0, r0 } = crop.drag, dx = p.x - p0.x, dy = p.y - p0.y, min = 0.03;
  let { x, y, w, h: hh } = r0;
  if (h === 'move') { x = Math.min(1 - w, Math.max(0, x + dx)); y = Math.min(1 - hh, Math.max(0, y + dy)); }
  else {
    let x2 = x + w, y2 = y + hh;
    if (h.includes('w')) x = Math.min(x2 - min, Math.max(0, x + dx));
    if (h.includes('e')) x2 = Math.max(x + min, Math.min(1, x2 + dx));
    if (h.includes('n')) y = Math.min(y2 - min, Math.max(0, y + dy));
    if (h.includes('s')) y2 = Math.max(y + min, Math.min(1, y2 + dy));
    w = x2 - x; hh = y2 - y;
  }
  crop.rect = { x, y, w, h: hh }; placeCropBox();
}
function onCropUp() { crop.drag = null; }
function finishCrop() {
  const img = crop.img; img.crop = { ...crop.rect }; img._crop = null; img._thumb = null; img._big = null;
  $('#cropDlg').close(); rerenderKeepScroll();
}

/* ================= 版面：A4 畫布 ================= */
const A4 = { w: 210, h: 297 };
function makePen(ctx, s) {
  const P = (v) => v * s;
  return {
    ctx, s,
    font(size, o = {}) { ctx.font = `${o.italic ? 'italic ' : ''}${o.bold ? '700' : '400'} ${P(size)}px ${o.family || FORM_FONT}`; },
    line(x1, y1, x2, y2, w = 0.25, color = '#000') { ctx.strokeStyle = color; ctx.lineWidth = P(w); ctx.beginPath(); ctx.moveTo(P(x1), P(y1)); ctx.lineTo(P(x2), P(y2)); ctx.stroke(); },
    text(t, x, y, size, o = {}) {
      this.font(size, o); ctx.fillStyle = o.color || '#000'; ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.baseline || 'alphabetic';
      ctx.fillText(t, P(x), P(y)); const w = ctx.measureText(t).width / s;
      if (o.underline) { const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x; this.line(x0, y + size * 0.16, x0 + w, y + size * 0.16, size * 0.06); }
      return w;
    },
    measure(t, size, o = {}) { this.font(size, o); return ctx.measureText(t).width / s; },
    /* 自動換行並縮細字體以放入格內 */
    box(t, x, y, w, h, o = {}) {
      t = String(t ?? ''); if (!t) return;
      const pad = o.pad ?? 0.9, maxS = o.size || 3.8, minS = o.min || 2.2, lh = o.lh || 1.18;
      const iw = w - pad * 2, ih = h - pad * 2;
      let size = maxS, lines;
      for (; size >= minS; size -= 0.1) { lines = this.wrap(t, iw, size, o); if (lines.length * size * lh <= ih + 0.01) break; }
      if (size < minS) { size = minS; lines = this.wrap(t, iw, size, o); const maxL = Math.max(1, Math.floor(ih / (size * lh))); if (lines.length > maxL) { lines = lines.slice(0, maxL); lines[maxL - 1] = lines[maxL - 1].replace(/.$/, '…'); } }
      const total = lines.length * size * lh;
      let ty = o.valign === 'top' ? y + pad : y + (h - total) / 2;
      lines.forEach((ln) => {
        const tx = o.align === 'center' ? x + w / 2 : o.align === 'right' ? x + w - pad : x + pad;
        this.text(ln, tx, ty + size * (lh - 1) / 2 + size * 0.86, size, { ...o, align: o.align || 'left', underline: false });
        ty += size * lh;
      });
    },
    wrap(t, maxW, size, o) {
      const out = [];
      for (const para of t.split('\n')) {
        const toks = para.match(/[A-Za-z0-9&@#%+\-_.,:;'’"!?/()]+\s*|\s+|[^\sA-Za-z0-9]/g) || [''];
        let cur = '';
        for (const tk of toks) {
          const test = cur + tk;
          if (this.measure(test.trimEnd(), size, o) <= maxW || !cur) cur = test;
          else { out.push(cur.trimEnd()); cur = tk.trimStart(); }
          while (this.measure(cur.trimEnd(), size, o) > maxW && cur.length > 1) { // 單一長字切開
            let k = cur.length - 1; while (k > 1 && this.measure(cur.slice(0, k), size, o) > maxW) k--;
            out.push(cur.slice(0, k)); cur = cur.slice(k);
          }
        }
        out.push(cur.trimEnd());
      }
      return out;
    },
    check(cx, cy, size) { ctx.strokeStyle = '#000'; ctx.lineWidth = P(size * 0.11); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(P(cx - size * 0.38), P(cy)); ctx.lineTo(P(cx - size * 0.08), P(cy + size * 0.32)); ctx.lineTo(P(cx + size * 0.42), P(cy - size * 0.4)); ctx.stroke(); ctx.lineCap = 'butt'; },
    square(x, y, size) { ctx.strokeStyle = '#000'; ctx.lineWidth = P(0.25); ctx.strokeRect(P(x), P(y - size * 0.82), P(size * 0.8), P(size * 0.8)); },
  };
}

/* ===== 官方表格範本（template/form.pdf，已清走示例資料） ===== */
const PT = 25.4 / 72;                       // 1 pt = ? mm
const CROP = { x: 18, y: 10, w: 586, h: 440 }; // 表格在範本頁上的範圍（pt，由上而下）
const OFF_COLS = [[24.6, 154.0], [154.4, 203.6], [204.1, 224.9], [225.4, 260.3], [260.8, 302.8], [303.2, 366.6], [367.1, 402.0], [402.5, 465.4], [466.8, 496.3], [496.8, 549.5], [550.0, 592.4]];
const OFF_ROWS = [[152.04, 186.0], [186.48, 220.56], [221.04, 255.0], [255.48, 289.56]];
const FORM_K = { sets: 0.95, compact: 0.95 };
const HEAD_END = 151.56, ROW_U = 34.44, TAIL_START = 289.56; // 表頭、每行、表尾在範本上的位置（pt）
const ROWS_MAX = Math.floor(((A4.h - 20) / (PT * FORM_K.sets) - (HEAD_END - CROP.y) - (CROP.y + CROP.h - TAIL_START)) / ROW_U);
const TPL = { page: null, loading: null, failed: false, cache: new Map() };
async function loadTemplate() {
  if (TPL.page || TPL.failed) return TPL.page;
  if (!TPL.loading) TPL.loading = (async () => {
    try {
      await withTimeout(loadScript(CDN.pdfjs), 20000, 'PDF 程式庫載入逾時');
      const lib = window.pdfjsLib;
      if (!lib.GlobalWorkerOptions.workerPort) {
        try { lib.GlobalWorkerOptions.workerPort = LOCAL ? new Worker(absURL(CDN.pdfjsWorker)) : new Worker(URL.createObjectURL(new Blob([`importScripts("${CDN.pdfjsWorker}");`], { type: 'application/javascript' }))); }
        catch { lib.GlobalWorkerOptions.workerSrc = CDN.pdfjsWorker; }
      }
      const buf = await (await fetch(CDN.template || 'template/form.pdf')).arrayBuffer();
      const doc = await lib.getDocument({ data: new Uint8Array(buf) }).promise;
      TPL.page = await doc.getPage(1);
    } catch (e) { console.warn('template', e); TPL.failed = true; }
    return TPL.page;
  })();
  return TPL.loading;
}
const tplKey = (ppt) => Math.min(6, Math.ceil(ppt * 4) / 4);
async function ensureTemplate(s) {
  const page = await loadTemplate(); if (!page) return;
  for (const k of Object.values(FORM_K)) {
    const key = tplKey(s * PT * k);
    if (TPL.cache.has(key)) continue;
    const vp = page.getViewport({ scale: key });
    const c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: g, viewport: vp }).promise;
    TPL.cache.set(key, c);
  }
}
function drawOfficial(pen, X, Y, k, form, g) {
  const s = pen.s, ppt = s * PT * k, key = tplKey(ppt), tpl = TPL.cache.get(key);
  if (!tpl) return false;
  pen.ctx.imageSmoothingQuality = 'high';
  const n = Math.max(4, form.rows.length), H1 = HEAD_END - CROP.y;
  const blit = (srcTop, hPt, dstPt) => {
    const dy = Math.round((Y + dstPt * PT * k) * s), dh = Math.round((Y + (dstPt + hPt) * PT * k) * s) - dy;
    pen.ctx.drawImage(tpl, CROP.x * key, srcTop * key, CROP.w * key, hPt * key, Math.round(X * s), dy, Math.round(CROP.w * PT * k * s), dh + 1);
  };
  blit(CROP.y, H1, 0);                                                   // 標題、欄位、表頭
  for (let i = 0; i < n; i++) blit(HEAD_END, ROW_U, H1 + i * ROW_U);   // 每行貨品
  blit(TAIL_START, CROP.y + CROP.h - TAIL_START, H1 + n * ROW_U);      // 例子行、註、書記欄
  const mx = (x) => X + (x - CROP.x) * PT * k, my = (y) => Y + (y - CROP.y) * PT * k, sz = (pt) => pt * PT * k;
  if (g.payee) pen.text(g.payee, mx(194), my(72.0), sz(12));
  if (form.amount != null) pen.text('$' + money(form.amount), mx(513.2), my(72.0), sz(12));
  if (g.applicant) pen.text(g.applicant, mx(123.2), my(96.0), sz(12));
  if (g.date) pen.text(g.date, mx(446), my(96.0), sz(12));
  form.rows.forEach((r, i) => {
    const t = HEAD_END + 0.48 + i * ROW_U, h = sz(ROW_U - 0.48);
    const cell = (c) => ({ x: mx(OFF_COLS[c][0]), w: sz(OFF_COLS[c][1] - OFF_COLS[c][0]) });
    let c = cell(0); pen.box(r.name, c.x, my(t), c.w, h, { size: sz(12), min: sz(7), pad: sz(1.6), lh: 1.15 });
    c = cell(1); pen.box(r.reason, c.x, my(t), c.w, h, { size: sz(12), min: sz(7), pad: sz(1.6), valign: 'top', lh: 1.15 });
    if (r.consumable) { c = cell(2); pen.check(c.x + c.w / 2 - sz(1.5), my(t) + h / 2, sz(11)); }
    [[3, r.location], [4, r.dept], [5, r.subgroup], [6, r.category], [7, r.grant], [8, r.person], [10, r.rdate]].forEach(([ci, v]) => {
      c = cell(ci); pen.box(v, c.x, my(t), c.w, h, { size: sz(11), min: sz(6), align: 'center', lh: 1.12, pad: sz(1.2) });
    });
  });
  return true;
}

const GRID = [2607, 992, 425, 709, 850, 1276, 709, 1276, 609, 1064, 868];
function drawForm(pen, X, Y, form, g) {
  const W = 190, k = W / GRID.reduce((a, b) => a + b, 0), cols = GRID.map((v) => v * k);
  const cx = [X]; cols.forEach((c, i) => cx.push(cx[i] + c));
  const R = X + W;
  pen.text('2324 Version 1', R, Y + 3.2, 2.7, { align: 'right' });
  pen.text('十八鄉鄉事委員會公益社中學', X + W / 2, Y + 8.6, 4.3, { align: 'center', underline: true });
  // 第二行標題：一般 + 粗體 (註 1)
  const t1 = '申請支票支付購物款項表格 (支票付款) ', t2 = '(註 1)';
  const w1 = pen.measure(t1, 4.3), w2 = pen.measure(t2, 4.3, { bold: true });
  const sx = X + W / 2 - (w1 + w2) / 2;
  pen.text(t1, sx, Y + 14.6, 4.3); pen.text(t2, sx + w1, Y + 14.6, 4.3, { bold: true });
  pen.line(sx, Y + 15.3, sx + w1, Y + 15.3, 0.26);
  // 商戶名稱 / 總款額
  let by = Y + 23.5;
  let w = pen.text('商戶名稱(收票人)：', X, by, 4.0);
  pen.line(X + w + 0.5, by + 0.8, X + 86, by + 0.8, 0.22);
  if (g.payee) pen.text(g.payee, X + w + 6, by, 4.0);
  w = pen.text('申請支票總款額：', X + 94, by, 4.0);
  pen.line(X + 94 + w + 0.5, by + 0.8, X + 150, by + 0.8, 0.22);
  pen.text(form.amountText || '$', X + 94 + w + 2, by, 4.0);
  by = Y + 31.5;
  w = pen.text('申請人姓名: ', X, by, 4.0);
  pen.line(X + w, by + 0.8, X + w + 23, by + 0.8, 0.22);
  if (g.applicant) pen.text(g.applicant, X + w + 4, by, 4.0);
  let x2 = X + w + 26;
  w = pen.text('申請人簽署: ', x2, by, 4.0);
  pen.line(x2 + w, by + 0.8, x2 + w + 20, by + 0.8, 0.22);
  x2 = x2 + w + 24;
  w = pen.text('日期: ', x2, by, 4.0);
  if (g.date) pen.text(g.date, x2 + w + 1, by, 4.0);
  // 表格
  const T = Y + 35.5, hh1 = 5.4, hh = 14, rh = 10, er = 10.5;
  const rowsY = [T + hh]; for (let i = 0; i < 4; i++) rowsY.push(rowsY[i] + rh); rowsY.push(rowsY[4] + er);
  const B = rowsY[5];
  // 內線
  for (let i = 1; i < cols.length; i++) {
    const thick = i === 8; // 組別負責人左邊粗線
    if (i === 9) pen.line(cx[i], T + hh1, cx[i], B, 0.25);
    else pen.line(cx[i], T, cx[i], B, thick ? 0.5 : 0.25);
  }
  pen.line(cx[8], T + hh1, cx[10], T + hh1, 0.25);
  for (let i = 0; i < 5; i++) pen.line(X, rowsY[i], R, rowsY[i], i === 0 ? 0.5 : 0.25);
  // 外框
  [[X, T, R, T], [X, B, R, B], [X, T, X, B], [R, T, R, B]].forEach((l) => pen.line(...l, 0.6));
  // 表頭
  const hs = 3.45, cell = (i, txt, o = {}) => pen.box(txt, cx[i], T, cols[i], hh, { size: hs, min: 2.4, align: 'center', lh: 1.25, ...o });
  cell(0, '貨品名稱');
  pen.box('購物原因', cx[1], T + 1.3, cols[1], hh / 2, { size: hs, align: 'center' });
  pen.box('(註 2)', cx[1], T + hh / 2 - 0.6, cols[1], hh / 2, { size: hs, align: 'center', bold: true });
  cell(2, '消\n耗\n品', { lh: 1.12, pad: 0.4 });
  cell(3, '貯放\n位置'); cell(4, '支付款\n項組別'); cell(5, '支付款項組\n別內的小組\n(如適用)', { lh: 1.15 });
  cell(6, '支付\n款項\n類別', { lh: 1.15 }); cell(7, '那一筆津貼\n(grant)支付');
  pen.box('組別負責人', cx[8], T, cols[8] + cols[9], hh1, { size: hs, align: 'center' });
  pen.box('姓名', cx[8], T + hh1, cols[8], hh - hh1, { size: hs, align: 'center' });
  pen.box('簽署', cx[9], T + hh1, cols[9], hh - hh1, { size: hs, align: 'center' });
  cell(10, '日期');
  // 貨品行
  form.rows.forEach((r, i) => {
    const y0 = rowsY[i], h = rh;
    pen.box(r.name, cx[0], y0, cols[0], h, { size: 4.0, min: 2.4, valign: 'center' });
    pen.box(r.reason, cx[1], y0, cols[1], h, { size: 3.8, min: 2.2 });
    if (r.consumable) pen.check(cx[2] + cols[2] / 2, y0 + h / 2, 3.4);
    const map = [[3, r.location], [4, r.dept], [5, r.subgroup], [6, r.category], [7, r.grant], [8, r.person], [10, r.rdate]];
    map.forEach(([c, v]) => pen.box(v, cx[c], y0, cols[c], h, { size: 3.5, min: 2.0, align: 'center', lh: 1.12, pad: 0.6 }));
  });
  // 例子行
  const ey = rowsY[4], eo = { italic: true, size: 2.75, min: 2.0, align: 'center', lh: 1.25, pad: 0.4 };
  pen.box('例：剪刀', cx[0], ey, cols[0], er, eo);
  pen.box('佈置壁報', cx[1], ey, cols[1], er, eo);
  pen.check(cx[2] + cols[2] / 2, ey + er / 2 - 0.6, 2.2);
  pen.box('N204', cx[3], ey, cols[3], er, eo); pen.box('CCA', cx[4], ey, cols[4], er, eo);
  pen.box('School\nteam/\nClub…….', cx[5], ey, cols[5], er, { ...eo, bold: true, align: 'left' });
  pen.box('Others', cx[6], ey, cols[6], er, { ...eo, bold: true });
  pen.box('School & Class\nGrant/\nSubject Grant', cx[7], ey, cols[7], er, { ...eo, bold: true });
  pen.box('CH', cx[8], ey, cols[8], er, { ...eo, bold: true });
  pen.box('24/4/2020', cx[10], ey, cols[10], er, { ...eo, bold: true });
  // 註
  let ny = B + 6.2;
  pen.text('註1：', X + 3, ny, 3.4);
  let nx = X + 15;
  nx += pen.text('請把此表格與現沽單/發票', nx, ny, 3.4);
  nx += pen.text('正本', nx, ny, 4.2, { bold: true, underline: true });
  pen.text('釘在一起，交與財務部書記。', nx, ny, 3.4);
  ny += 5.6;
  pen.text('註2：', X + 3, ny, 3.4);
  pen.text('如購買教材及參考資料，必須符合「課程發展議會於各學習階段課程所訂定的課程宗旨、目標的內容，並切合', X + 15, ny, 3.4);
  pen.text('學生的程度和學習需要」，以及《香港法例》。', X + 15, ny + 4.6, 3.4);
  // 書記欄
  const cy0 = ny + 12.6, gap = 6.3, cs = 3.6;
  [['負責書記姓名：', '已輸入資產管理系統：'], ['簽署：', '輸人者姓名：'], ['日期：', '簽署：']].forEach(([a, b], i) => {
    const yy = cy0 + i * gap;
    pen.text(a, X + 44, yy, cs, { align: 'right' }); pen.line(X + 45, yy + 1.2, X + 82, yy + 1.2, 0.22);
    pen.text(b, X + 134, yy, cs, { align: 'right' });
    if (i === 0) { pen.square(X + 136, yy, cs); pen.text('是', X + 140, yy, cs); pen.square(X + 150, yy, cs); pen.text('否', X + 153.2, yy, cs); }
    else pen.line(X + 135, yy + 1.2, X + 172, yy + 1.2, 0.22);
  });
}

const rowsPerForm = () => (TPL.failed ? 4 : ROWS_MAX);
function displayName(r, o) { return o.type === 'general' && o.includeCode && r.code ? `${r.name}（${r.code}）` : r.name; }
function buildForms(o) {
  const per = rowsPerForm(), forms = [];
  const g = { payee: o.payee ?? S.settings.payee, applicant: S.settings.applicant, date: o.appDate || '' };
  const mk = (rows) => {
    const vals = rows.map((r) => r.hkd).filter((v) => v != null && !isNaN(v));
    const amount = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100 : null;
    return { rows: rows.map((r) => ({ ...r, name: displayName(r, o) })), amount, amountText: amount == null ? '$' : '$' + money(amount), orderIds: [o.id], g, order: o };
  };
  const rs = S.rows.filter((r) => r.orderId === o.id);
  if (!rs.length) forms.push(mk([]));
  for (let i = 0; i < rs.length; i += per) forms.push(mk(rs.slice(i, i + per)));
  forms.forEach((f, i) => { f.no = i + 1; f.of = forms.length; });
  return forms;
}
/* 一張申請表的附件：表內的淘寶訂單和收據，PPS 紀錄放第一頁 */
function chunkImgs(imgs, fixed) {
  if (imgs.length <= 6) return [imgs];
  const out = [imgs.slice(0, fixed + 3)]; for (let i = fixed + 3; i < imgs.length; i += 4) out.push(imgs.slice(i, i + 4)); return out;
}
function formAttachments(f, forms) {
  const o = f.order; if (o.type !== 'taobao') return [];
  const info = orderInfo(o), pages = [];
  const rowSet = new Set(f.rows.map((r) => r.id)), firstForm = f.no === 1;
  const groups = [];
  [...new Set(f.rows.map((r) => r.subKey))].forEach((k) => { const g = info.subs.find((s) => s.key === k); if (g) groups.push({ g, imgs: [...g.imgs, ...g.rc], fixed: g.imgs.length }); });
  if (!groups.length) groups.push({ g: null, imgs: [...info.tb], fixed: info.tb.length });
  if (firstForm && info.loose.length) groups[groups.length - 1].imgs.push(...info.loose);
  void rowSet;
  groups.forEach((gr, k) => {
    const imgs = [...gr.imgs];
    if (k === 0 && info.pps) imgs.push(info.pps);
    if (!imgs.length) return;
    chunkImgs(imgs, gr.fixed).forEach((part) => pages.push({ type: 'att', order: o, info, sub: gr.g, imgs: part, formNo: f.no, formOf: f.of }));
  });
  pages.forEach((p, i) => { p.part = i + 1; p.parts = pages.length; });
  return pages;
}
function buildPages(list) {
  const s = S.settings, pages = [];
  list.forEach((o) => {
    const forms = buildForms(o);
    if (s.layout === 'compact') {
      forms.forEach((f) => pages.push({ type: 'forms', forms: [f], order: o }));
      if (s.attach) forms.forEach((f) => pages.push(...formAttachments(f, forms)));
    } else forms.forEach((f) => { pages.push({ type: 'forms', forms: [f], order: o }); if (s.attach) pages.push(...formAttachments(f, forms)); });
  });
  return pages;
}
function packImages(items, W, H, gap) {
  const n = items.length; if (!n) return [];
  let best = null;
  for (let mask = 0; mask < (1 << (n - 1)); mask++) {
    const rows = [[0]];
    for (let i = 1; i < n; i++) { if (mask & (1 << (i - 1))) rows.push([i]); else rows[rows.length - 1].push(i); }
    const hs = rows.map((r) => (W - gap * (r.length - 1)) / r.reduce((a, i) => a + items[i].a, 0));
    const tot = hs.reduce((a, b) => a + b, 0), avail = H - gap * (rows.length - 1);
    const sc = Math.min(1, avail / tot);
    let area = 0, minW = Infinity;
    rows.forEach((r, ri) => r.forEach((i) => { const h = hs[ri] * sc, w = h * items[i].a; area += w * h; minW = Math.min(minW, w); }));
    const score = area * (minW < 45 ? 0.6 : 1);
    if (!best || score > best.score) best = { score, rows, hs, sc };
  }
  const out = []; let y = 0;
  best.rows.forEach((r, ri) => {
    const h = best.hs[ri] * best.sc, rowW = r.reduce((a, i) => a + h * items[i].a, 0) + gap * (r.length - 1);
    let x = (W - rowW) / 2;
    r.forEach((i) => { const w = h * items[i].a; out.push({ i, x, y, w, h }); x += w + gap; });
    y += h + gap;
  });
  return out;
}
function drawAttachment(pen, page) {
  const info = page.info, s = S.settings;
  const M = 10, W = A4.w - M * 2;
  let top = M;
  if (s.caption) {
    const no = page.sub ? page.sub.no : info.orderNo;
    const parts = [`${purchaseLabel(page.order)}・申請表 ${page.formNo}${page.formOf > 1 ? `/${page.formOf}` : ''} 附件 ${page.part}/${page.parts}`, no ? `淘寶訂單編號 ${no}` : '', page.sub && page.sub.hkd != null ? `淘寶實付 HK$${money(page.sub.hkd)}` : '',
      info.hkdPPS != null ? `PPS 付款 HK$${money(info.hkdPPS)}` : '', info.when ? `交易時間 ${info.when}` : ''].filter(Boolean);
    const cap = parts.join('　｜　'); let cs = 3.3;
    while (cs > 2.3 && pen.measure(cap, cs, { family: SANS }) > W) cs -= 0.1;
    pen.text(cap, M, M + 3.6, cs, { family: SANS });
    pen.line(M, M + 5.6, M + W, M + 5.6, 0.2, '#888');
    top = M + 9;
  }
  const imgs = page.imgs;
  const items = imgs.map((im) => { const c = cropped(im); return { a: c.width / c.height, c }; });
  const H = A4.h - M - top;
  const lay = packImages(items, W, H, 4);
  const ctx = pen.ctx, P = (v) => v * pen.s;
  ctx.imageSmoothingQuality = 'high';
  lay.forEach((b) => {
    ctx.drawImage(items[b.i].c, P(M + b.x), P(top + b.y), P(b.w), P(b.h));
    ctx.strokeStyle = '#b8b8b8'; ctx.lineWidth = Math.max(1, P(0.15)); ctx.strokeRect(P(M + b.x), P(top + b.y), P(b.w), P(b.h));
  });
}
function renderPage(page, s) {
  const c = document.createElement('canvas'); c.width = Math.round(A4.w * s); c.height = Math.round(A4.h * s);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  const pen = makePen(ctx, s);
  if (page.type === 'forms') {
    const k = FORM_K.sets, w = CROP.w * PT * k, X = (A4.w - w) / 2;
    page.forms.forEach((f) => { if (!drawOfficial(pen, X, 10, k, f, f.g)) drawForm(pen, 10, 10, f, f.g); });
  } else drawAttachment(pen, page);
  return c;
}
async function ensureFonts(pages) {
  if (!document.fonts?.load) return;
  const txt = new Set('十八鄉事委員會公益社中學申請支票支付購物款項表格註商戶名稱收人總額姓簽署日期貨品原因消耗貯放位置組別內的小如適用類那一筆津貼負責例剪刀佈置壁報把此與現沽單發正本釘在起交財務部書記購買教材及參考資料必須符合課程發展議於各學習階段所訂定宗旨目標容並切生度和需要以香港法例已輸入資產管理系統是否者：，「」《》()（）$0123456789'.split(''));
  pages.filter((p) => p.type === 'forms').forEach((p) => p.forms.forEach((f) => {
    [f.g.payee, f.g.applicant, f.g.date].forEach((v) => [...(v || '')].forEach((ch) => txt.add(ch)));
    f.rows.forEach((r) => { [...(r.name || '')].forEach((ch) => txt.add(ch)); FIELDS.forEach((fd) => [...String(r[fd.k] || '')].forEach((ch) => txt.add(ch))); });
  }));
  const str = [...txt].join('');
  try { await withTimeout(Promise.all([document.fonts.load('20px "LXGW WenKai TC"', str), document.fonts.load('700 20px "LXGW WenKai TC"', str), document.fonts.load('20px "Noto Sans TC"', '附件淘寶訂單編號交易時間付款一般購物申請表')]), 6000, 'font'); } catch { }
}
let pvToken = 0;
const schedulePreview = debounce(renderPreview, 300);
const activeOrder = () => S.orders.find((x) => x.id === S.active);
async function renderPreview() {
  const o = activeOrder(); if (!o) return;
  const tok = ++pvToken;
  const pages = buildPages([o]);
  const dpr = Math.min(2, window.devicePixelRatio || 1), s = 2.4 * dpr;
  await Promise.all([ensureFonts(pages), ensureTemplate(s)]);
  if (tok !== pvToken) return;
  const box = $('#pages'); if (!box) return; box.innerHTML = '';
  const nf = buildForms(o).length, na = pages.filter((p) => p.type === 'att').length;
  const sum = $('#pvSummary'); if (sum) sum.textContent = `共 ${pages.length} 頁 A4：申請表 ${nf} 張${na ? `、附件 ${na} 頁` : ''}。按頁面可以放大。`;
  pages.forEach((p, i) => {
    const wrap = document.createElement('div'); wrap.className = 'page';
    const c = renderPage(p, s); c.setAttribute('role', 'img'); c.setAttribute('aria-label', `第 ${i + 1} 頁`); c.tabIndex = 0;
    c.addEventListener('click', () => openPage(o, i)); c.addEventListener('keydown', (e) => { if (e.key === 'Enter') openPage(o, i); });
    const lab = document.createElement('span'); lab.textContent = `第 ${i + 1} 頁・${p.type === 'forms' ? `申請表 ${p.forms[0].no}` : `申請表 ${p.formNo} 附件 ${p.part}/${p.parts}`}`;
    wrap.append(c, lab); box.appendChild(wrap);
  });
}
async function openPage(o, i) {
  const pages = buildPages([o]); await ensureFonts(pages); await ensureTemplate(6);
  const c = renderPage(pages[i], 6); $('#pageBig').innerHTML = ''; $('#pageBig').appendChild(c);
  $('#pageTitle').textContent = `第 ${i + 1} 頁`; $('#pageDlg').showModal();
}
function viewImage(img) {
  const c = cropped(img);
  c.toBlob((b) => {
    const u = URL.createObjectURL(b);
    $('#pageBig').innerHTML = `<img src="${u}" alt="" style="width:100%;height:auto;display:block">`;
    $('#pageTitle').textContent = `${KIND_LABEL[img.kind] || '圖片'}${img.kind === 'receipt' ? ' ' + rcLabel(img) : ''}`;
    $('#pageDlg').showModal();
    $('#pageDlg').addEventListener('close', () => URL.revokeObjectURL(u), { once: true });
  }, 'image/jpeg', 0.92);
}

/* ================= PDF 及列印 ================= */
const stampName = (list) => {
  const d = new Date(), st = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return list.length === 1 ? `購物記錄表_${purchaseLabel(list[0]).replace(/[\\/:*?"<>|\s]+/g, '_')}.pdf` : `購物記錄表_${st}.pdf`;
};
async function downloadPDF(list, btn) {
  btn.disabled = true; const old = btn.textContent; btn.textContent = '製作中…';
  try {
    list.forEach((o) => S.rows.filter((r) => r.orderId === o.id).forEach((r) => FIELDS.forEach((f) => f.opt && rememberOption(f.opt, r[f.k]))));
    const dl = LOCAL ? null : await claudeUse('downloads');
    await withTimeout(loadScript(CDN.jspdf), 20000, 'PDF 程式庫載入逾時');
    const { jsPDF } = window.jspdf;
    const pages = buildPages(list); await ensureFonts(pages); await ensureTemplate(7.874);
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    for (let i = 0; i < pages.length; i++) {
      btn.textContent = `製作中 ${i + 1}/${pages.length}…`;
      const c = renderPage(pages[i], 7.874);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
      if (i > 0) doc.addPage('a4', 'p');
      doc.addImage(new Uint8Array(await blob.arrayBuffer()), 'JPEG', 0, 0, A4.w, A4.h, undefined, 'FAST');
      await new Promise((r) => setTimeout(r, 0));
    }
    const fname = stampName(list), out = doc.output('blob');
    if (dl) { const res = await dl.save({ filename: fname, data: out }); if (res?.status === 'saved') toast('已下載 PDF'); }
    else saveBlob(out, fname);
  } catch (e) {
    const code = e?.code;
    if (code === 'declined') toast('已取消下載'); else if (code === 'rate_limited') toast('請稍等一會再試');
    else { console.error(e); toast('未能製作 PDF：' + (e.message || code || e), 5000); }
  } finally { btn.disabled = false; btn.textContent = old; }
}
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000); toast('已下載 ' + name);
}
async function printDirect(list, btn) {
  btn.disabled = true; const old = btn.textContent; btn.textContent = '準備中…';
  try {
    const pages = buildPages(list); await ensureFonts(pages); await ensureTemplate(7.874);
    let area = $('#printArea'); if (!area) { area = document.createElement('div'); area.id = 'printArea'; document.body.appendChild(area); }
    area.innerHTML = '';
    const urls = [];
    for (const pg of pages) {
      const c = renderPage(pg, 7.874);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
      const u = URL.createObjectURL(blob); urls.push(u);
      const im = new Image(); im.src = u; im.alt = ''; area.appendChild(im);
      await new Promise((r) => setTimeout(r, 0));
    }
    await Promise.all([...area.querySelectorAll('img')].map((im) => (im.complete ? 1 : new Promise((r) => { im.onload = im.onerror = r; }))));
    const cleanup = () => { area.innerHTML = ''; urls.forEach((u) => URL.revokeObjectURL(u)); window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup);
    window.print();
  } catch (e) { console.error(e); toast('未能列印：' + (e.message || e), 5000); }
  finally { btn.disabled = false; btn.textContent = old; }
}
function exportSettings() { saveBlob(new Blob([JSON.stringify(S.settings, null, 2)], { type: 'application/json' }), '購物記錄表_設定.json'); }
async function importSettings(file) {
  try { const obj = JSON.parse(await file.text()); if (!obj || !obj.options) throw new Error('格式不對'); mergeSettings(obj); saveSettings(); afterSettingsChange(); $('#setDlg').close(); toast('已匯入設定'); }
  catch (e) { toast('未能匯入：' + (e.message || e), 4000); }
}

/* ================= 設定對話框 ================= */
function openSettings() {
  $('#optEditors').innerHTML = Object.keys(OPT_LABELS).map((k) => `<label class="field"><span>${OPT_LABELS[k]}</span><textarea data-opt="${k}" spellcheck="false">${esc((S.settings.options[k] || []).join('\n'))}</textarea></label>`).join('');
  $('#rulesText').value = S.settings.rulesText; $('#stopText').value = S.settings.stopText;
  $('#set_payee').value = S.settings.payee; $('#set_applicant').value = S.settings.applicant;
  $('#resetConfirm').hidden = true;
  $('#setDlg').showModal();
}
function saveSettingsDlg() {
  document.querySelectorAll('[data-opt]').forEach((t) => { S.settings.options[t.dataset.opt] = t.value.split('\n').map((x) => x.trim()).filter(Boolean); });
  S.settings.rulesText = $('#rulesText').value; S.settings.stopText = $('#stopText').value;
  S.settings.payee = $('#set_payee').value.trim(); S.settings.applicant = $('#set_applicant').value.trim();
  saveSettings(); afterSettingsChange(); $('#setDlg').close(); toast('已儲存設定');
}
function afterSettingsChange() { buildDatalists(); syncRows(); renderAll(); }

/* ================= 事件 ================= */
function bind() {
  const fileIn = $('#fileIn');
  fileIn.addEventListener('change', () => { addFiles(fileIn.files); fileIn.value = ''; });
  const one = document.createElement('input'); one.type = 'file'; one.accept = 'image/*,application/pdf'; one.multiple = true; one.className = 'sr'; document.body.appendChild(one);
  one.addEventListener('change', () => { addFiles(one.files, one._target); one.value = ''; });
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => { if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files); });
  window.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    if (!e.dataTransfer?.files?.length || drop.contains(e.target)) return; e.preventDefault();
    const o = activeOrder();
    addFiles(e.dataTransfer.files, o && o.type === 'taobao' ? { orderId: o.id, kind: null } : undefined);
  });
  document.addEventListener('paste', (e) => {
    if (e.target.closest('input,textarea')) return;
    const files = [...(e.clipboardData?.files || [])]; if (!files.length) return;
    e.preventDefault(); const o = activeOrder();
    addFiles(files, o && o.type === 'taobao' ? { orderId: o.id, kind: null } : undefined); toast('已貼上圖片');
  });
  $('#ocrNote').addEventListener('click', (e) => {
    if (e.target.id !== 'btnRetryOCR') return;
    S.ocr.failed = null; $('#ocrNote').hidden = true;
    [...S.images.values()].filter((i) => i.status === 'err').forEach(enqueueOCR); if (!S.ocr.queue.length) ensureWorker().catch(() => {});
  });
  // 清單
  $('#nav').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab],[data-act]'); if (!b) return;
    if (b.dataset.act === 'new-general') {
      const o = newOrder(true, 'general'); const r = newRow(o.id, ''); r.edited = true; r.hkdEdited = true; S.rows.push(r);
      S.active = o.id; syncRows(); renderAll(); window.scrollTo(0, 0); setTimeout(() => $('#viewPurchase [data-f="name"]')?.focus(), 50); return;
    }
    S.active = b.dataset.tab; renderAll(); window.scrollTo(0, 0);
  });
  $('#plist').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { S.active = b.dataset.tab; renderAll(); window.scrollTo(0, 0); } });
  $('#btnAllPDF').addEventListener('click', (e) => { if (!S.orders.length) { toast('未有購物紀錄'); return; } downloadPDF([...S.orders], e.currentTarget); });
  if (LOCAL) { $('#btnAllPrint').hidden = false; $('#btnAllPrint').addEventListener('click', (e) => { if (S.orders.length) printDirect([...S.orders], e.currentTarget); }); }

  // 圖片動作（上載頁及購物頁共用）
  const onClick = (e) => {
    const z = e.target.closest('[data-zoom]'); if (z && !e.target.closest('button,select')) { viewImage(S.images.get(z.dataset.zoom)); return; }
    const b = e.target.closest('[data-act],[data-unrc],[data-assign]'); if (!b) return;
    const o = activeOrder();
    if (b.dataset.unrc) { const img = S.images.get(b.dataset.unrc); img.subKey = '__none'; img.assignManual = true; syncRows(); rerenderKeepScroll(); return; }
    if (b.dataset.assign) { const img = S.images.get(b.dataset.assign); if (o && img.orderId !== o.id) attach(img, o, 'receipt'); img.subKey = b.dataset.sub; img.assignManual = true; syncRows(); rerenderKeepScroll(); return; }
    const act = b.dataset.act;
    if (act === 'crop') openCrop(S.images.get(b.dataset.img));
    if (act === 'add-file') { one._target = { orderId: b.dataset.order, kind: b.dataset.kind, subKey: b.dataset.sub || null }; one.click(); }
    if (act === 'del-p') {
      $('#delHost').innerHTML = `<b>刪除「${esc(purchaseLabel(o))}」？</b> <button class="btn small danger" type="button" data-act="del-p-keep">刪除，圖片放回未分類</button> <button class="btn small danger" type="button" data-act="del-p-all">連圖片一併刪除</button> <button class="btn small" type="button" data-act="del-p-no">取消</button>`;
    }
    if (act === 'del-p-no') renderPurchase();
    if (act === 'del-p-keep' || act === 'del-p-all') {
      [...o.taobao, o.pps, ...o.receipts].filter(Boolean).forEach((id) => {
        const im = S.images.get(id); if (!im) return;
        if (act === 'del-p-all') { S.images.delete(id); delBlob(id); } else { im.orderId = null; im.assignManual = true; im.subKey = null; }
      });
      S.rows = S.rows.filter((r) => r.orderId !== o.id); S.orders = S.orders.filter((x) => x !== o); S.active = 'inbox'; renderAll(); toast('已刪除');
    }
    if (act === 'apply-all') {
      const d = S.settings.defaults, rs = S.rows.filter((r) => r.orderId === o.id);
      rs.forEach((r) => { FIELDS.forEach((f) => { if (d[f.k]) r[f.k] = d[f.k]; }); r.consumable = d.consumable; });
      rerenderKeepScroll(); toast(`已套用到 ${rs.length} 行`);
    }
    if (act === 'add-row-end') { const r = newRow(o.id, ''); r.edited = true; r.hkdEdited = true; S.rows.push(r); syncRows(); rerenderKeepScroll(); document.querySelector(`[data-row="${r.id}"] [data-f="name"]`)?.focus(); }
    const rowEl = b.closest('[data-row]'), r = rowEl && S.rows.find((x) => x.id === rowEl.dataset.row);
    if (!r) return;
    if (act === 'add-row') { const nr = newRow(r.orderId, ''); nr.subKey = r.subKey; nr.after = r.id; nr.hkdEdited = true; nr.edited = true; S.rows.splice(S.rows.indexOf(r) + 1, 0, nr); syncRows(); rerenderKeepScroll(); document.querySelector(`[data-row="${nr.id}"] [data-f="name"]`)?.focus(); }
    if (act === 'del-row') { S.rows = S.rows.filter((x) => x !== r); if (r.autoKey) S.deleted.add(`${r.orderId}|${r.autoKey}`); rerenderKeepScroll(); }
    if (act === 'use-title') { r.name = shorten((r.titles || [])[+b.dataset.t]); r.edited = true; rerenderKeepScroll(); }
    if (act === 'remember') {
      const host = rowEl.querySelector('.rule-host');
      host.innerHTML = `<div class="rule-form"><label class="field"><span>標題中的關鍵字（可用 | 分隔多個）</span><input data-rk placeholder="例如：杀菌灯|紫外线"></label>
        <label class="field"><span>表格上的名稱</span><input data-rv value="${esc(r.name)}"></label>
        <button class="btn small primary" type="button" data-act="rule-save">加入詞典</button><button class="btn small" type="button" data-act="rule-cancel">取消</button></div>`;
      host.querySelector('[data-rk]').focus();
    }
    if (act === 'rule-cancel') rowEl.querySelector('.rule-host').innerHTML = '';
    if (act === 'rule-save') {
      const k = rowEl.querySelector('[data-rk]').value.trim(), v = rowEl.querySelector('[data-rv]').value.trim();
      if (!k || !v) { toast('請填寫關鍵字和名稱'); return; }
      S.settings.rulesText = `${k} = ${v}\n` + S.settings.rulesText; saveSettings();
      rowEl.querySelector('.rule-host').innerHTML = ''; toast(`已記住：「${k}」→「${v}」`);
    }
  };
  const onChange = (e) => {
    const t = e.target, o = activeOrder();
    if (t.dataset.move) {
      const img = S.images.get(t.dataset.move), v = t.value; if (!img || !v) return;
      if (v === 'del') { detach(img); S.images.delete(img.id); delBlob(img.id); S.ocr.queue = S.ocr.queue.filter((q) => q !== img.id); }
      else if (v === 'tray') { detach(img); img.assignManual = true; img.subKey = null; }
      else { const dest = v === 'new' ? newOrder(true, 'taobao') : S.orders.find((x) => x.id === v); if (dest) { img.assignManual = true; img.subKey = null; attach(img, dest, img.kind || 'receipt'); } }
      cleanupOrders(); syncRows(); rerenderKeepScroll(); return;
    }
    if (t.dataset.kind) {
      const img = S.images.get(t.dataset.kind); if (!img) return;
      img.kindManual = true; const dest = S.orders.find((x) => x.id === img.orderId);
      if (dest) attach(img, dest, t.value); else img.kind = t.value;
      syncRows(); rerenderKeepScroll(); return;
    }
    if (t.dataset.pickrc) { const img = S.images.get(t.value); if (!img) return; if (img.orderId !== o.id) attach(img, o, 'receipt'); img.subKey = t.dataset.pickrc; img.assignManual = true; syncRows(); rerenderKeepScroll(); return; }
    if (t.dataset.pickpps) { const img = S.images.get(t.value); if (!img) return; img.assignManual = true; attach(img, o, 'pps'); syncRows(); rerenderKeepScroll(); return; }
    if (t.dataset.hkd) { const v = parseFloat(t.value.replace(/[^\d.]/g, '')); o.hkdOverride = isNaN(v) ? null : Math.round(v * 100) / 100; syncRows(); rerenderKeepScroll(); return; }
    if (t.id === 'pv_layout') { S.settings.layout = t.value; saveSettings(); schedulePreview(); return; }
    if (t.id === 'pv_att') { S.settings.attach = t.checked; saveSettings(); schedulePreview(); return; }
    if (t.id === 'pv_cap') { S.settings.caption = t.checked; saveSettings(); schedulePreview(); return; }
    if (t.dataset.pf === 'includeCode') { o.includeCode = t.checked; markDirty(); schedulePreview(); return; }
    const f = FIELDS.find((x) => x.k === (t.dataset.f || t.dataset.shared)); if (f?.opt) rememberOption(f.opt, t.value);
    if (t.dataset.f === 'name' || t.dataset.pf === 'title') renderNav();
  };
  const onInput = (e) => {
    const t = e.target, o = activeOrder(); if (!o) return;
    if (t.dataset.pf && t.dataset.pf !== 'includeCode') { o[t.dataset.pf] = t.value; markDirty(); schedulePreview(); return; }
    if (t.dataset.gs) { S.settings[t.dataset.gs] = t.value; saveSettings(); schedulePreview(); return; }
    if (t.dataset.shared) { S.settings.defaults[t.dataset.shared] = t.type === 'checkbox' ? t.checked : t.value; saveSettings(); return; }
    const rowEl = t.closest('[data-row]'); if (!rowEl || !t.dataset.f) return;
    const r = S.rows.find((x) => x.id === rowEl.dataset.row); if (!r) return;
    if (t.type === 'checkbox') r[t.dataset.f] = t.checked;
    else if (t.dataset.f === 'hkd') { const v = parseFloat(t.value.replace(/[^\d.]/g, '')); r.hkd = isNaN(v) ? null : Math.round(v * 100) / 100; r.hkdEdited = true; updateTotals(); }
    else r[t.dataset.f] = t.value;
    if (t.dataset.f === 'name') r.edited = true; else { const sm = rowEl.querySelector('[data-sum]'); if (sm) sm.textContent = rowSummary(r); }
    markDirty(); schedulePreview();
  };
  ['#viewPurchase', '#viewInbox'].forEach((sel) => { const el = $(sel); el.addEventListener('click', onClick); el.addEventListener('change', onChange); el.addEventListener('input', onInput); });
  $('#viewPurchase').addEventListener('focusout', (e) => { if (['name', 'hkd'].includes(e.target.dataset?.f)) renderNav(); });
  $('#viewPurchase').addEventListener('toggle', (e) => { const rowEl = e.target.closest?.('[data-row]'); if (!rowEl) return; if (e.target.open) S.openRows.add(rowEl.dataset.row); else S.openRows.delete(rowEl.dataset.row); }, true);
  $('#viewPurchase').addEventListener('click', (e) => {
    if (e.target.id === 'btnPDF') downloadPDF([activeOrder()], e.target);
    if (e.target.id === 'btnPrint') printDirect([activeOrder()], e.target);
  });
  // 裁剪
  const stage = $('#cropStage');
  stage.addEventListener('pointerdown', onCropDown); window.addEventListener('pointermove', onCropMove); window.addEventListener('pointerup', onCropUp);
  $('#cropDone').addEventListener('click', finishCrop);
  $('#cropAuto').addEventListener('click', () => { crop.rect = crop.img.autoCrop && !crop.img.rot ? { ...crop.img.autoCrop } : trimBorders(oriented(crop.img)); placeCropBox(); });
  $('#cropFull').addEventListener('click', () => { crop.rect = { x: 0, y: 0, w: 1, h: 1 }; placeCropBox(); });
  $('#cropRot').addEventListener('click', () => { const img = crop.img; img.rot = ((img.rot || 0) + 90) % 360; img._crop = null; crop.rect = trimBorders(oriented(img)); drawCropStage(); });
  $('#cropDlg').addEventListener('close', () => { crop.drag = null; });
  window.addEventListener('resize', debounce(() => { if ($('#cropDlg').open) drawCropStage(); }, 150));
  $('#pageClose').addEventListener('click', () => $('#pageDlg').close());
  $('#pageDlg').addEventListener('click', (e) => { if (e.target === $('#pageDlg')) $('#pageDlg').close(); });
  // 設定
  $('#btnSettings').addEventListener('click', openSettings);
  $('#setSave').addEventListener('click', saveSettingsDlg);
  $('#setReset').addEventListener('click', () => { $('#resetConfirm').hidden = false; });
  $('#setResetNo').addEventListener('click', () => { $('#resetConfirm').hidden = true; });
  $('#setResetYes').addEventListener('click', () => { const keep = { payee: S.settings.payee, applicant: S.settings.applicant }; S.settings = { ...clone(DEFAULT_SETTINGS), ...keep }; saveSettings(); $('#setDlg').close(); afterSettingsChange(); toast('已還原預設設定'); });
  if (LOCAL) {
    $('#setPort').hidden = false;
    $('#btnExport').addEventListener('click', exportSettings);
    const imp = $('#importIn'); $('#btnImport').addEventListener('click', () => imp.click());
    imp.addEventListener('change', () => { if (imp.files[0]) importSettings(imp.files[0]); imp.value = ''; });
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
}

/* ================= 啟動 ================= */
async function init() {
  loadLocal();
  bind(); buildDatalists();
  try { navigator.storage?.persist?.(); } catch { }
  const had = await restoreState();
  syncRows(); renderAll();
  if (had) { const c = $('#saveChip'); if (c) { c.className = 'chip ok'; c.textContent = '已載入上次的工作'; } }
  if (!LOCAL) initSync();
  ensureConv().then(() => { syncRows(); renderAll(); });
  setTimeout(() => ensureWorker().catch(() => {}), 1200);
  loadTemplate();
}
window.__app = { S, Parser, orderInfo, buildPages, renderPage, addFiles, suggestName, ensureTemplate, TPL, buildForms };
init();
})();
