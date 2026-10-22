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
  v: 1, payee: 'YCH', applicant: 'YCH', group: 'order', layout: 'sets', attach: true, caption: true,
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
  images: new Map(), orders: [], rows: [], demo: false, openRows: new Set(), deleted: new Set(), appDate: '',
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
  img._crop = { key, c }; img._thumb = null; return c;
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
  if (S.demo) clearDemo();
  for (const f of list) {
    try {
      if (/pdf/i.test(f.type) || /\.pdf$/i.test(f.name)) await addPDF(f, target);
      else {
        const meta = /png$/i.test(f.type) || /\.png$/i.test(f.name) ? await readPngMeta(f) : null;
        const base = await fileToCanvas(f);
        const img = newImage(f.name, base, target);
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
function newImage(name, base, target) {
  const img = { id: uid('i'), name, base, rot: 0, crop: { x: 0, y: 0, w: 1, h: 1 }, kind: target?.kind || null, kindManual: !!target?.kind,
    status: 'queued', data: {}, orderId: null, assignManual: !!target?.orderId, progress: 0, subKey: target?.subKey || null };
  img.crop = trimBorders(base);
  S.images.set(img.id, img);
  if (target?.orderId) { const o = S.orders.find((o) => o.id === target.orderId); if (o) attach(img, o, target.kind || 'receipt'); }
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
    const img = newImage(n > 1 ? `${file.name}（第 ${p} 頁）` : file.name, c, target);
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

/* ================= 配對 ================= */
function newOrder(manual = false) { const o = { id: uid('o'), taobao: [], pps: null, receipts: [], hkdOverride: null, manual }; S.orders.push(o); return o; }
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
  const hkd = hkdPPS ?? hkdTB;
  const date = pps?.data.date || tb.map((x) => x.data.date).find(Boolean) || '';
  const titles = [...tb.flatMap((x) => x.data.titles || []), pps?.data.remark].filter(Boolean);
  const cands = subs.flatMap(subCands);
  if (pps?.data.cny != null) cands.push(pps.data.cny);
  const issues = [];
  if (!tb.length) issues.push(['bad', '缺淘寶訂單']);
  if (!pps) issues.push(['bad', '缺 PPS 紀錄']);
  const orows = S.rows.filter((r) => r.orderId === o.id);
  const noRc = orows.filter((r) => !rc.some((x) => receiptRows(x, o, subs).includes(r.id))).length;
  if (orows.length && noRc) issues.push(['warn', orows.length > 1 ? `${noRc} 件貨品未配對收據` : '缺收據']);
  if (hkdPPS != null && hkdTB != null && Math.abs(hkdPPS - hkdTB) > 0.011) issues.push(['warn', `淘寶${subs.length > 1 ? '合計' : ''} HK$${money(hkdTB)} 與 PPS HK$${money(hkdPPS)} 不同`]);
  const busy = [...tb, pps, ...rc].filter(Boolean).some((x) => x.status === 'queued' || x.status === 'ocr');
  return { tb, pps, rc, subs, nos, orderNo, hkd, hkdPPS, hkdTB, date, titles, cands, issues, busy, shop: pps?.data.shop || '' };
}
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
/* 收據對應哪幾行貨品：手動配對優先，否則按訂單自動配對 */
function receiptRows(img, o, subs) {
  const ids = S.rows.filter((r) => r.orderId === o.id);
  if (img.rowIds && img.rowIds.length) return img.rowIds.filter((id) => ids.some((r) => r.id === id));
  const k = receiptSub(subs || tbGroups(o.taobao.map((id) => S.images.get(id)).filter(Boolean)), img);
  return k ? ids.filter((r) => r.subKey === k).map((r) => r.id) : [];
}
function receiptSub(subs, r) {
  if (r.subKey && subs.some((s) => s.key === r.subKey)) return r.subKey;
  const no = r.data.orderNo; if (no && subs.some((s) => s.no === no)) return no;
  const v = r.data.cny;
  if (v != null) { const hits = subs.filter((s) => subCands(s).some((c) => Math.abs(c - v) <= 0.05)); if (hits.length === 1) return hits[0].key; }
  if (subs.length === 1) return subs[0].key;
  return null;
}
/* 一次 PPS 付款可能包含幾張同時結帳的淘寶訂單：用金額組合找出來併在一起 */
function reconcile() {
  for (const o of S.orders) {
    const info = orderInfo(o);
    if (info.hkdPPS == null || info.hkdTB == null) continue;
    const diff = Math.round((info.hkdPPS - info.hkdTB) * 100) / 100;
    if (diff < 0.05) continue;
    const cands = S.orders.filter((x) => x !== o && !x.pps && !x.manual && x.taobao.length && x.taobao.every((id) => !S.images.get(id)?.assignManual))
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
function findOrderByNo(no) { return no ? S.orders.find((o) => { const i = orderInfo(o); return i.nos.includes(no) || i.orderNo === no || i.pps?.data.orderNo === no; }) : null; }
function autoAssign(img) {
  if (img.assignManual && img.orderId) { syncRows(); return; }
  const d = img.data, k = img.kind;
  if (k === 'taobao' || k === 'pps') {
    let o = findOrderByNo(d.orderNo);
    if (!o && d.hkd != null) o = S.orders.find((o) => { const i = orderInfo(o); return k === 'pps' ? (!o.pps && i.hkdTB != null && Math.abs(i.hkdTB - d.hkd) < 0.011) : (!o.taobao.length && i.hkdPPS != null && Math.abs(i.hkdPPS - d.hkd) < 0.011); });
    if (!o && img.orderId) o = S.orders.find((x) => x.id === img.orderId);
    if (!o) o = newOrder();
    attach(img, o, k);
    // 之前未配對的收據可能現在可以配對
    [...S.images.values()].filter((x) => !x.orderId && x.kind === 'receipt' && x.status === 'done' && !x.assignManual).forEach(matchReceipt);
  } else { img.kind = 'receipt'; matchReceipt(img); }
  reconcile(); cleanupOrders(); syncRows();
}
function matchReceipt(img) {
  const d = img.data;
  let o = findOrderByNo(d.orderNo);
  if (!o && d.cny != null) {
    const hits = S.orders.filter((o) => orderInfo(o).cands.some((v) => Math.abs(v - d.cny) <= 0.05));
    if (hits.length === 1) o = hits[0];
  }
  if (o) attach(img, o, 'receipt');
}
function cleanupOrders() {
  S.orders = S.orders.filter((o) => o.manual || o.taobao.length || o.pps || o.receipts.length);
}

/* ================= 表格行 ================= */
function newRow(orderId, name) {
  const d = S.settings.defaults;
  return { id: uid('r'), orderId, name: name || '', edited: false, hkd: null, hkdEdited: false, subKey: null, titles: [], reason: d.reason, consumable: d.consumable, location: d.location, dept: d.dept, subgroup: d.subgroup, category: d.category, grant: d.grant, person: d.person, rdate: d.rdate };
}
/* 把一張淘寶訂單的實付港幣分給各件貨品（按人民幣價錢比例） */
function allocate(total, items) {
  if (items.length <= 1) return [{ v: total, est: false }];
  if (total == null) return items.map(() => ({ v: null, est: false }));
  const w = items.map((it) => (it.price != null ? it.price * (it.qty || 1) : null));
  if (w.some((x) => x == null) || !w.reduce((a, b) => a + b, 0)) return items.map((_, i) => ({ v: i === 0 ? total : 0, est: true }));
  const W = w.reduce((a, b) => a + b, 0); let acc = 0;
  return items.map((_, i) => {
    let v = i === items.length - 1 ? Math.round((total - acc) * 100) / 100 : Math.round(total * w[i] / W * 100) / 100;
    acc += v; return { v, est: true };
  });
}
function rowSpecs(o) {
  const info = orderInfo(o), specs = [];
  if (!info.subs.length) { specs.push({ key: 'pps#0', subKey: null, titles: info.titles, hkd: info.hkd, est: false }); return specs; }
  // 一張淘寶訂單算一件貨品：名稱概括訂單內所有商品，金額用該訂單的實付港幣
  info.subs.forEach((g) => {
    const titles = g.items.length ? g.items.map((it) => it.title) : g.titles;
    specs.push({ key: `${g.key}#0`, subKey: g.key, titles, hkd: g.hkd, est: false });
  });
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
    const specs = rowSpecs(o), keys = new Set(specs.map((s) => s.key));
    S.rows = S.rows.filter((r) => r.orderId !== o.id || !r.auto || keys.has(r.autoKey) || r.edited);
    specs.forEach((sp, si) => {
      if (S.deleted.has(`${o.id}|${sp.key}`)) return;
      let r = S.rows.find((x) => x.orderId === o.id && x.auto && x.autoKey === sp.key);
      if (!r) { r = newRow(o.id, ''); r.auto = true; r.autoKey = sp.key; S.rows.push(r); }
      r.subKey = sp.subKey; r.titles = sp.titles;
      if (!r.edited) r.name = suggestName(sp.titles);
      if (!r.hkdEdited) { r.hkd = sp.hkd; r.est = sp.est; }
      order.set(r.id, oi * 1000 + si);
    });
    // 手動加的行跟在它的上一行後面
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
const rowSub = (r) => { const o = S.orders.find((x) => x.id === r.orderId); return o && r.subKey ? orderInfo(o).subs.find((s) => s.key === r.subKey) : null; };

/* ================= 介面：訂單 ================= */
const KIND_LABEL = { taobao: '淘寶訂單', pps: 'PPS 紀錄', receipt: '收據' };
function stateChip(img) {
  if (img.status === 'queued') return '<span class="chip busy">排隊中</span>';
  if (img.status === 'ocr') return `<span class="chip busy">辨識中 ${Math.round((img.progress || 0) * 100)}%</span>`;
  if (img.status === 'err') return '<span class="chip warn">未能辨識</span>';
  return '';
}
function updateThumbState(img) {
  document.querySelectorAll(`[data-state="${img.id}"]`).forEach((el) => { el.innerHTML = stateChip(img); });
}
function moveOptions(img) {
  const opts = S.orders.map((o, i) => `<option value="${o.id}" ${img.orderId === o.id ? 'selected' : ''}>放入購物 ${i + 1}</option>`).join('');
  return `<select data-move="${img.id}" aria-label="移到其他購物">${img.orderId ? '' : '<option value="" selected>放入購物…</option>'}${opts}<option value="new">放入新的購物</option>${img.orderId ? '<option value="tray">移出</option>' : ''}<option value="del">刪除這張圖</option></select>`;
}
function subOptions(img, info) {
  if (img.kind !== 'receipt' || !img.orderId || info.subs.length < 2) return '';
  const cur = receiptSub(info.subs, img);
  return `<select data-sub="${img.id}" aria-label="對應哪張淘寶訂單"><option value="" ${cur ? '' : 'selected'}>對應訂單…</option>${info.subs.map((g, i) => `<option value="${esc(g.key)}" ${cur === g.key ? 'selected' : ''}>對應訂單 ${String.fromCharCode(65 + i)}</option>`).join('')}</select>`;
}
function thumbHTML(img, info) {
  const k = img.kind || 'receipt';
  return `<div class="thumb"><div class="th"><select data-kind="${img.id}" class="k-${k}" aria-label="圖片類別">
      ${['taobao', 'pps', 'receipt'].map((x) => `<option value="${x}" ${x === k ? 'selected' : ''}>${KIND_LABEL[x]}</option>`).join('')}</select>${img.fromExt ? '<span class="chip ok" title="由擴充功能截取，資料直接讀自淘寶頁面">已讀取</span>' : ''}</div>
    <div class="img"><img alt="${esc(KIND_LABEL[k])}：${esc(img.name)}" src="${thumbURL(img)}"><span class="state" data-state="${img.id}">${stateChip(img)}</span></div>
    <div class="tb"><button class="btn small" type="button" data-act="crop" data-img="${img.id}">裁剪</button>${moveOptions(img)}</div></div>`;
}
function renderOrders() {
  const box = $('#orders');
  if (!S.orders.length) { box.innerHTML = '<div class="empty-state">未有購物紀錄。上載截圖後，每次 PPS 付款會在這裏自動建立一張卡片。</div>'; }
  else box.innerHTML = S.orders.map((o, i) => {
    const info = orderInfo(o);
    const chips = info.busy ? '<span class="chip busy">辨識中</span>' : (info.issues.length ? info.issues.map(([c, t]) => `<span class="chip ${c}">${esc(t)}</span>`).join('') : (info.hkdPPS != null && info.hkdTB != null ? '<span class="chip ok">文件齊全・金額相符</span>' : '<span class="chip ok">文件齊全</span>'));
    const nItems = S.rows.filter((r) => r.orderId === o.id).length, nForms = Math.max(1, Math.ceil(nItems / rowsPerForm()));
    const subsHTML = info.subs.map((g, k) => {
      const letter = info.subs.length > 1 ? `訂單 ${String.fromCharCode(65 + k)}` : '淘寶訂單';
      const items = S.rows.filter((r) => r.orderId === o.id && r.subKey === g.key).length;
      return `<div class="sord"><div class="sord-h"><b>${letter}</b><span class="mono">${esc(g.no || '未讀到編號')}</span><span class="mono">${g.hkd != null ? 'HK$' + money(g.hkd) : ''}</span></div>
        <div class="slots">${g.imgs.map((x) => thumbHTML(x, info)).join('')}</div></div>`;
    }).join('');
    const loose = `<div class="sord rc"><div class="sord-h"><b>收據／發票</b><span>${info.rc.length} 張・在下面「收據配對」對應貨品</span></div>
        <div class="slots">${info.rc.map((x) => thumbHTML(x, info)).join('')}${emptySlot(o.id, info.rc.length ? 'receipt+' : 'receipt')}</div></div>`;
    return `<article class="order" data-order="${o.id}">
      <div class="order-h"><span class="title">購物 ${i + 1}</span><span class="amt">${info.hkd != null ? 'HK$' + money(info.hkd) : 'HK$ —'}</span><span class="grow"></span>${chips}</div>
      <div class="order-meta"><span>日期 <span class="mono">${esc(info.date || '—')}</span></span><span>${info.subs.length} 張淘寶訂單・${nForms} 張申請表</span>${info.shop ? `<span>店舖 ${esc(toHK(info.shop))}</span>` : ''}</div>
      <div class="pps-row"><div class="slots">${info.pps ? thumbHTML(info.pps, info) : emptySlot(o.id, 'pps')}${info.subs.length ? '' : emptySlot(o.id, 'taobao')}</div></div>
      ${subsHTML}${loose}
      <div class="order-foot"><label>PPS 付款 HK$ <input inputmode="decimal" data-hkd="${o.id}" value="${info.hkdPPS != null ? money(info.hkdPPS) : ''}" aria-label="PPS 付款金額"></label>
        <span class="sub-note">${info.subs.length ? `淘寶實付合計 HK$${money(info.hkdTB ?? 0)}` : ''}</span>
        <span style="flex:1"></span><button class="btn small" type="button" data-act="add-file" data-order="${o.id}" data-kind="taobao">再加淘寶訂單</button><button class="btn small ghost danger" type="button" data-act="del-order" data-order="${o.id}">刪除</button></div>
    </article>`;
  }).join('');
  const tray = [...S.images.values()].filter((x) => !x.orderId);
  $('#tray').hidden = !tray.length;
  $('#trayList').innerHTML = tray.map((x) => thumbHTML(x, null)).join('');
}
function emptySlot(orderId, kind, subKey) {
  const k = kind.replace('+', '');
  const label = kind === 'receipt+' ? '再加一張收據' : `加入${KIND_LABEL[k]}`;
  return `<div class="slot-empty"><span class="tag k-${k}">${KIND_LABEL[k]}</span><button class="btn small" type="button" data-act="add-file" data-order="${orderId}" data-kind="${k}" ${subKey ? `data-sub="${esc(subKey)}"` : ''}>${label}</button></div>`;
}

/* ================= 介面：表格行 ================= */
function buildDatalists() {
  let host = $('#datalists'); if (!host) { host = document.createElement('div'); host.id = 'datalists'; host.hidden = true; document.body.appendChild(host); }
  host.innerHTML = Object.entries(S.settings.options).map(([k, list]) => `<datalist id="dl-${k}">${list.map((v) => `<option value="${esc(v)}"></option>`).join('')}</datalist>`).join('');
}
function fieldInput(f, value, attrs) {
  return `<label class="field"><span>${f.label}</span><input ${attrs} value="${esc(value)}" ${f.opt ? `list="dl-${f.opt}"` : ''} autocomplete="off" placeholder="${f.k === 'rdate' ? '可留空' : '選擇或輸入'}"></label>`;
}
function renderShared() {
  const d = S.settings.defaults;
  $('#sharedFields').innerHTML = FIELDS.map((f) => fieldInput(f, d[f.k], `data-shared="${f.k}"`)).join('') +
    `<label class="check"><input type="checkbox" data-shared="consumable" ${d.consumable ? 'checked' : ''}> 消耗品</label>`;
}
function rowTitles(r) { return r.titles || []; }
function rowSummary(r) {
  const v = FIELDS.map((f) => r[f.k]).filter(Boolean);
  if (r.consumable) v.push('消耗品');
  return v.length ? v.join('・') : '未填';
}
function rowHTML(r) {
  const oi = S.orders.findIndex((o) => o.id === r.orderId), o = S.orders[oi], info = o ? orderInfo(o) : null;
  const titles = rowTitles(r), busy = info && info.busy && !r.name;
  const si = info ? info.subs.findIndex((s) => s.key === r.subKey) : -1;
  const ref = `購物 ${oi + 1}${info && info.subs.length > 1 && si >= 0 ? `・訂單 ${String.fromCharCode(65 + si)}` : ''}`;
  return `<div class="row" data-row="${r.id}">
    <div class="row-top"><div class="ordref">${ref}</div>
      <label class="field"><span>貨品名稱</span><input data-f="name" value="${esc(r.name)}" placeholder="${busy ? '辨識中…' : '輸入貨品名稱'}" autocomplete="off"></label>
      <label class="field amt-f"><span>金額 HK$${r.est && !r.hkdEdited ? '（按比例估算）' : ''}</span><input data-f="hkd" inputmode="decimal" value="${r.hkd != null ? money(r.hkd) : ''}" autocomplete="off"></label>
      <div class="row-btns"><button class="btn small" type="button" data-act="add-row" title="在下面加一行">＋一行</button><button class="btn small ghost danger" type="button" data-act="del-row" aria-label="刪除這行">刪除</button></div></div>
    ${titles.length ? `<div class="row-src">原標題：${titles.slice(0, 4).map((t, i) => `<button type="button" data-act="use-title" data-t="${i}" title="用這個標題（精簡後）">${esc(toHK(t).slice(0, 40))}${t.length > 40 ? '…' : ''}</button>`).join('')} ${r.edited ? '<button type="button" data-act="remember">記住這個名稱</button>' : ''}</div>` : ''}
    <div class="rule-host"></div>
    <details class="more" ${S.openRows.has(r.id) ? 'open' : ''}><summary>其他欄位：<span data-sum>${esc(rowSummary(r))}</span></summary>
    <div class="fgrid">${FIELDS.map((f) => fieldInput(f, r[f.k], `data-f="${f.k}"`)).join('')}
      <label class="check"><input type="checkbox" data-f="consumable" ${r.consumable ? 'checked' : ''}> 消耗品</label></div></details>
  </div>`;
}
function renderRows() {
  const box = $('#rows');
  if (!S.rows.length) { box.innerHTML = '<div class="empty-state">建立購物紀錄後，貨品會列在這裏。</div>'; return; }
  const forms = buildForms();
  box.innerHTML = forms.map((f, i) => `<div class="form-group"><div class="form-h"><b>申請表 ${i + 1}</b><span>${f.rows.length} 行</span><span class="mono" data-ftotal="${i}">${f.amountText}</span></div>${f.rows.map(rowHTML).join('')}</div>`).join('');
}
function updateTotals() {
  buildForms().forEach((f, i) => { const el = document.querySelector(`[data-ftotal="${i}"]`); if (el) el.textContent = f.amountText; });
}
function renderGlobal() {
  const s = S.settings;
  $('#g_payee').value = s.payee; $('#g_applicant').value = s.applicant; $('#g_date').value = S.appDate; $('#g_group').value = s.group;
  $('#pv_layout').value = s.layout || 'sets'; $('#pv_att').checked = s.attach; $('#pv_cap').checked = s.caption;
}
function renderAll() { renderOrders(); renderMatch(); renderRows(); schedulePreview(); }

/* ================= 收據配對 ================= */
function allReceipts() { return [...S.images.values()].filter((x) => x.kind === 'receipt'); }
function rcLabel(img) { return 'R' + (allReceipts().indexOf(img) + 1); }
function rcWhere(img) {
  const o = S.orders.find((x) => x.id === img.orderId);
  if (!o) return { text: '未放入任何購物', cls: 'bad', rows: [] };
  const rows = receiptRows(img, o);
  const oi = S.orders.indexOf(o) + 1;
  if (!rows.length) return { text: `購物 ${oi}・未對應貨品`, cls: 'warn', rows };
  const names = rows.map((id) => S.rows.find((r) => r.id === id)?.name || '').filter(Boolean);
  return { text: `購物 ${oi}・${names.length > 2 ? names.slice(0, 2).join('、') + ` 等 ${names.length} 件` : names.join('、')}${img.rowIds?.length ? '' : '（自動）'}`, cls: 'ok', rows };
}
function renderMatch() {
  const box = $('#match'); if (!box) return;
  const rcs = allReceipts();
  $('#matchWrap').hidden = !rcs.length && !S.rows.length;
  if (S.selRc && !S.images.has(S.selRc)) S.selRc = null;
  const sel = S.selRc ? S.images.get(S.selRc) : null;
  const pool = rcs.map((img) => { const w = rcWhere(img); return `<button type="button" class="rc-card ${S.selRc === img.id ? 'sel' : ''}" draggable="true" data-rc="${img.id}" aria-pressed="${S.selRc === img.id}">
      <img src="${thumbURL(img)}" alt=""><span class="rc-l">${rcLabel(img)}</span><span class="rc-w ${w.cls}">${esc(w.text)}</span></button>`; }).join('') || '<div class="empty-state">未有收據。可以在上面的購物卡按「加入收據」。</div>';
  const items = S.orders.map((o, oi) => {
    const subs = orderInfo(o).subs, rows = S.rows.filter((r) => r.orderId === o.id); if (!rows.length) return '';
    const rcs2 = o.receipts.map((id) => S.images.get(id)).filter(Boolean);
    return `<div class="m-ord"><div class="m-ord-h">購物 ${oi + 1}</div>${rows.map((r) => {
      const mine = rcs2.filter((x) => receiptRows(x, o, subs).includes(r.id));
      const si = subs.findIndex((s) => s.key === r.subKey);
      const add = sel && !mine.includes(sel) ? `<button type="button" class="btn small primary" data-addrc="${r.id}">＋ 配對 ${rcLabel(sel)}</button>` : '';
      return `<div class="m-row ${mine.length ? '' : 'none'}" data-mrow="${r.id}"><div class="m-name"><b>${esc(r.name || '（未命名）')}</b><span>${subs.length > 1 && si >= 0 ? `訂單 ${String.fromCharCode(65 + si)}・` : ''}${r.hkd != null ? 'HK$' + money(r.hkd) : ''}</span></div>
        <div class="m-rcs">${mine.map((x) => `<span class="m-rc"><img src="${thumbURL(x)}" alt="${rcLabel(x)}" data-view="${x.id}"><b>${rcLabel(x)}</b><button type="button" data-unrc="${x.id}" data-row="${r.id}" aria-label="取消配對">×</button></span>`).join('') || '<span class="m-empty">未有收據</span>'}${add}</div></div>`;
    }).join('')}</div>`;
  }).join('');
  box.innerHTML = `<div class="m-pool"><div class="m-h"><b>全部收據</b><span>${sel ? `已揀 ${rcLabel(sel)}：按右邊貨品的「＋ 配對」，或者把收據拖到貨品上。` : '揀一張收據，再揀它對應的貨品。一張收據可以配對多件貨品。'}</span>
      ${sel ? `<span class="m-acts"><button type="button" class="btn small" data-view="${sel.id}">放大查看</button><button type="button" class="btn small" data-autorc="${sel.id}">改回自動</button><button type="button" class="btn small" data-clearrc="${sel.id}">清除配對</button></span>` : ''}</div>
      <div class="rc-grid">${pool}</div></div>
    <div class="m-items">${items || '<div class="empty-state">未有貨品。</div>'}</div>`;
}
function assignRc(img, rowId) {
  const r = S.rows.find((x) => x.id === rowId); if (!img || !r) return;
  const o = S.orders.find((x) => x.id === r.orderId);
  if (img.orderId !== o.id) { const cur = img.orderId ? receiptRows(img, S.orders.find((x) => x.id === img.orderId)) : []; attach(img, o, 'receipt'); img.assignManual = true; img.rowIds = []; void cur; }
  if (!img.rowIds || !img.rowIds.length) img.rowIds = receiptRows(img, o).filter((id) => S.rows.some((x) => x.id === id));
  if (!img.rowIds.includes(rowId)) img.rowIds.push(rowId);
  img.rowIds = img.rowIds.filter((id) => S.rows.some((x) => x.id === id && x.orderId === o.id));
}
function unassignRc(img, rowId) {
  const o = S.orders.find((x) => x.id === img.orderId); if (!o) return;
  const cur = receiptRows(img, o);
  img.rowIds = cur.filter((id) => id !== rowId);
  if (!img.rowIds.length) img.rowIds = ['none'];
}

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
  const img = crop.img; img.crop = { ...crop.rect }; img._crop = null; img._thumb = null;
  $('#cropDlg').close(); renderOrders(); schedulePreview();
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
function buildForms() {
  const s = S.settings, forms = [], per = rowsPerForm();
  const mk = (rows) => {
    const vals = rows.map((r) => r.hkd).filter((v) => v != null && !isNaN(v));
    const amount = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100 : null;
    return { rows, amount, amountText: amount == null ? '$' : '$' + money(amount), orderIds: [...new Set(rows.map((r) => r.orderId))] };
  };
  if (!S.rows.length) return [mk([])];
  if (s.group === 'order') {
    S.orders.forEach((o) => { const rs = S.rows.filter((r) => r.orderId === o.id); for (let i = 0; i < rs.length; i += per) forms.push(mk(rs.slice(i, i + per))); });
  } else for (let i = 0; i < S.rows.length; i += per) forms.push(mk(S.rows.slice(i, i + per)));
  forms.forEach((f, i) => { f.no = i + 1; });
  return forms;
}
/* 一張申請表的附件：表內貨品的淘寶訂單和收據，PPS 紀錄放第一頁 */
function chunkImgs(imgs, fixed) {
  if (imgs.length <= 6) return [imgs];
  const out = [imgs.slice(0, fixed + 3)]; for (let i = fixed + 3; i < imgs.length; i += 4) out.push(imgs.slice(i, i + 4)); return out;
}
function formAttachments(f, forms) {
  const pages = [];
  f.orderIds.forEach((oid) => {
    const o = S.orders.find((x) => x.id === oid); if (!o) return;
    const info = orderInfo(o);
    const fRows = f.rows.filter((r) => r.orderId === oid), rowSet = new Set(fRows.map((r) => r.id));
    const sharedBy = forms.filter((x) => x.orderIds.includes(oid)).map((x) => x.no);
    const firstForm = sharedBy[0] === f.no;
    const rcs = info.rc.map((img) => ({ img, rows: receiptRows(img, o, info.subs) }));
    const groups = [];
    [...new Set(fRows.map((r) => r.subKey))].forEach((k) => { const g = info.subs.find((s) => s.key === k); if (g) groups.push({ g, imgs: [...g.imgs], fixed: g.imgs.length }); });
    if (!groups.length) groups.push({ g: null, imgs: [...info.tb], fixed: info.tb.length });
    rcs.forEach((x) => {
      const hit = x.rows.find((id) => rowSet.has(id));
      if (hit) { const r = S.rows.find((rr) => rr.id === hit); (groups.find((gr) => gr.g && gr.g.key === r.subKey) || groups[groups.length - 1]).imgs.push(x.img); }
      else if (!x.rows.length && firstForm) groups[groups.length - 1].imgs.push(x.img);
    });
    groups.forEach((gr, k) => {
      const imgs = [...gr.imgs];
      if (k === 0 && info.pps) imgs.push(info.pps);
      chunkImgs(imgs, gr.fixed).forEach((part) => pages.push({ type: 'att', order: o, info, sub: gr.g, imgs: part, formNo: f.no, sharedBy }));
    });
  });
  pages.forEach((p, i) => { p.part = i + 1; p.parts = pages.length; });
  return pages;
}
function buildPages() {
  const s = S.settings, pages = [], forms = buildForms();
  if (s.layout === 'compact') {
    forms.forEach((f) => pages.push({ type: 'forms', forms: [f] }));
    if (s.attach) forms.forEach((f) => pages.push(...formAttachments(f, forms)));
  } else {
    forms.forEach((f) => { pages.push({ type: 'forms', forms: [f] }); if (s.attach) pages.push(...formAttachments(f, forms)); });
  }
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
    const parts = [`申請表 ${page.formNo} 附件 ${page.part}/${page.parts}`, no ? `淘寶訂單編號 ${no}` : '', page.sub && page.sub.hkd != null ? `淘寶實付 HK$${money(page.sub.hkd)}` : '',
      info.hkdPPS != null ? `PPS 付款 HK$${money(info.hkdPPS)}${page.sharedBy.length > 1 ? `（申請表 ${page.sharedBy.join('、')} 共用）` : ''}` : '', info.date ? `日期 ${info.date}` : ''].filter(Boolean);
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
  if (!imgs.length) pen.text('（未有圖片）', A4.w / 2, 60, 4, { align: 'center', family: SANS, color: '#888' });
}
function renderPage(page, s) {
  const c = document.createElement('canvas'); c.width = Math.round(A4.w * s); c.height = Math.round(A4.h * s);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  const pen = makePen(ctx, s);
  const g = { payee: S.settings.payee, applicant: S.settings.applicant, date: S.appDate };
  if (page.type === 'forms') {
    const k = FORM_K.sets, w = CROP.w * PT * k, X = (A4.w - w) / 2;
    page.forms.forEach((f) => { if (!drawOfficial(pen, X, 10, k, f, g)) drawForm(pen, 10, 10, f, g); });
  } else drawAttachment(pen, page);
  return c;
}
async function ensureFonts(pages) {
  if (!document.fonts?.load) return;
  const txt = new Set('十八鄉事委員會公益社中學申請支票支付購物款項表格註商戶名稱收人總額姓簽署日期貨品原因消耗貯放位置組別內的小如適用類那一筆津貼負責例剪刀佈置壁報把此與現沽單發正本釘在起交財務部書記購買教材及參考資料必須符合課程發展議於各學習階段所訂定宗旨目標容並切生度和需要以香港法例已輸入資產管理系統是否者：，「」《》()$0123456789'.split(''));
  S.rows.forEach((r) => FIELDS.forEach((f) => [...String(r[f.k] || '')].forEach((ch) => txt.add(ch))) || [...r.name].forEach((ch) => txt.add(ch)));
  [S.settings.payee, S.settings.applicant, S.appDate].forEach((v) => [...(v || '')].forEach((ch) => txt.add(ch)));
  const str = [...txt].join('');
  try { await withTimeout(Promise.all([document.fonts.load('20px "LXGW WenKai TC"', str), document.fonts.load('700 20px "LXGW WenKai TC"', str), document.fonts.load('20px "Noto Sans TC"', '附件淘寶訂單編號交易日期付款')]), 6000, 'font'); } catch { }
}
let pvToken = 0;
const schedulePreview = debounce(renderPreview, 250);
async function renderPreview() {
  const tok = ++pvToken;
  const pages = buildPages();
  const dpr0 = Math.min(2, window.devicePixelRatio || 1);
  await Promise.all([ensureFonts(pages), ensureTemplate(2.4 * dpr0)]);
  if (tok !== pvToken) return;
  const box = $('#pages'); box.innerHTML = '';
  const dpr = Math.min(2, window.devicePixelRatio || 1), s = 2.4 * dpr;
  const nf = buildForms().filter((f) => f.rows.length).length, na = pages.filter((p) => p.type === 'att').length;
  $('#pvSummary').textContent = `共 ${pages.length} 頁 A4：申請表 ${nf} 張${na ? `、附件 ${na} 頁` : ''}。按頁面可以放大。`;
  pages.forEach((p, i) => {
    const wrap = document.createElement('div'); wrap.className = 'page';
    const c = renderPage(p, s); c.setAttribute('role', 'img'); c.setAttribute('aria-label', `第 ${i + 1} 頁`); c.tabIndex = 0;
    c.addEventListener('click', () => openPage(i)); c.addEventListener('keydown', (e) => { if (e.key === 'Enter') openPage(i); });
    const lab = document.createElement('span'); lab.textContent = `第 ${i + 1} 頁・${p.type === 'forms' ? `申請表 ${p.forms.map((f) => f.no).join('、')}` : `申請表 ${p.formNo} 附件 ${p.part}/${p.parts}`}`;
    wrap.append(c, lab); box.appendChild(wrap);
  });
}
async function openPage(i) {
  const pages = buildPages(); await ensureFonts(pages); await ensureTemplate(6);
  const c = renderPage(pages[i], 6); $('#pageBig').innerHTML = ''; $('#pageBig').appendChild(c);
  $('#pageTitle').textContent = `第 ${i + 1} 頁`; $('#pageDlg').showModal();
}

/* ================= PDF ================= */
async function downloadPDF() {
  const btn = $('#btnPDF'); btn.disabled = true; const old = btn.textContent; btn.textContent = '製作中…';
  try {
    // 記住表格上用過的選項
    S.rows.forEach((r) => FIELDS.forEach((f) => f.opt && rememberOption(f.opt, r[f.k])));
    const dl = LOCAL ? null : await claudeUse('downloads');
    await withTimeout(loadScript(CDN.jspdf), 20000, 'PDF 程式庫載入逾時');
    const { jsPDF } = window.jspdf;
    const pages = buildPages(); await ensureFonts(pages); await ensureTemplate(7.874);
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    for (let i = 0; i < pages.length; i++) {
      btn.textContent = `製作中 ${i + 1}/${pages.length}…`;
      const c = renderPage(pages[i], 7.874); // 200 dpi
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (i > 0) doc.addPage('a4', 'p');
      doc.addImage(bytes, 'JPEG', 0, 0, A4.w, A4.h, undefined, 'FAST');
      await new Promise((r) => setTimeout(r, 0));
    }
    const d = new Date(), stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const fname = `購物記錄表_${stamp}.pdf`, blob = doc.output('blob');
    if (dl) { const res = await dl.save({ filename: fname, data: blob }); if (res?.status === 'saved') toast('已下載 PDF'); }
    else saveBlob(blob, fname);
  } catch (e) {
    const code = e?.code;
    if (code === 'declined') toast('已取消下載');
    else if (code === 'rate_limited') toast('請稍等一會再試');
    else { console.error(e); toast('未能製作 PDF：' + (e.message || code || e), 5000); }
  } finally { btn.disabled = false; btn.textContent = old; }
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000); toast('已下載 ' + name);
}
async function printDirect() {
  const btn = $('#btnPrint'); btn.disabled = true; const old = btn.textContent; btn.textContent = '準備中…';
  try {
    const pages = buildPages(); await ensureFonts(pages); await ensureTemplate(7.874);
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
function exportSettings() {
  saveBlob(new Blob([JSON.stringify(S.settings, null, 2)], { type: 'application/json' }), '購物記錄表_設定.json');
}
async function importSettings(file) {
  try { const obj = JSON.parse(await file.text()); if (!obj || !obj.options) throw new Error('格式不對'); mergeSettings(obj); saveSettings(); afterSettingsChange(); $('#setDlg').close(); toast('已匯入設定'); }
  catch (e) { toast('未能匯入：' + (e.message || e), 4000); }
}

/* ================= 示範資料 ================= */
function demoCanvas(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#222'; g.textBaseline = 'alphabetic'; draw(g);
  g.save(); g.translate(w / 2, h / 2); g.rotate(-0.35); g.font = `700 ${Math.round(w / 7)}px ${SANS}`; g.fillStyle = 'rgba(36,67,196,.12)'; g.textAlign = 'center'; g.fillText('示範', 0, 0); g.restore();
  return c;
}
function buildDemo() {
  const f = (g, size, wt = 400) => { g.font = `${wt} ${size}px ${SANS}`; };
  const tb = demoCanvas(1500, 820, (g) => {
    g.fillStyle = '#ff5000'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(130 + i * 280, 60, 16, 0, 7); g.fill(); if (i < 3) g.fillRect(160 + i * 280, 57, 220, 6); }
    g.fillStyle = '#333'; f(g, 20); ['拍下宝贝', '买家付款', '卖家发货', '确认收货'].forEach((t, i) => g.fillText(t, 92 + i * 280, 105));
    f(g, 34, 700); g.fillText('交易成功', 50, 175);
    f(g, 20); g.fillStyle = '#555'; g.fillText('香港特别行政区 新界 元朗区（示范地址）', 50, 225);
    g.fillStyle = '#ff5000'; f(g, 22); g.fillText('包裹1(共1件)', 50, 300);
    g.fillStyle = '#e8e8e8'; g.fillRect(50, 340, 1000, 2);
    g.fillStyle = '#222'; f(g, 22, 700); g.fillText('天猫  示范电子旗舰店', 50, 385);
    g.fillStyle = '#d9e2f2'; g.fillRect(50, 410, 120, 120);
    g.fillStyle = '#222'; f(g, 22); g.fillText('杜邦线 40P 公对母 20cm 面包板跳线 彩色排线', 190, 440);
    g.fillStyle = '#888'; f(g, 19); g.fillText('20cm 公对母 40根', 190, 478);
    g.fillStyle = '#222'; f(g, 22, 700); g.fillText('¥9.80', 960, 440); f(g, 19); g.fillStyle = '#888'; g.fillText('x2', 990, 476);
    g.strokeStyle = '#e5e5e5'; g.lineWidth = 2; g.strokeRect(1100, 30, 370, 760);
    g.fillStyle = '#222'; f(g, 24, 700); g.fillText('付款详情', 1125, 80);
    const kv = [['商品总价', '¥19.60'], ['运费(快递)', '¥0.00'], ['海外运费', '¥0.85'], ['支付手续费', 'HKD 0.35'], ['实付款', 'HKD23.50']];
    kv.forEach(([k, v], i) => { f(g, 20); g.fillStyle = '#666'; g.fillText(k, 1125, 130 + i * 44); g.fillStyle = '#222'; g.textAlign = 'right'; f(g, i === 4 ? 26 : 20, i === 4 ? 700 : 400); g.fillText(v, 1450, 130 + i * 44); g.textAlign = 'left'; });
    f(g, 24, 700); g.fillText('订单信息', 1125, 400);
    [['订单编号', '3300000000000000001'], ['创建时间', '2026-10-08 20:15:02'], ['付款时间', '2026-10-08 20:15:20']].forEach(([k, v], i) => { f(g, 19); g.fillStyle = '#666'; g.fillText(k, 1125, 450 + i * 42); g.fillStyle = '#222'; g.textAlign = 'right'; g.fillText(v, 1450, 450 + i * 42); g.textAlign = 'left'; });
  });
  const pps = demoCanvas(900, 1180, (g) => {
    g.fillStyle = '#ff7a00'; g.beginPath(); g.arc(80, 80, 34, 0, 7); g.fill(); g.fillStyle = '#fff'; f(g, 34, 700); g.fillText('淘', 63, 92);
    g.fillStyle = '#222'; f(g, 30); g.fillText('淘寶交易', 140, 92);
    g.textAlign = 'right'; f(g, 30); g.fillText('-HKD', 610, 250); f(g, 96); g.fillText('23.50', 850, 250);
    const kv = [['付款方式', 'PPS **57'], ['訂單金額', 'HKD 23.15(CNY 20.45)'], ['匯率', '1CNY=1.13200000HKD'], ['手續費', 'HKD 0.35'], ['訂單詳情', '示範電子旗艦店 與其他（如適用）'], ['交易成功時間', '08/10/26 20:15:20'], ['商戶訂單號', 'T200P3300000000000000001'], ['備註', '杜邦线 40P 公对母 20cm 面包板跳线']];
    kv.forEach(([k, v], i) => { g.textAlign = 'left'; g.fillStyle = '#222'; f(g, 28); g.fillText(k, 40, 380 + i * 92); g.textAlign = 'right'; g.fillStyle = '#777'; f(g, 26); g.fillText(v, 860, 380 + i * 92); });
    g.textAlign = 'left';
  });
  const rc = demoCanvas(1200, 640, (g) => {
    g.strokeStyle = '#b4442f'; g.lineWidth = 3; g.strokeRect(40, 120, 1120, 460);
    g.fillStyle = '#b4442f'; f(g, 44, 700); g.textAlign = 'center'; g.fillText('电子发票（普通发票）', 600, 80); g.textAlign = 'left';
    f(g, 22); g.fillText('开票日期：2026年10月10日', 860, 112);
    g.fillStyle = '#333'; f(g, 22); g.fillText('购买方名称：（示范）', 70, 170); g.fillText('销售方名称：示范电子有限公司', 640, 170);
    g.fillText('项目名称　　　　　　　数量　　单价　　　金额', 70, 260); g.fillText('*电子元件*杜邦线　　　　2　　 9.80　　　19.60', 70, 305);
    g.fillText('价税合计（小写）¥19.60', 760, 545);
  });
  const mk = (name, c, kind, data) => { const img = newImage(name, c, null); img.kind = kind; img.kindManual = true; img.status = 'done'; img.data = data; img.crop = trimBorders(c); return img; };
  const o = newOrder(); o.demo = true;
  attach(mk('示範淘寶訂單.png', tb, 'taobao', { kind: 'taobao', orderNo: '3300000000000000001', hkd: 23.5, goodsCNY: 19.6, discountCNY: 0, itemPrices: [9.8], date: '2026-10-08', titles: ['杜邦线 40P 公对母 20cm 面包板跳线 彩色排线'] }), o, 'taobao');
  attach(mk('示範PPS.png', pps, 'pps', { kind: 'pps', orderNo: '3300000000000000001', hkd: 23.5, cny: 20.45, date: '2026-10-08', shop: '示範電子旗艦店', remark: '杜邦线 40P 公对母 20cm 面包板跳线' }), o, 'pps');
  attach(mk('示範發票.png', rc, 'receipt', { kind: 'receipt', cny: 19.6, isInvoice: true }), o, 'receipt');
  S.demo = true; $('#demoNote').hidden = false;
  syncRows();
}
function clearDemo() {
  S.orders.filter((o) => o.demo).forEach((o) => { [...o.taobao, o.pps, ...o.receipts].filter(Boolean).forEach((id) => S.images.delete(id)); });
  S.orders = S.orders.filter((o) => !o.demo); S.demo = false; $('#demoNote').hidden = true; syncRows();
}

/* ================= 設定對話框 ================= */
function openSettings() {
  $('#optEditors').innerHTML = Object.keys(OPT_LABELS).map((k) => `<label class="field"><span>${OPT_LABELS[k]}</span><textarea data-opt="${k}" spellcheck="false">${esc((S.settings.options[k] || []).join('\n'))}</textarea></label>`).join('');
  $('#rulesText').value = S.settings.rulesText; $('#stopText').value = S.settings.stopText;
  $('#resetConfirm').hidden = true;
  $('#setDlg').showModal();
}
function saveSettingsDlg() {
  document.querySelectorAll('[data-opt]').forEach((t) => { S.settings.options[t.dataset.opt] = t.value.split('\n').map((x) => x.trim()).filter(Boolean); });
  S.settings.rulesText = $('#rulesText').value; S.settings.stopText = $('#stopText').value;
  saveSettings(); afterSettingsChange(); $('#setDlg').close(); toast('已儲存設定');
}
function afterSettingsChange() { buildDatalists(); renderGlobal(); renderShared(); syncRows(); renderAll(); }

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
  window.addEventListener('dragover', (e) => e.preventDefault()); window.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer?.files?.length && !drop.contains(e.target)) addFiles(e.dataTransfer.files); });
  document.addEventListener('paste', (e) => {
    if (e.target.closest('input,textarea')) return;
    const files = [...(e.clipboardData?.files || [])]; if (files.length) { e.preventDefault(); addFiles(files); toast('已貼上圖片'); }
  });
  $('#btnClearDemo').addEventListener('click', () => { clearDemo(); renderAll(); });
  $('#ocrNote').addEventListener('click', (e) => {
    if (e.target.id !== 'btnRetryOCR') return;
    S.ocr.failed = null; $('#ocrNote').hidden = true;
    [...S.images.values()].filter((i) => i.status === 'err').forEach(enqueueOCR); if (!S.ocr.queue.length) ensureWorker().catch(() => {});
  });
  $('#btnAddOrder').addEventListener('click', () => { if (S.demo) clearDemo(); newOrder(true); syncRows(); renderAll(); });

  const handleOrdersClick = (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'crop') openCrop(S.images.get(b.dataset.img));
    if (act === 'add-file') { one._target = { orderId: b.dataset.order, kind: b.dataset.kind, subKey: b.dataset.sub || null }; one.click(); }
    if (act === 'del-order') {
      const o = S.orders.find((x) => x.id === b.dataset.order); if (!o) return;
      [...o.taobao, o.pps, ...o.receipts].filter(Boolean).forEach((id) => { const im = S.images.get(id); if (im) { im.orderId = null; im.assignManual = true; } });
      S.orders = S.orders.filter((x) => x !== o); syncRows(); renderAll(); toast('已刪除訂單，圖片移到「未配對」');
    }
  };
  const handleOrdersChange = (e) => {
    const t = e.target;
    if (t.dataset.move) {
      const img = S.images.get(t.dataset.move), v = t.value; if (!img || !v) return;
      if (v === 'del') { detach(img); S.images.delete(img.id); S.ocr.queue = S.ocr.queue.filter((q) => q !== img.id); }
      else if (v === 'tray') { detach(img); img.assignManual = true; }
      else { const o = v === 'new' ? newOrder(true) : S.orders.find((x) => x.id === v); if (o) { img.assignManual = true; img.subKey = null; img.rowIds = []; attach(img, o, img.kind || 'receipt'); } }
      cleanupOrders(); syncRows(); renderAll();
    }
    if (t.dataset.sub) {
      const img = S.images.get(t.dataset.sub); if (!img) return;
      img.subKey = t.value || null; syncRows(); renderAll(); return;
    }
    if (t.dataset.kind) {
      const img = S.images.get(t.dataset.kind); if (!img) return;
      img.kindManual = true; const o = S.orders.find((x) => x.id === img.orderId);
      if (o) attach(img, o, t.value); else img.kind = t.value;
      syncRows(); renderAll();
    }
    if (t.dataset.hkd) {
      const o = S.orders.find((x) => x.id === t.dataset.hkd); if (!o) return;
      const v = parseFloat(t.value.replace(/[^\d.]/g, '')); o.hkdOverride = isNaN(v) ? null : Math.round(v * 100) / 100;
      renderAll();
    }
  };
  ['#orders', '#trayList'].forEach((sel) => { $(sel).addEventListener('click', handleOrdersClick); $(sel).addEventListener('change', handleOrdersChange); });

  // 收據配對
  const mb = $('#match');
  mb.addEventListener('click', (e) => {
    const t = e.target.closest('[data-rc],[data-addrc],[data-unrc],[data-view],[data-autorc],[data-clearrc]'); if (!t) return;
    if (t.dataset.view) { openCrop(S.images.get(t.dataset.view)); return; }
    if (t.dataset.rc) { S.selRc = S.selRc === t.dataset.rc ? null : t.dataset.rc; renderMatch(); return; }
    if (t.dataset.addrc) { assignRc(S.images.get(S.selRc), t.dataset.addrc); }
    if (t.dataset.unrc) { unassignRc(S.images.get(t.dataset.unrc), t.dataset.row); }
    if (t.dataset.autorc) { const img = S.images.get(t.dataset.autorc); img.rowIds = []; }
    if (t.dataset.clearrc) { const img = S.images.get(t.dataset.clearrc); img.rowIds = ['none']; }
    renderOrders(); renderMatch(); schedulePreview();
  });
  mb.addEventListener('dragstart', (e) => { const c = e.target.closest('[data-rc]'); if (c) { e.dataTransfer.setData('text/plain', c.dataset.rc); e.dataTransfer.effectAllowed = 'link'; } });
  mb.addEventListener('dragover', (e) => { const r = e.target.closest('[data-mrow]'); if (r) { e.preventDefault(); r.classList.add('over'); } });
  mb.addEventListener('dragleave', (e) => { const r = e.target.closest('[data-mrow]'); if (r) r.classList.remove('over'); });
  mb.addEventListener('drop', (e) => {
    const r = e.target.closest('[data-mrow]'); if (!r) return; e.preventDefault(); r.classList.remove('over');
    const img = S.images.get(e.dataTransfer.getData('text/plain')); if (!img) return;
    assignRc(img, r.dataset.mrow); renderOrders(); renderMatch(); schedulePreview();
  });

  // 表格行
  const rowsBox = $('#rows');
  rowsBox.addEventListener('input', (e) => {
    const t = e.target, rowEl = t.closest('[data-row]'); if (!rowEl || !t.dataset.f) return;
    const r = S.rows.find((x) => x.id === rowEl.dataset.row); if (!r) return;
    if (t.type === 'checkbox') r[t.dataset.f] = t.checked;
    else if (t.dataset.f === 'hkd') { const v = parseFloat(t.value.replace(/[^\d.]/g, '')); r.hkd = isNaN(v) ? null : Math.round(v * 100) / 100; r.hkdEdited = true; updateTotals(); }
    else r[t.dataset.f] = t.value;
    if (t.dataset.f === 'name') { r.edited = true; } else { const sm = rowEl.querySelector('[data-sum]'); if (sm) sm.textContent = rowSummary(r); }
    schedulePreview();
  });
  rowsBox.addEventListener('focusout', (e) => { if (e.target.dataset?.f === 'name' || e.target.dataset?.f === 'hkd') renderMatch(); });
  rowsBox.addEventListener('change', (e) => {
    const t = e.target, f = FIELDS.find((x) => x.k === t.dataset.f);
    if (f?.opt) rememberOption(f.opt, t.value);
    if (t.dataset.f === 'name') renderRows();
  });
  rowsBox.addEventListener('toggle', (e) => { const rowEl = e.target.closest?.('[data-row]'); if (!rowEl) return; if (e.target.open) S.openRows.add(rowEl.dataset.row); else S.openRows.delete(rowEl.dataset.row); }, true);
  rowsBox.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const rowEl = b.closest('[data-row]'), r = S.rows.find((x) => x.id === rowEl?.dataset.row); if (!r) return;
    const act = b.dataset.act;
    if (act === 'add-row') { const nr = newRow(r.orderId, ''); nr.subKey = r.subKey; nr.after = r.id; nr.hkdEdited = true; nr.edited = true; const i = S.rows.indexOf(r); S.rows.splice(i + 1, 0, nr); renderRows(); schedulePreview(); rowsBox.querySelector(`[data-row="${nr.id}"] [data-f="name"]`)?.focus(); }
    if (act === 'del-row') { allReceipts().forEach((x) => { if (x.rowIds) x.rowIds = x.rowIds.filter((id) => id !== r.id); }); if (r.auto) { r.hidden = true; } S.rows = S.rows.filter((x) => x !== r); S.deleted.add(r.autoKey ? `${r.orderId}|${r.autoKey}` : r.id); renderRows(); schedulePreview(); }
    if (act === 'use-title') { const o = S.orders.find((x) => x.id === r.orderId), t = rowTitles(r)[+b.dataset.t]; r.name = shorten(t); r.edited = true; renderRows(); schedulePreview(); }
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
  });
  // 共用欄
  const shared = $('#sharedFields');
  shared.addEventListener('input', (e) => { const t = e.target; if (!t.dataset.shared) return; S.settings.defaults[t.dataset.shared] = t.type === 'checkbox' ? t.checked : t.value; saveSettings(); });
  shared.addEventListener('change', (e) => { const f = FIELDS.find((x) => x.k === e.target.dataset.shared); if (f?.opt) rememberOption(f.opt, e.target.value); });
  $('#btnApplyAll').addEventListener('click', () => {
    const d = S.settings.defaults;
    S.rows.forEach((r) => { FIELDS.forEach((f) => { if (d[f.k]) r[f.k] = d[f.k]; }); r.consumable = d.consumable; });
    renderRows(); schedulePreview(); toast(`已套用到 ${S.rows.length} 行貨品`);
  });
  // 全局欄
  const gmap = { g_payee: 'payee', g_applicant: 'applicant' };
  Object.entries(gmap).forEach(([id, k]) => $('#' + id).addEventListener('input', (e) => { S.settings[k] = e.target.value; saveSettings(); schedulePreview(); }));
  $('#g_date').addEventListener('input', (e) => { S.appDate = e.target.value; schedulePreview(); });
  $('#g_group').addEventListener('change', (e) => { S.settings.group = e.target.value; saveSettings(); renderRows(); schedulePreview(); });
  $('#pv_layout').addEventListener('change', (e) => { S.settings.layout = e.target.value; saveSettings(); schedulePreview(); });
  $('#pv_att').addEventListener('change', (e) => { S.settings.attach = e.target.checked; saveSettings(); schedulePreview(); });
  $('#pv_cap').addEventListener('change', (e) => { S.settings.caption = e.target.checked; saveSettings(); schedulePreview(); });
  $('#btnPDF').addEventListener('click', downloadPDF);
  if (LOCAL) {
    $('#btnPrint').hidden = false; $('#btnPrint').addEventListener('click', printDirect);
    $('#dlNote').textContent = '「直接列印」會打開瀏覽器的列印視窗，紙張揀 A4、邊界揀「無」。亦可以先下載 PDF 再印。';
    $('#setPort').hidden = false;
    $('#btnExport').addEventListener('click', exportSettings);
    const imp = $('#importIn'); $('#btnImport').addEventListener('click', () => imp.click());
    imp.addEventListener('change', () => { if (imp.files[0]) importSettings(imp.files[0]); imp.value = ''; });
  }
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
}

/* ================= 啟動 ================= */
async function init() {
  loadLocal();
  bind(); buildDatalists(); renderGlobal(); renderShared();
  renderAll();
  if (!LOCAL) initSync();
  try { await withTimeout(document.fonts?.ready || Promise.resolve(), 3000, 'f'); } catch { }
  buildDemo(); renderAll();
  ensureConv().then(() => { syncRows(); renderAll(); });
  // 預先載入文字辨識（背景進行）
  setTimeout(() => ensureWorker().catch(() => {}), 1200);
}
window.__app = { S, Parser, orderInfo, buildPages, renderPage, addFiles, suggestName, ensureTemplate, TPL };
init();
})();
