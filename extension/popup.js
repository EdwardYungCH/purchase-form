const st = document.getElementById('status');
const show = (s) => { if (!s) return; st.textContent = s.text; st.className = s.kind || ''; };
chrome.storage.session.get('status').then((r) => { if (r.status && Date.now() - r.status.at < 10 * 60 * 1000) show(r.status); });
chrome.runtime.onMessage.addListener((m) => { if (m.type === 'status') show(m); });
chrome.runtime.sendMessage({ cmd: 'countTabs' }).then((r) => {
  const b = document.getElementById('all');
  b.textContent = `截取全部訂單分頁（${r?.n || 0} 個）`;
  b.disabled = !r?.n;
});
document.getElementById('one').addEventListener('click', () => chrome.runtime.sendMessage({ cmd: 'captureCurrent' }));
document.getElementById('all').addEventListener('click', () => chrome.runtime.sendMessage({ cmd: 'captureAll' }));
