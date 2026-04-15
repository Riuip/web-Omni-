// 神经末梢：绝对视觉掌控 (Visual Dictator)
// 元素消除狙击枪 + 规则数据库管理面板

(function() {
  if (window.webOmniVisualDictatorInjected) return;
  window.webOmniVisualDictatorInjected = true;

  let isDictatorActive = false;
  let hoveredElement = null;
  let removedElements = [];

  // 注入样式
  const highlightStyle = document.createElement("style");
  highlightStyle.textContent = `
    .web-omni-dictator-highlight {
      outline: 3px solid #ff4757 !important;
      outline-offset: -3px !important;
      cursor: crosshair !important;
      box-shadow: 0 0 15px rgba(255, 71, 87, 0.5) inset !important;
      transition: outline 0.1s, box-shadow 0.1s !important;
    }
    #web-omni-dictator-bar {
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      z-index: 2147483646; background: rgba(255, 71, 87, 0.9);
      backdrop-filter: blur(16px); color: #fff; padding: 12px 28px;
      border-radius: 50px; font-size: 14px; font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 8px 32px rgba(255, 71, 87, 0.4);
      display: flex; align-items: center; gap: 16px;
    }
    #web-omni-dictator-bar button {
      background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3);
      color: #fff; padding: 6px 14px; border-radius: 20px; cursor: pointer;
      font-size: 13px; font-weight: 500; transition: background 0.2s;
    }
    #web-omni-dictator-bar button:hover { background: rgba(255,255,255,0.35); }

    /* 规则数据库面板 */
    #web-omni-dictator-db {
      position: fixed; top: 0; right: 0; width: 440px; height: 100vh;
      z-index: 2147483646; background: rgba(18, 18, 18, 0.96);
      backdrop-filter: blur(24px); border-left: 1px solid rgba(255,255,255,0.08);
      box-shadow: -10px 0 40px rgba(0,0,0,0.4);
      overflow-y: auto; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #fff; transform: translateX(100%);
      transition: transform 0.35s cubic-bezier(0.2, 0, 0, 1);
    }
    #web-omni-dictator-db.open { transform: translateX(0); }
    .wo-db-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.06);
      position: sticky; top: 0; background: rgba(18,18,18,0.98); z-index: 2;
    }
    .wo-db-header h3 { margin: 0; font-size: 17px; font-weight: 700; }
    .wo-db-actions { display: flex; gap: 8px; }
    .wo-db-actions button {
      background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1);
      color: #ccc; padding: 6px 12px; border-radius: 8px; cursor: pointer;
      font-size: 12px; transition: background 0.2s;
    }
    .wo-db-actions button:hover { background: rgba(255,255,255,0.15); color: #fff; }
    .wo-db-actions button.danger:hover { background: rgba(239,68,68,0.3); color: #ff6b6b; }
    .wo-db-domain-group {
      border-bottom: 1px solid rgba(255,255,255,0.04); padding: 0;
    }
    .wo-db-domain-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 20px; cursor: pointer; transition: background 0.15s;
    }
    .wo-db-domain-header:hover { background: rgba(255,255,255,0.04); }
    .wo-db-domain-name {
      font-size: 14px; font-weight: 600; color: #007aff;
      display: flex; align-items: center; gap: 8px;
    }
    .wo-db-domain-count {
      font-size: 11px; background: rgba(0,122,255,0.2); color: #4da3ff;
      padding: 2px 8px; border-radius: 10px;
    }
    .wo-db-domain-actions button {
      background: none; border: none; color: #888; cursor: pointer;
      font-size: 12px; padding: 4px 8px; border-radius: 4px; transition: all 0.15s;
    }
    .wo-db-domain-actions button:hover { background: rgba(255,255,255,0.08); color: #fff; }
    .wo-db-rule-list { padding: 0 12px 8px; }
    .wo-db-rule-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 12px; margin: 3px 0; border-radius: 8px;
      background: rgba(255,255,255,0.03); transition: background 0.15s;
    }
    .wo-db-rule-item:hover { background: rgba(255,255,255,0.06); }
    .wo-db-rule-info { flex: 1; min-width: 0; }
    .wo-db-rule-tag {
      font-size: 12px; font-weight: 600; color: #f59e0b;
      font-family: "SF Mono", "Fira Code", monospace;
    }
    .wo-db-rule-selector {
      font-size: 11px; color: #666; font-family: "SF Mono", "Fira Code", monospace;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;
    }
    .wo-db-rule-text {
      font-size: 11px; color: #555; margin-top: 2px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .wo-db-rule-time { font-size: 10px; color: #444; margin-top: 3px; }
    .wo-db-rule-actions { display: flex; gap: 4px; flex-shrink: 0; }
    .wo-db-rule-actions button {
      background: rgba(255,255,255,0.06); border: none; color: #999;
      width: 28px; height: 28px; border-radius: 6px; cursor: pointer;
      font-size: 13px; display: flex; align-items: center; justify-content: center;
      transition: all 0.15s;
    }
    .wo-db-rule-actions button:hover { background: rgba(255,255,255,0.12); color: #fff; }
    .wo-db-rule-actions button.restore:hover { background: rgba(34,197,94,0.2); color: #4ade80; }
    .wo-db-rule-actions button.delete:hover { background: rgba(239,68,68,0.2); color: #f87171; }
    .wo-db-empty {
      text-align: center; color: #555; padding: 60px 20px; font-size: 14px;
    }
    .wo-db-empty-icon { font-size: 40px; margin-bottom: 12px; display: block; }
  `;
  document.head.appendChild(highlightStyle);

  let statusBar = null;

  function createStatusBar() {
    statusBar = document.createElement("div");
    statusBar.id = "web-omni-dictator-bar";
    statusBar.innerHTML = `
      <span>🎯 狙击模式 — 点击消除元素</span>
      <button id="web-omni-dictator-undo">↩ 撤销</button>
      <button id="web-omni-dictator-exit">✕ 退出 (Esc)</button>
    `;
    document.body.appendChild(statusBar);
    statusBar.querySelector("#web-omni-dictator-undo").addEventListener("click", e => {
      e.stopPropagation(); undoRemove();
    });
    statusBar.querySelector("#web-omni-dictator-exit").addEventListener("click", e => {
      e.stopPropagation(); deactivateDictator();
    });
  }
  function removeStatusBar() { if (statusBar) { statusBar.remove(); statusBar = null; } }

  // 监听指令
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "ACTIVATE_VISUAL_DICTATOR") toggleDictatorMode();
    else if (request.action === "OPEN_DICTATOR_DB") openDictatorDB();
  });

  function toggleDictatorMode() {
    isDictatorActive ? deactivateDictator() : activateDictator();
  }

  function activateDictator() {
    isDictatorActive = true;
    removedElements = [];
    document.addEventListener("mouseover", onMouseOver, true);
    document.addEventListener("mouseout", onMouseOut, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    createStatusBar();
    if (window.webOmniShowToast) window.webOmniShowToast("🎯 狙击模式激活！点击消除，Ctrl+Z 撤销，Esc 退出", "info");
  }

  function deactivateDictator() {
    isDictatorActive = false;
    document.removeEventListener("mouseover", onMouseOver, true);
    document.removeEventListener("mouseout", onMouseOut, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    if (hoveredElement) { hoveredElement.classList.remove("web-omni-dictator-highlight"); hoveredElement = null; }
    removeStatusBar();
    if (window.webOmniShowToast) window.webOmniShowToast("🎯 狙击模式关闭，消除 " + removedElements.length + " 个元素", "success");
  }

  function onMouseOver(e) {
    if (!isDictatorActive) return;
    if (e.target.closest("#web-omni-dictator-bar, #web-omni-command-hub-overlay, #web-omni-toast-container, #web-omni-dictator-db")) return;
    e.stopPropagation();
    if (hoveredElement && hoveredElement !== e.target) hoveredElement.classList.remove("web-omni-dictator-highlight");
    hoveredElement = e.target;
    hoveredElement.classList.add("web-omni-dictator-highlight");
  }

  function onMouseOut(e) {
    if (!isDictatorActive) return;
    e.stopPropagation();
    if (e.target) e.target.classList.remove("web-omni-dictator-highlight");
  }

  function onClick(e) {
    if (!isDictatorActive) return;
    if (e.target.closest("#web-omni-dictator-bar, #web-omni-command-hub-overlay, #web-omni-toast-container, #web-omni-dictator-db")) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.target;
    target.classList.remove("web-omni-dictator-highlight");
    removedElements.push({ element: target, parent: target.parentNode, nextSibling: target.nextSibling });
    target.remove();
    saveRules(target);
  }

  function onKeyDown(e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); deactivateDictator(); }
    else if (e.ctrlKey && e.key === "z") { e.preventDefault(); undoRemove(); }
  }

  function undoRemove() {
    if (removedElements.length === 0) {
      if (window.webOmniShowToast) window.webOmniShowToast("没有可撤销的操作", "warn");
      return;
    }
    const last = removedElements.pop();
    if (last.parent) {
      last.parent.insertBefore(last.element, last.nextSibling);
      if (window.webOmniShowToast) window.webOmniShowToast("↩ 已撤销", "info");
    }
  }

  // ========== 详细规则保存 ==========
  function saveRules(element) {
    try {
      let selector = "";
      if (element.id) selector = "#" + element.id;
      else if (element.className && typeof element.className === "string" && element.className.trim())
        selector = element.tagName.toLowerCase() + "." + element.className.trim().split(/\s+/).filter(c => !c.startsWith("web-omni")).join(".");
      else selector = element.tagName.toLowerCase();

      const domain = location.hostname;
      const record = {
        selector: selector,
        tag: element.tagName.toLowerCase(),
        text: (element.innerText || "").substring(0, 50).replace(/\n/g, " ").trim(),
        id: element.id || "",
        className: (typeof element.className === "string" ? element.className : "").substring(0, 80),
        time: new Date().toLocaleString(),
        timestamp: Date.now(),
        url: location.pathname
      };

      chrome.storage.local.get(["dictatorRules"], (result) => {
        let rules = result.dictatorRules || {};
        if (!rules[domain]) rules[domain] = [];
        rules[domain].push(record);
        chrome.storage.local.set({ dictatorRules: rules });
      });
    } catch(e) { console.warn("Web-Omni: 规则保存失败", e); }
  }

  // ========== 规则数据库面板 ==========
  function openDictatorDB() {
    let panel = document.getElementById("web-omni-dictator-db");
    if (panel) { panel.classList.toggle("open"); return; }

    panel = document.createElement("div");
    panel.id = "web-omni-dictator-db";
    document.body.appendChild(panel);

    renderDBPanel(panel);
    requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add("open")));
  }

  function renderDBPanel(panel) {
    chrome.storage.local.get(["dictatorRules"], (result) => {
      const rules = result.dictatorRules || {};
      const domains = Object.keys(rules).filter(d => rules[d].length > 0);
      const totalCount = domains.reduce((s, d) => s + rules[d].length, 0);

      let html = `
        <div class="wo-db-header">
          <h3>🗄️ 消除规则数据库 <span style="font-size:12px;color:#888;font-weight:400;">(${totalCount})</span></h3>
          <div class="wo-db-actions">
            <button id="wo-db-export" title="导出">📤 导出</button>
            <button id="wo-db-clear-all" class="danger" title="清空全部">🗑️ 全部清空</button>
            <button id="wo-db-close" style="font-size:16px;padding:4px 10px;">✕</button>
          </div>
        </div>
      `;

      if (domains.length === 0) {
        html += `<div class="wo-db-empty"><span class="wo-db-empty-icon">📭</span>暂无消除记录<br><span style="font-size:12px;color:#444;margin-top:8px;display:block;">使用狙击枪消除元素后，记录会自动保存在这里</span></div>`;
      } else {
        const currentDomain = location.hostname;
        const sortedDomains = domains.sort((a, b) => a === currentDomain ? -1 : b === currentDomain ? 1 : 0);

        sortedDomains.forEach(domain => {
          const domainRules = rules[domain];
          const isCurrent = domain === currentDomain;
          html += `
            <div class="wo-db-domain-group" data-domain="${domain}">
              <div class="wo-db-domain-header">
                <span class="wo-db-domain-name">
                  ${isCurrent ? '📍' : '🌐'} ${domain}
                  <span class="wo-db-domain-count">${domainRules.length}</span>
                  ${isCurrent ? '<span style="font-size:10px;color:#4ade80;background:rgba(34,197,94,0.15);padding:1px 6px;border-radius:4px;">当前</span>' : ''}
                </span>
                <span class="wo-db-domain-actions">
                  ${isCurrent ? '<button class="wo-db-restore-domain" data-domain="'+domain+'" title="恢复当前页面全部">↩ 全部恢复</button>' : ''}
                  <button class="wo-db-clear-domain" data-domain="${domain}" title="清空该域名规则">🗑️</button>
                </span>
              </div>
              <div class="wo-db-rule-list">`;

          domainRules.slice().reverse().forEach((rule, idx) => {
            const realIdx = domainRules.length - 1 - idx;
            html += `
                <div class="wo-db-rule-item">
                  <div class="wo-db-rule-info">
                    <div class="wo-db-rule-tag">&lt;${rule.tag}&gt;${rule.id ? ' #'+rule.id : ''}</div>
                    <div class="wo-db-rule-selector" title="${rule.selector}">${rule.selector}</div>
                    ${rule.text ? '<div class="wo-db-rule-text">"'+rule.text+'"</div>' : ''}
                    <div class="wo-db-rule-time">🕐 ${rule.time} · ${rule.url || '/'}</div>
                  </div>
                  <div class="wo-db-rule-actions">
                    ${domain === currentDomain ? '<button class="restore" data-domain="'+domain+'" data-idx="'+realIdx+'" title="恢复此元素">↩</button>' : ''}
                    <button class="delete" data-domain="${domain}" data-idx="${realIdx}" title="删除此条规则">✕</button>
                  </div>
                </div>`;
          });

          html += `</div></div>`;
        });
      }

      panel.innerHTML = html;
      bindDBEvents(panel);
    });
  }

  function bindDBEvents(panel) {
    panel.querySelector("#wo-db-close").addEventListener("click", () => {
      panel.classList.remove("open");
    });

    panel.querySelector("#wo-db-export")?.addEventListener("click", () => {
      chrome.storage.local.get(["dictatorRules"], (result) => {
        const json = JSON.stringify(result.dictatorRules || {}, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "web-omni-rules-" + Date.now() + ".json";
        a.click(); URL.revokeObjectURL(url);
        if (window.webOmniShowToast) window.webOmniShowToast("📤 规则已导出为 JSON", "success");
      });
    });

    panel.querySelector("#wo-db-clear-all")?.addEventListener("click", () => {
      if (confirm("确定清空所有域名的消除规则吗？此操作不可撤销！")) {
        chrome.storage.local.set({ dictatorRules: {} }, () => {
          renderDBPanel(panel);
          if (window.webOmniShowToast) window.webOmniShowToast("🗑️ 全部规则已清空", "success");
        });
      }
    });

    panel.querySelectorAll(".wo-db-clear-domain").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const domain = btn.dataset.domain;
        chrome.storage.local.get(["dictatorRules"], (result) => {
          let rules = result.dictatorRules || {};
          delete rules[domain];
          chrome.storage.local.set({ dictatorRules: rules }, () => {
            renderDBPanel(panel);
            if (window.webOmniShowToast) window.webOmniShowToast("已清空 " + domain + " 的规则", "info");
          });
        });
      });
    });

    panel.querySelectorAll(".wo-db-restore-domain").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const domain = btn.dataset.domain;
        chrome.storage.local.get(["dictatorRules"], (result) => {
          let rules = result.dictatorRules || {};
          if (rules[domain]) {
            rules[domain].forEach(rule => {
              try { document.querySelectorAll(rule.selector).forEach(el => el.style.removeProperty("display")); } catch(e) {}
            });
            delete rules[domain];
            chrome.storage.local.set({ dictatorRules: rules }, () => {
              renderDBPanel(panel);
              if (window.webOmniShowToast) window.webOmniShowToast("↩ 已恢复 " + domain + " 全部元素", "success");
            });
          }
        });
      });
    });

    panel.querySelectorAll(".wo-db-rule-actions .restore").forEach(btn => {
      btn.addEventListener("click", () => {
        const domain = btn.dataset.domain;
        const idx = parseInt(btn.dataset.idx);
        chrome.storage.local.get(["dictatorRules"], (result) => {
          let rules = result.dictatorRules || {};
          if (rules[domain] && rules[domain][idx]) {
            const rule = rules[domain][idx];
            try { document.querySelectorAll(rule.selector).forEach(el => el.style.removeProperty("display")); } catch(e) {}
            rules[domain].splice(idx, 1);
            if (rules[domain].length === 0) delete rules[domain];
            chrome.storage.local.set({ dictatorRules: rules }, () => {
              renderDBPanel(panel);
              if (window.webOmniShowToast) window.webOmniShowToast("↩ 元素已恢复", "success");
            });
          }
        });
      });
    });

    panel.querySelectorAll(".wo-db-rule-actions .delete").forEach(btn => {
      btn.addEventListener("click", () => {
        const domain = btn.dataset.domain;
        const idx = parseInt(btn.dataset.idx);
        chrome.storage.local.get(["dictatorRules"], (result) => {
          let rules = result.dictatorRules || {};
          if (rules[domain]) {
            rules[domain].splice(idx, 1);
            if (rules[domain].length === 0) delete rules[domain];
            chrome.storage.local.set({ dictatorRules: rules }, () => {
              renderDBPanel(panel);
              if (window.webOmniShowToast) window.webOmniShowToast("已删除一条规则", "info");
            });
          }
        });
      });
    });
  }

  // 页面加载时自动应用已保存的规则
  function applyStoredRules() {
    const domain = location.hostname;
    chrome.storage.local.get(["dictatorRules"], (result) => {
      let rules = result.dictatorRules || {};
      if (rules[domain]) {
        let applied = 0;
        rules[domain].forEach(rule => {
          try {
            document.querySelectorAll(rule.selector).forEach(el => { el.style.display = "none"; applied++; });
          } catch(e) {}
        });
        if (applied > 0) console.log(`【Web-Omni】自动隐藏了 ${applied} 个已标记元素`);
      }
    });
  }
  setTimeout(applyStoredRules, 800);

  // MutationObserver 动态防御
  const observer = new MutationObserver(() => {
    const domain = location.hostname;
    chrome.storage.local.get(["dictatorRules"], (result) => {
      let rules = result.dictatorRules || {};
      if (rules[domain]) {
        rules[domain].forEach(rule => {
          try {
            document.querySelectorAll(rule.selector).forEach(el => {
              if (el.style.display !== "none") el.style.display = "none";
            });
          } catch(e) {}
        });
      }
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

})();
