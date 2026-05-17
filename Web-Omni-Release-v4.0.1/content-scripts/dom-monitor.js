// Web-Omni: DOM 微监控 (Micro DOM Monitor)
// 框选网页元素，后台定期监听变化，支持阈值通知
(function() {
  if (window.webOmniDomMonitorInjected) return;
  window.webOmniDomMonitorInjected = true;

  const STORAGE_KEY = 'woDomMonitors';
  let pickMode = false, hoverTarget = null, hlBox = null;

  chrome.runtime.onMessage.addListener((req) => {
    if (req.action === 'DOM_MONITOR_ADD') startPick();
    if (req.action === 'DOM_MONITOR_PANEL') showDashboard();
  });

  function startPick() {
    if (pickMode) { cancelPick(); return; }
    pickMode = true;
    hlBox = document.createElement('div');
    hlBox.id = 'wo-dm-hl';
    hlBox.style.cssText = 'position:fixed;z-index:2147483647;border:2px solid #f97316;background:rgba(249,115,22,0.08);pointer-events:none;transition:all 0.1s;display:none;border-radius:4px;';
    document.body.appendChild(hlBox);
    var bar = document.createElement('div');
    bar.id = 'wo-dm-bar';
    bar.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#161b22;border:1px solid #30363d;border-radius:6px;padding:8px 16px;font-family:-apple-system,sans-serif;font-size:12px;color:#c9d1d9;box-shadow:0 4px 16px rgba(0,0,0,0.3);';
    bar.textContent = '点击要监控的元素 (数字/价格/状态) · ESC 取消';
    document.body.appendChild(bar);
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
  }

  function cancelPick() {
    pickMode = false; hoverTarget = null;
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey, true);
    var h = document.getElementById('wo-dm-hl'); if(h) h.remove();
    var b = document.getElementById('wo-dm-bar'); if(b) b.remove();
    hlBox = null;
  }

  function onMove(e) {
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === hlBox || el.closest('[id^="wo-"]')) return;
    hoverTarget = el;
    var r = el.getBoundingClientRect();
    hlBox.style.display = 'block';
    hlBox.style.left = r.left+'px'; hlBox.style.top = r.top+'px';
    hlBox.style.width = r.width+'px'; hlBox.style.height = r.height+'px';
  }

  function onClick(e) {
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    if (!hoverTarget) return;
    var el = hoverTarget;
    cancelPick();
    addMonitor(el);
  }

  function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); cancelPick(); } }

  function getCssSelector(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    var parts = [];
    while (el && el !== document.body) {
      var tag = el.tagName.toLowerCase();
      var idx = Array.from(el.parentElement ? el.parentElement.children : []).indexOf(el);
      parts.unshift(tag + ':nth-child(' + (idx+1) + ')');
      el = el.parentElement;
    }
    return 'body > ' + parts.join(' > ');
  }

  async function addMonitor(el) {
    var selector = getCssSelector(el);
    var text = (el.innerText || el.textContent || '').trim().substring(0, 200);
    var label = prompt('给这个监控项起个名字:', text.substring(0, 30) || '监控项');
    if (!label) return;

    var all = await loadMonitors();
    all.push({
      id: Date.now().toString(36),
      url: location.href,
      domain: location.hostname,
      selector: selector,
      label: label,
      currentValue: text,
      history: [{ value: text, time: Date.now() }],
      threshold: null,
      created: Date.now()
    });
    await saveMonitors(all);
    // 通知后台开始轮询
    chrome.runtime.sendMessage({ type: 'DOM_MONITOR_START' });
    if (window.webOmniShowToast) window.webOmniShowToast('监控项已添加: ' + label, 'success');
  }

  async function loadMonitors() {
    var d = await chrome.storage.local.get([STORAGE_KEY]);
    return d[STORAGE_KEY] || [];
  }
  async function saveMonitors(arr) {
    await chrome.storage.local.set({ [STORAGE_KEY]: arr });
  }

  // 当前页面：检查并更新监控值
  async function checkCurrentPage() {
    var all = await loadMonitors();
    var changed = false;
    all.forEach(function(m) {
      if (m.url !== location.href && m.domain !== location.hostname) return;
      var el = document.querySelector(m.selector);
      if (!el) return;
      var val = (el.innerText || el.textContent || '').trim().substring(0, 200);
      if (val !== m.currentValue) {
        m.currentValue = val;
        m.history.push({ value: val, time: Date.now() });
        if (m.history.length > 100) m.history = m.history.slice(-100);
        changed = true;
      }
    });
    if (changed) await saveMonitors(all);
  }

  // 每30秒检查当前页面
  setInterval(checkCurrentPage, 30000);
  setTimeout(checkCurrentPage, 3000);

  // 仪表盘
  async function showDashboard() {
    var all = await loadMonitors();
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(1,4,9,0.6);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:-apple-system,sans-serif;';
    var html = '<div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:20px;width:520px;max-height:70vh;overflow-y:auto;color:#e6edf3;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">'
      + '<h3 style="font-size:15px;font-weight:600;">DOM 监控仪表盘</h3>'
      + '<span style="font-size:11px;color:#8b949e;">' + all.length + ' 个监控项</span></div>';

    if (all.length === 0) {
      html += '<p style="text-align:center;color:#8b949e;padding:20px;font-size:13px;">暂无监控项<br><span style="font-size:11px;">使用 Command Hub 的「添加监控」来创建</span></p>';
    } else {
      all.forEach(function(m, i) {
        var prev = m.history.length > 1 ? m.history[m.history.length - 2].value : m.currentValue;
        var changed = prev !== m.currentValue;
        var color = changed ? '#f97316' : '#3fb950';
        html += '<div style="background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:10px 12px;margin-bottom:6px;">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;">'
          + '<span style="font-size:13px;font-weight:500;">' + m.label + '</span>'
          + '<button class="wo-dm-del" data-idx="'+i+'" style="background:none;border:none;color:#f85149;cursor:pointer;font-size:11px;">删除</button></div>'
          + '<div style="font-size:11px;color:#8b949e;margin:2px 0;">' + m.domain + '</div>'
          + '<div style="font-size:16px;font-weight:600;color:'+color+';margin:4px 0;">' + (m.currentValue||'(空)').substring(0,60) + '</div>'
          + '<div style="font-size:10px;color:#484f58;">更新 ' + m.history.length + ' 次 · 创建于 ' + new Date(m.created).toLocaleDateString() + '</div></div>';
      });
    }
    html += '<button id="wo-dm-close" style="width:100%;padding:8px;background:#21262d;border:1px solid #30363d;color:#c9d1d9;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit;margin-top:8px;">关闭</button></div>';
    ov.innerHTML = html;
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
    ov.querySelector('#wo-dm-close').onclick = function() { ov.remove(); };
    ov.querySelectorAll('.wo-dm-del').forEach(function(b) {
      b.onclick = async function() {
        var idx = parseInt(b.dataset.idx);
        all.splice(idx, 1);
        await saveMonitors(all);
        ov.remove();
        showDashboard();
      };
    });
  }
})();
