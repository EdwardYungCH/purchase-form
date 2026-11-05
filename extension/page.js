/* 注入到淘寶訂單頁的函數（由 background.js 用 chrome.scripting 執行） */

/* 展開「更多訂單信息」 */
function pfExpand() {
  let clicked = false;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    if (/^展开更多订单信息/.test(n.nodeValue.trim())) {
      const el = n.parentElement.closest('a,button,[role=button],span,div');
      if (el) { el.click(); clicked = true; }
    }
  }
  return clicked;
}

/* 量度訂單範圍、隱藏浮動元素、抽取訂單資料 */
function pfPrepare() {
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const find = (re) => {
    const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { if (re.test(n.nodeValue.trim())) { const el = n.parentElement; if (el && vis(el)) out.push(el); } }
    return out;
  };
  const Y = (el) => el.getBoundingClientRect().top + window.scrollY;
  const B = (el) => el.getBoundingClientRect().bottom + window.scrollY;
  const lca = (a, b) => { const s = new Set(); for (let x = a; x; x = x.parentElement) s.add(x); for (let x = b; x; x = x.parentElement) if (s.has(x)) return x; return document.body; };

  window.__pfState = { scrollX: window.scrollX, scrollY: window.scrollY, hidden: [] };
  window.scrollTo(0, 0);
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed' || cs.position === 'sticky') {
      window.__pfState.hidden.push([el, el.style.getPropertyValue('visibility'), el.style.getPropertyPriority('visibility')]);
      el.style.setProperty('visibility', 'hidden', 'important');
    }
  }

  const guess = find(/^猜你喜欢$/)[0];
  const limit = guess ? Y(guess) - 8 : Infinity;
  const topEl = find(/^拍下宝贝$|^拍下商品$/)[0] || find(/^(交易成功|交易关闭|卖家已发货|等待买家付款|等待卖家发货|买家已付款)$/)[0];
  const payEl = find(/^实付款/)[0];
  const noEl = find(/^订单编号/)[0];
  const ends = [...find(/^(申请售后|加入购物车|订单服务|确认收货|再买一单|查看交易快照|收起更多订单信息|展开更多订单信息)/), payEl, noEl].filter((e) => e && Y(e) < limit);

  const data = pfData(limit);
  const docH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  const base = { vw: window.innerWidth, vh: window.innerHeight, docH, data };
  if (!topEl && !payEl) {
    return { ...base, ok: false, rect: { left: 0, top: 0, width: window.innerWidth, bottom: Math.min(docH, limit === Infinity ? docH : limit) } };
  }
  let cont = lca(topEl || payEl, payEl || topEl);
  ends.forEach((e) => { const c = lca(cont, e); if (c !== document.body && c !== document.documentElement) cont = c; });
  const cr = cont.getBoundingClientRect();
  const top = Math.max(0, Math.min(...[topEl, payEl].filter(Boolean).map(Y)) - 64);
  let bottom = Math.max(...ends.map(B)) + 20;
  // 右邊付款詳情卡可能比文字低一點：取「订单服务」所在卡片的底部
  const svc = find(/^订单服务$/)[0];
  if (svc) { let c = svc; for (let i = 0; i < 6 && c.parentElement; i++) { c = c.parentElement; if (c.getBoundingClientRect().width > cr.width * 0.6) break; if (B(c) < limit) bottom = Math.max(bottom, B(c) + 12); } }
  bottom = Math.min(bottom, limit, docH);
  const left = Math.max(0, cr.left - 12), right = Math.min(window.innerWidth, cr.right + 12);
  return { ...base, ok: true, rect: { left, top, width: right - left, bottom } };
}

function pfScroll(y) {
  window.scrollTo(0, y);
  return new Promise((r) => setTimeout(() => r(window.scrollY), 380));
}

function pfRestore() {
  const st = window.__pfState; if (!st) return;
  st.hidden.forEach(([el, v, pr]) => { if (v) el.style.setProperty('visibility', v, pr); else el.style.removeProperty('visibility'); });
  window.scrollTo(st.scrollX, st.scrollY);
  delete window.__pfState;
}

/* 由頁面文字抽取訂單資料 */
function pfData(limit) {
  const text = document.body.innerText;
  const num = (s) => (s == null ? null : parseFloat(String(s).replace(/,/g, '')));
  const pick = (re) => { const m = text.match(re); return m ? m[1] : null; };
  const lines = text.split('\n').map((s) => s.trim()).filter(Boolean);
  const valueAfter = (labelRe) => {
    for (let i = 0; i < lines.length; i++) {
      if (labelRe.test(lines[i])) {
        const same = lines[i].replace(labelRe, '').trim();
        const cand = same || lines[i + 1] || '';
        return cand;
      }
    }
    return '';
  };
  const money = (s) => { const m = String(s).match(/([\d,]+\.\d{2})/); return m ? num(m[1]) : null; };
  const out = { v: 1, source: 'taobao-ext', url: location.href, capturedAt: new Date().toISOString() };
  out.orderNo = pick(/订单编号\s*[:：]?\s*(\d{12,22})/) || '';
  const paid = valueAfter(/^实付款\s*[^\d¥￥A-Z]*/);
  if (/HK/i.test(paid)) out.paidHKD = money(paid); else out.paidCNY = money(paid);
  if (out.paidHKD == null) { const h = pick(/实付款[\s\S]{0,15}?HK[D$]\s*([\d,]+\.\d{2})/); if (h) out.paidHKD = num(h); }
  out.goodsCNY = money(valueAfter(/^商品总价/));
  let ship = 0, disc = 0, fee = null;
  lines.forEach((l, i) => {
    const v = /\d+\.\d{2}/.test(l) ? l : (lines[i + 1] || '');
    if (/^(运费|国内运费)/.test(l) && !/海外/.test(l)) { const m = money(v); if (m != null) ship += m; }
    if (/^海外运费/.test(l)) { const m = money(v); if (m != null) out.overseasCNY = m; }
    if (/^(店铺优惠|官方立减|平台优惠|优惠券|红包|跨店满减|商品优惠|淘金币|首单礼金|礼金|回购礼金)/.test(l)) { const m = money(v); if (m != null && !/HK/i.test(v)) disc += m; }
    if (/^支付优惠/.test(l)) { const m = money(v); if (m != null) out.payDiscountHKD = m; }
    if (/^支付手续费/.test(l)) fee = money(v);
  });
  out.shipCNY = ship; out.discountCNY = Math.round(disc * 100) / 100; out.feeHKD = fee;
  out.paidAt = pick(/付款时间\s*[:：]?\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/) || '';
  out.created = pick(/创建时间\s*[:：]?\s*(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}:\d{2})?)/) || pick(/付款时间\s*[:：]?\s*(\d{4}-\d{2}-\d{2})/) || '';

  // 商品：按頁面文字次序讀取（不依賴網頁結構）；同時保存這段文字，方便助手日後重新分析
  const all = lines;
  const r = itemsFromLines(all);
  out.items = r.items; out.shop = r.shop;
  let s0 = all.findIndex((l) => /^包裹\s*\d|查看交易快照/.test(l)); if (s0 < 0) s0 = 0;
  let e0 = all.findIndex((l, i) => i > s0 && /^(猜你喜欢|为你推荐)/.test(l)); if (e0 < 0) e0 = all.length;
  out.lines = all.slice(Math.max(0, s0 - 3), e0).slice(0, 600);
  return out;
}

/* 由訂單頁文字（按次序的行）抽取商品：標題 → 規格 → 價錢 → 數量 */
function itemsFromLines(all) {
  const SERVICE = /HK可退|无理由|假一赔|极速退款|价保|退货宝|破损包退|售后快速|争议|判断依据|交易快照|运费险|包邮到港/;
  const BTN = /^(?:退款|申请售后|加入购物车|确认收货|评价|查看物流|延长收货|再买一单|删除订单|申请开票|打印|追加评论|查看详情|展开全部商品|收起|复制|退货|换货|\s)+$/;
  const cjk = (s) => (s.match(/[一-鿿]/g) || []).length;
  const L = all.map((s) => String(s).trim()).filter(Boolean);
  let s = L.findIndex((l) => /查看交易快照/.test(l));
  if (s < 0) s = L.findIndex((l) => /^包裹\s*\d/.test(l));
  if (s < 0) return { items: [], shop: '' };
  let shop = '';
  if (s >= 0) { const before = L[s].split('查看交易快照')[0].replace(/^(淘宝|天猫|企|tmall|taobao)\s*/i, '').trim(); if (before.length >= 2) shop = before; }
  if (!shop) for (let k = s - 1; k >= Math.max(0, s - 3); k--) { if (L[k] && !/^(淘宝|天猫|企|tmall|taobao)$/i.test(L[k]) && cjk(L[k]) + L[k].length >= 2 && !/物流|快递|展开|包裹|\d{8,}/.test(L[k])) { shop = L[k]; break; } }
  let e = L.findIndex((l, i) => i > s && /^(猜你喜欢|付款详情|订单信息|订单服务|为你推荐)/.test(l));
  if (e < 0) e = L.length;
  const items = []; let cur = null;
  const push = () => { if (cur && cur.title) items.push(cur); cur = null; };
  for (const l of L.slice(s + 1, e)) {
    if (/查看交易快照/.test(l)) continue;
    const pm = l.match(/^[¥￥]\s*([\d,]+\.\d{2})$/);
    if (pm) { if (cur && cur.price == null) cur.price = parseFloat(pm[1].replace(/,/g, '')); continue; }
    const qm = l.match(/^[x×ｘ*]\s*(\d{1,4})$/i);
    if (qm) { if (cur) cur.qty = parseInt(qm[1], 10); continue; }
    if (SERVICE.test(l) || BTN.test(l) || /^包裹\s*\d|^官方物流|快递\s*\d|^\d{6,}$/.test(l)) continue;
    const titleLike = cjk(l) >= 6 || (l.length >= 12 && /[A-Za-z一-鿿]/.test(l));
    if (cur && cur.price == null && !cur.sku && l.length >= 2) { cur.sku = l; continue; }   // 標題後第一行是規格
    if (titleLike) { push(); cur = { title: l.replace(/\s+/g, ' '), sku: '', price: null, qty: 1 }; }
  }
  push();
  return { items, shop };
}
