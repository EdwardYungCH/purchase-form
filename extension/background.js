const ORDER_URL = /^https:\/\/([a-z0-9-]+\.)*(taobao|tmall)\.com\/.*(trade_order_detail|order_detail|orderDetail|trade_item_detail|tradeDetail|order\/detail)/i;
let lastCapture = 0;

async function setStatus(text, kind = '') {
  await chrome.storage.session.set({ status: { text, kind, at: Date.now() } });
  chrome.runtime.sendMessage({ type: 'status', text, kind }).catch(() => {});
}
/* 先把 page.js 注入分頁，再按名稱呼叫裏面的函數 */
async function inject(tabId) { await chrome.scripting.executeScript({ target: { tabId }, files: ['page.js'] }); }
async function exec(tabId, name, args = []) {
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: (n, a) => self[n](...a), args: [name, args] });
  return res ? res.result : undefined;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function grab(windowId) {
  const wait = 550 - (Date.now() - lastCapture);
  if (wait > 0) await sleep(wait);
  lastCapture = Date.now();
  return chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
}

/* ---------- PNG：加入 tEXt 資料 ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(bytes) { let c = 0xffffffff; for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); }
function withText(png, key, value) {
  const kv = new TextEncoder().encode(key + '\0' + value);
  const type = new TextEncoder().encode('tEXt');
  const chunk = new Uint8Array(12 + kv.length);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, kv.length); chunk.set(type, 4); chunk.set(kv, 8);
  const forCrc = new Uint8Array(4 + kv.length); forCrc.set(type, 0); forCrc.set(kv, 4);
  dv.setUint32(8 + kv.length, crc32(forCrc));
  const ihdrEnd = 8 + 25; // 簽名 + IHDR
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, ihdrEnd), 0); out.set(chunk, ihdrEnd); out.set(png.subarray(ihdrEnd), ihdrEnd + chunk.length);
  return out;
}

/* ---------- 截取一個分頁 ---------- */
async function captureTab(tab) {
  if (!tab || !/^https:\/\/([a-z0-9-]+\.)*(taobao|tmall)\.com\//i.test(tab.url || '')) throw new Error('這個分頁不是淘寶網頁');
  await inject(tab.id);
  if (await exec(tab.id, 'pfExpand')) await sleep(500);
  const prep = await exec(tab.id, 'pfPrepare');
  if (!prep) throw new Error('未能讀取頁面');
  try {
    const { rect, vw, docH } = prep;
    let vh = prep.vh;
    const shots = [];
    let y = rect.top, scale = null;
    for (let guard = 0; guard < 40; guard++) {
      const sy = await exec(tab.id, 'pfScroll', [Math.max(0, Math.min(y, docH - vh))]);
      const url = await grab(tab.windowId);
      const bmp = await createImageBitmap(await (await fetch(url)).blob());
      if (scale == null) { scale = bmp.width / vw; vh = Math.min(vh, bmp.height / scale); }
      shots.push({ sy, bmp });
      if (sy + vh >= rect.bottom - 1 || sy + vh >= docH - 1) break;
      y = sy + vh;
    }
    const W = Math.round(rect.width * scale), H = Math.round((rect.bottom - rect.top) * scale);
    const canvas = new OffscreenCanvas(W, H);
    const g = canvas.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    for (const s of shots) {
      const t = Math.max(rect.top, s.sy), b = Math.min(rect.bottom, s.sy + vh);
      if (b <= t) continue;
      g.drawImage(s.bmp, rect.left * scale, (t - s.sy) * scale, rect.width * scale, (b - t) * scale, 0, (t - rect.top) * scale, rect.width * scale, (b - t) * scale);
    }
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const data = { ...prep.data, region: prep.ok ? 'order' : 'page' };
    const json = b64(new TextEncoder().encode(JSON.stringify(data)));
    const png = withText(new Uint8Array(await blob.arrayBuffer()), 'pf-data', json);
    const day = (data.created || new Date().toISOString()).slice(0, 10);
    const name = `淘寶訂單/${day}_${data.orderNo || '未讀到訂單編號'}.png`;
    self.__lastPng = png;
    await chrome.downloads.download({ url: 'data:image/png;base64,' + b64(png), filename: name, conflictAction: 'uniquify', saveAs: false });
    return { name, data, ok: prep.ok };
  } finally {
    await exec(tab.id, 'pfRestore').catch(() => {});
  }
}

async function captureCurrent() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await setStatus('截圖中…', 'busy');
  try {
    const r = await captureTab(tab);
    const n = r.data.items?.length || 0;
    await setStatus(`已儲存 ${r.name.split('/').pop()}（${n} 件貨品${r.data.paidHKD != null ? `，HK$${r.data.paidHKD.toFixed(2)}` : ''}）${r.ok ? '' : '・找不到訂單範圍，已截整頁'}`, r.ok ? 'ok' : 'warn');
    chrome.action.setBadgeText({ text: '✓', tabId: tab.id }); chrome.action.setBadgeBackgroundColor({ color: '#1d7a46' });
  } catch (e) {
    await setStatus('截圖失敗：' + (e.message || e), 'bad');
    chrome.action.setBadgeText({ text: '!', tabId: tab?.id }); chrome.action.setBadgeBackgroundColor({ color: '#c0352b' });
  }
}

async function waitComplete(tabId) {
  for (let i = 0; i < 40; i++) { const t = await chrome.tabs.get(tabId); if (t.status === 'complete') return t; await sleep(250); }
  return chrome.tabs.get(tabId);
}
async function captureAll() {
  const [orig] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabs = (await chrome.tabs.query({ currentWindow: true })).filter((t) => ORDER_URL.test(t.url || ''));
  if (!tabs.length) { await setStatus('這個視窗沒有淘寶訂單詳情分頁', 'warn'); return; }
  let ok = 0; const fails = [];
  for (let i = 0; i < tabs.length; i++) {
    await setStatus(`截圖中 ${i + 1}/${tabs.length}…`, 'busy');
    try {
      await chrome.tabs.update(tabs[i].id, { active: true });
      const t = await waitComplete(tabs[i].id); await sleep(700);
      await captureTab(t); ok++;
      chrome.action.setBadgeText({ text: '✓', tabId: t.id }); chrome.action.setBadgeBackgroundColor({ color: '#1d7a46' });
    } catch (e) { fails.push(`${i + 1}：${e.message || e}`); }
  }
  if (orig) chrome.tabs.update(orig.id, { active: true }).catch(() => {});
  await setStatus(`完成：已儲存 ${ok} 張${fails.length ? `，${fails.length} 張失敗（${fails.join('；')}）` : ''}。檔案在「下載」的「淘寶訂單」資料夾。`, fails.length ? 'warn' : 'ok');
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.cmd === 'captureCurrent') { captureCurrent(); reply({ started: true }); }
  if (msg.cmd === 'captureAll') { captureAll(); reply({ started: true }); }
  if (msg.cmd === 'countTabs') { chrome.tabs.query({ currentWindow: true }).then((ts) => reply({ n: ts.filter((t) => ORDER_URL.test(t.url || '')).length })); return true; }
});
chrome.commands.onCommand.addListener((c) => { if (c === 'capture-current') captureCurrent(); });
