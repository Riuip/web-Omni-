// Web-Omni: 输入框时光机 (Input Time Machine)
// 自动保存所有 textarea / contenteditable 的内容，页面刷新后一键恢复
(function() {
  if (window.webOmniInputTMInjected) return;
  window.webOmniInputTMInjected = true;

  const SAVE_DELAY = 2000;   // 2秒防抖
  const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7天过期
  const STORAGE_KEY = 'woInputTM';
  let enabled = false;
  const timers = new WeakMap();
  const restoreBtns = new WeakMap();

  chrome.runtime.onMessage.addListener((req) => {
    if (req.action === 'INPUT_TM_TOGGLE') toggleTM();
    if (req.action === 'INPUT_TM_SHOW_HISTORY') showHistory();
  });

  // 从存储读取开关状态
  chrome.storage.local.get(['woInputTMEnabled'], (r) => {
    if (r.woInputTMEnabled) {
      enabled = true;
      startMonitoring();
    }
  });

  function toggleTM() {
    enabled = !enabled;
    chrome.storage.local.set({ woInputTMEnabled: enabled });
    if (enabled) {
      startMonitoring();
      if (window.webOmniShowToast) window.webOmniShowToast('输入框保护已开启', 'success');
    } else {
      stopMonitoring();
      if (window.webOmniShowToast) window.webOmniShowToast('输入框保护已关闭', 'info');
    }
  }

  // ===== 元素唯一标识 =====
  function getElementKey(el) {
    if (el.id) return 'id:' + el.id;
    if (el.name) return 'name:' + el.name;
    // 用 CSS 路径作为标识
    const parts = [];
    let node = el;
    while (node && node !== document.body) {
      let tag = node.tagName.toLowerCase();
      const idx = Array.from(node.parentElement ? node.parentElement.children : []).indexOf(node);
      parts.unshift(tag + ':' + idx);
      node = node.parentElement;
    }
    return 'path:' + parts.join('>');
  }

  function getPageKey() {
    return location.origin + location.pathname;
  }

  // ===== 存储操作 =====
  async function loadAll() {
    const data = await chrome.storage.local.get([STORAGE_KEY]);
    return data[STORAGE_KEY] || {};
  }

  async function saveEntry(elKey, text) {
    if (!text || text.trim().length < 5) return; // 太短不保存
    const all = await loadAll();
    const pageKey = getPageKey();
    if (!all[pageKey]) all[pageKey] = {};
    all[pageKey][elKey] = { text: text, time: Date.now() };

    // 清理过期数据
    const now = Date.now();
    for (const pk of Object.keys(all)) {
      for (const ek of Object.keys(all[pk])) {
        if (now - all[pk][ek].time > MAX_AGE) delete all[pk][ek];
      }
      if (Object.keys(all[pk]).length === 0) delete all[pk];
    }

    // 控制总大小 (~5MB limit)
    const json = JSON.stringify(all);
    if (json.length > 4 * 1024 * 1024) {
      // LRU淘汰：删除最老的页面
      const pages = Object.entries(all).map(([k, v]) => {
        const newest = Math.max(...Object.values(v).map(e => e.time));
        return { key: k, time: newest };
      }).sort((a, b) => a.time - b.time);
      while (pages.length > 0 && JSON.stringify(all).length > 3 * 1024 * 1024) {
        delete all[pages.shift().key];
      }
    }

    chrome.storage.local.set({ [STORAGE_KEY]: all });
  }

  // ===== 监听输入 =====
  let observer = null;

  function startMonitoring() {
    // 监听已有元素
    scanAndAttach();

    // MutationObserver 监测新增元素
    observer = new MutationObserver((mutations) => {
      let hasNew = false;
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) hasNew = true;
        }
      }
      if (hasNew) scanAndAttach();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 检查恢复
    checkRestore();
  }

  function stopMonitoring() {
    if (observer) { observer.disconnect(); observer = null; }
    // 移除所有恢复按钮
    document.querySelectorAll('.wo-tm-restore').forEach(b => b.remove());
  }

  function scanAndAttach() {
    // textarea
    document.querySelectorAll('textarea').forEach(el => attachTo(el, 'textarea'));
    // contenteditable
    document.querySelectorAll('[contenteditable="true"],[contenteditable=""]').forEach(el => attachTo(el, 'editable'));
    // 大型 input[type=text]
    document.querySelectorAll('input[type="text"],input:not([type])').forEach(el => {
      if (el.maxLength > 100 || !el.maxLength) attachTo(el, 'input');
    });
  }

  function attachTo(el, type) {
    if (el._woTM) return;
    el._woTM = true;

    const handler = () => {
      if (!enabled) return;
      const existing = timers.get(el);
      if (existing) clearTimeout(existing);
      timers.set(el, setTimeout(() => {
        const text = type === 'editable' ? el.innerText : el.value;
        if (text) saveEntry(getElementKey(el), text);
      }, SAVE_DELAY));
    };

    el.addEventListener('input', handler);
    el.addEventListener('keyup', handler);
  }

  // ===== 恢复 =====
  async function checkRestore() {
    const all = await loadAll();
    const pageData = all[getPageKey()];
    if (!pageData) return;

    // 延迟检查，等页面 DOM 稳定
    setTimeout(() => {
      for (const [elKey, entry] of Object.entries(pageData)) {
        const el = findElement(elKey);
        if (!el) continue;

        const currentText = el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' ? el.value : el.innerText;
        // 只在当前为空或明显变短时显示恢复按钮
        if (entry.text.length > 10 && currentText.length < entry.text.length * 0.5) {
          showRestoreBtn(el, entry);
        }
      }
    }, 1000);
  }

  function findElement(key) {
    if (key.startsWith('id:')) return document.getElementById(key.slice(3));
    if (key.startsWith('name:')) return document.querySelector('[name="' + CSS.escape(key.slice(5)) + '"]');
    if (key.startsWith('path:')) {
      const parts = key.slice(5).split('>');
      let node = document.body;
      for (const part of parts) {
        const [tag, idx] = part.split(':');
        const children = node.children;
        if (children[parseInt(idx)] && children[parseInt(idx)].tagName.toLowerCase() === tag) {
          node = children[parseInt(idx)];
        } else {
          return null;
        }
      }
      return node;
    }
    return null;
  }

  function showRestoreBtn(el, entry) {
    if (restoreBtns.has(el)) return;
    const btn = document.createElement('button');
    btn.className = 'wo-tm-restore';
    btn.textContent = '恢复上一版本 (' + new Date(entry.time).toLocaleTimeString() + ')';
    btn.style.cssText = 'position:absolute;z-index:2147483647;background:#238636;color:#fff;border:1px solid #2ea043;padding:3px 10px;border-radius:4px;font-size:11px;cursor:pointer;font-family:-apple-system,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.3);white-space:nowrap;';

    // 定位到输入框右上角
    const rect = el.getBoundingClientRect();
    btn.style.top = (window.scrollY + rect.top - 4) + 'px';
    btn.style.left = (window.scrollX + rect.right - 180) + 'px';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        // React/Vue 兼容：使用 nativeInputValueSetter
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        )?.set || Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value'
        )?.set;
        if (nativeSetter) {
          nativeSetter.call(el, entry.text);
        } else {
          el.value = entry.text;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        el.innerText = entry.text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }

      btn.remove();
      restoreBtns.delete(el);
      if (window.webOmniShowToast) window.webOmniShowToast('内容已恢复 (' + entry.text.length + ' 字符)', 'success');
    });

    document.body.appendChild(btn);
    restoreBtns.set(el, btn);

    // 10秒后自动隐藏
    setTimeout(() => {
      if (btn.parentElement) {
        btn.style.opacity = '0.5';
        setTimeout(() => { if (btn.parentElement) btn.remove(); restoreBtns.delete(el); }, 5000);
      }
    }, 10000);
  }

  // ===== 历史管理面板 =====
  async function showHistory() {
    const all = await loadAll();
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(1,4,9,0.6);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:-apple-system,sans-serif;';

    let html = '<div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:20px;width:500px;max-height:70vh;overflow-y:auto;color:#e6edf3;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">'
      + '<h3 style="font-size:15px;font-weight:600;">输入框时光机 · 历史</h3>'
      + '<span style="font-size:11px;color:#8b949e;">' + (enabled ? '已开启' : '已关闭') + '</span></div>';

    const pages = Object.keys(all);
    if (pages.length === 0) {
      html += '<p style="color:#8b949e;font-size:13px;text-align:center;padding:20px;">暂无保存的记录</p>';
    } else {
      pages.forEach(pageKey => {
        const entries = all[pageKey];
        const domain = pageKey.replace(/^https?:\/\//, '').split('/')[0];
        html += '<div style="margin-bottom:12px;">'
          + '<div style="font-size:12px;color:#58a6ff;margin-bottom:4px;">' + domain + '</div>';
        Object.entries(entries).forEach(([elKey, entry]) => {
          const preview = entry.text.substring(0, 80).replace(/</g, '&lt;') + (entry.text.length > 80 ? '...' : '');
          const time = new Date(entry.time).toLocaleString();
          html += '<div style="background:#0d1117;border:1px solid #21262d;border-radius:4px;padding:8px 10px;margin-bottom:4px;font-size:12px;">'
            + '<div style="color:#8b949e;margin-bottom:2px;">' + time + ' · ' + entry.text.length + ' 字符</div>'
            + '<div style="color:#c9d1d9;">' + preview + '</div></div>';
        });
        html += '</div>';
      });
      html += '<button id="wo-tm-clear-all" style="width:100%;padding:8px;background:#21262d;border:1px solid #30363d;color:#f85149;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit;margin-top:8px;">清空所有历史</button>';
    }
    html += '<button id="wo-tm-close" style="width:100%;padding:8px;background:#21262d;border:1px solid #30363d;color:#c9d1d9;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit;margin-top:6px;">关闭</button></div>';

    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    const closeBtn = document.getElementById('wo-tm-close');
    if (closeBtn) closeBtn.addEventListener('click', () => overlay.remove());
    const clearBtn = document.getElementById('wo-tm-clear-all');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      chrome.storage.local.remove([STORAGE_KEY]);
      overlay.remove();
      if (window.webOmniShowToast) window.webOmniShowToast('历史已清空', 'info');
    });
  }
})();
