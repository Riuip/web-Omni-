// Web-Omni: 万物皆可画中画 (Element-level PiP)
(function() {
  if (window.webOmniElementPipInjected) return;
  window.webOmniElementPipInjected = true;

  let pickMode = false, hoverTarget = null, highlightBox = null;

  chrome.runtime.onMessage.addListener((req) => {
    if (req.action === 'ELEMENT_PIP') startPicking();
  });

  function startPicking() {
    if (pickMode) { cancelPicking(); return; }
    pickMode = true;
    highlightBox = document.createElement('div');
    highlightBox.id = 'wo-pip-highlight';
    highlightBox.style.cssText = 'position:fixed;z-index:2147483647;border:2px solid #58a6ff;background:rgba(88,166,255,0.08);pointer-events:none;transition:all 0.1s;display:none;border-radius:4px;';
    document.body.appendChild(highlightBox);
    const bar = document.createElement('div');
    bar.id = 'wo-pip-bar';
    bar.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#161b22;border:1px solid #30363d;border-radius:6px;padding:8px 16px;font-family:-apple-system,sans-serif;font-size:12px;color:#c9d1d9;box-shadow:0 4px 16px rgba(0,0,0,0.3);';
    bar.innerHTML = '点击选择要提取的元素 · <span style="color:#8b949e;">ESC 取消</span>';
    document.body.appendChild(bar);
    document.addEventListener('mousemove', onPickMove, true);
    document.addEventListener('click', onPickClick, true);
    document.addEventListener('keydown', onPickKey, true);
  }

  function cancelPicking() {
    pickMode = false; hoverTarget = null;
    document.removeEventListener('mousemove', onPickMove, true);
    document.removeEventListener('click', onPickClick, true);
    document.removeEventListener('keydown', onPickKey, true);
    var h = document.getElementById('wo-pip-highlight'); if (h) h.remove();
    var b = document.getElementById('wo-pip-bar'); if (b) b.remove();
    highlightBox = null;
  }

  function onPickMove(e) {
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === highlightBox || el.id === 'wo-pip-bar') return;
    if (el.closest('[id^="wo-"]') || el.closest('[id^="web-omni"]')) return;
    hoverTarget = el;
    var r = el.getBoundingClientRect();
    highlightBox.style.display = 'block';
    highlightBox.style.left = r.left + 'px';
    highlightBox.style.top = r.top + 'px';
    highlightBox.style.width = r.width + 'px';
    highlightBox.style.height = r.height + 'px';
  }

  function onPickClick(e) {
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    if (!hoverTarget) return;
    var el = hoverTarget; cancelPicking(); extractToPip(el);
  }

  function onPickKey(e) { if (e.key === 'Escape') { e.preventDefault(); cancelPicking(); } }

  async function extractToPip(el) {
    var rect = el.getBoundingClientRect();
    var w = Math.max(300, Math.min(rect.width + 32, 800));
    var h = Math.max(200, Math.min(rect.height + 32, 600));

    // Document PiP API (Chrome 116+)
    if ('documentPictureInPicture' in window) {
      try {
        var pip = await documentPictureInPicture.requestWindow({ width: Math.round(w), height: Math.round(h) });
        var bs = pip.document.createElement('style');
        bs.textContent = 'body{margin:0;padding:16px;background:#0d1117;color:#e6edf3;overflow:auto;font-family:-apple-system,sans-serif;}*{max-width:100%!important;}';
        pip.document.head.appendChild(bs);
        document.querySelectorAll('style,link[rel="stylesheet"]').forEach(function(s) { pip.document.head.appendChild(s.cloneNode(true)); });
        pip.document.body.appendChild(el.cloneNode(true));
        var sid = setInterval(function() { try { if (pip.document) { pip.document.body.innerHTML=''; pip.document.body.appendChild(el.cloneNode(true)); } else clearInterval(sid); } catch(e) { clearInterval(sid); } }, 3000);
        if (window.webOmniShowToast) window.webOmniShowToast('元素已提取为画中画', 'success');
        return;
      } catch(e) { /* fallback */ }
    }

    // 降级: window.open
    var pw = window.open('', '_blank', 'width='+Math.round(w)+',height='+Math.round(h)+',top=100,left='+(screen.width-Math.round(w)-50)+',menubar=no,toolbar=no,location=no');
    if (!pw) { if (window.webOmniShowToast) window.webOmniShowToast('弹窗被拦截，请允许弹窗', 'error'); return; }
    pw.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>PiP</title><style>body{margin:0;padding:16px;background:#0d1117;color:#e6edf3;overflow:auto;font-family:-apple-system,sans-serif;}*{max-width:100%!important;}</style></head><body></body></html>');
    pw.document.close();
    pw.document.body.appendChild(el.cloneNode(true));
    var sid2 = setInterval(function() { try { if (!pw.closed) { pw.document.body.innerHTML=''; pw.document.body.appendChild(el.cloneNode(true)); } else clearInterval(sid2); } catch(e) { clearInterval(sid2); } }, 3000);
    if (window.webOmniShowToast) window.webOmniShowToast('元素已提取为悬浮窗', 'success');
  }
})();
