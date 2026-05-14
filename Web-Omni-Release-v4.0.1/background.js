// Web-Omni v4.0.1 Background Service Worker (Patched)
console.log("Web-Omni v4.0.1 Background Worker 启动");

// ========== 工具：判断 URL 是否可注入 ==========
function isInjectablePage(url) {
  if (!url || typeof url !== "string") return false;
  const blocked = ["chrome://", "chrome-extension://", "edge://", "about:", "moz-extension://", "view-source:"];
  for (const p of blocked) if (url.startsWith(p)) return false;
  // chrome web store / edge addons
  if (url.startsWith("https://chrome.google.com/webstore") ||
      url.startsWith("https://chromewebstore.google.com") ||
      url.startsWith("https://microsoftedge.microsoft.com/addons")) return false;
  return true;
}

// ========== 安全发送：忽略 receiver 不存在的错误 ==========
function safeSendToTab(tabId, msg) {
  try {
    chrome.tabs.sendMessage(tabId, msg, () => {
      if (chrome.runtime.lastError) { /* swallow */ }
    });
  } catch (e) { /* tab may be closing */ }
}

// ========== 统一消息分发（合并多个 listener，避免 sendResponse 失活） ==========
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // ---- 1. Content script -> command 分发到当前 tab ----
  // 仅当消息来自 content script (有 sender.tab) 且 action 不是该 tab 自己刚处理的，才广播。
  // 为避免环路：只允许 popup / extension 页面（无 sender.tab）触发广播
  // 如果是 content script 发来的 action，且未带 _routed 标记，则直接转给所在 tab（用于 command-hub 触发各功能）
  if (request && request.action && typeof request.action === "string") {
    if (sender.tab) {
      // 来自 content script：转发给同一 tab 的其他 content script
      if (!request._wo_routed) {
        safeSendToTab(sender.tab.id, { ...request, _wo_routed: true });
      }
    } else {
      // 来自 popup / extension page：广播到当前活动 tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && isInjectablePage(tabs[0].url)) {
          safeSendToTab(tabs[0].id, { ...request, _wo_routed: true });
        }
      });
    }
  }

  // ---- 2. DOM Monitor 启动 ----
  if (request && request.type === "DOM_MONITOR_START") {
    chrome.alarms.create("wo-dom-monitor", { periodInMinutes: 5 });
  }

  // ---- 3. 简单文件下载（content script 已能拿到 URL） ----
  if (request && request.type === "DOWNLOAD_FILE") {
    chrome.downloads.download({
      url: request.url,
      filename: request.filename || undefined,
      saveAs: false
    }, () => { if (chrome.runtime.lastError) { /* ignore */ } });
  }

  // ---- 4. 图片代理下载（绕过防盗链） ----
  // 修复：MV3 SW 不支持 data:/blob: 直接下载到 chrome.downloads。
  // 改为：service worker 用 fetch 拿到 blob 后用 chrome.downloads + URL.createObjectURL（SW 中可用）。
  // 若 createObjectURL 在 SW 中不可用（部分 Chrome 版本），降级为让 content script 重试。
  if (request && request.type === "PROXY_DOWNLOAD") {
    (async () => {
      try {
        const headers = new Headers({
          "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        });
        if (request.referer) headers.append("Referer", request.referer);
        const resp = await fetch(request.url, {
          headers,
          referrerPolicy: "no-referrer",
          mode: "cors",
          credentials: "omit",
        });
        if (!resp.ok) throw new Error("fetch_failed_" + resp.status);
        const blob = await resp.blob();

        // 优先 createObjectURL（Chrome 102+ SW 支持）
        let objUrl = null;
        try {
          objUrl = URL.createObjectURL(blob);
        } catch (e) { objUrl = null; }

        if (objUrl) {
          chrome.downloads.download({
            url: objUrl,
            filename: request.filename || "image.jpg",
            saveAs: false,
          }, (id) => {
            // 5 秒后释放，给下载足够时间消费
            setTimeout(() => { try { URL.revokeObjectURL(objUrl); } catch(e){} }, 60000);
            if (chrome.runtime.lastError) {
              // 兜底：直接用原 URL
              chrome.downloads.download({
                url: request.url,
                filename: request.filename || undefined,
                saveAs: false,
              });
            }
          });
          return;
        }

        // 降级：把 blob 作为 base64 dataURL 让 content script 自己下载
        const reader = new FileReader();
        reader.onloadend = () => {
          if (sender.tab) {
            safeSendToTab(sender.tab.id, {
              type: "PROXY_DOWNLOAD_FALLBACK",
              dataUrl: reader.result,
              filename: request.filename || "image.jpg",
              originalUrl: request.url,
            });
          }
        };
        reader.readAsDataURL(blob);
      } catch (e) {
        // 最终兜底：直接下载原 URL（可能被防盗链拦截，由用户感知）
        chrome.downloads.download({
          url: request.url,
          filename: request.filename || undefined,
          saveAs: false,
        }, () => { if (chrome.runtime.lastError) { /* ignore */ } });
      }
    })();
    return true; // 保活（理论上无 sendResponse，但保险）
  }
});

// ========== 快捷键 Ctrl+Shift+K ==========
chrome.commands.onCommand.addListener((command) => {
  if (command !== "toggle-command-hub") return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const t = tabs[0];
    if (t && isInjectablePage(t.url)) {
      safeSendToTab(t.id, { action: "TOGGLE_COMMAND_HUB", _wo_routed: true });
    }
  });
});

// ========== 工具栏图标点击 ==========
chrome.action.onClicked.addListener((tab) => {
  if (!tab || !isInjectablePage(tab.url)) {
    // 提示需要 host 权限或换个普通页面
    chrome.notifications && chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: "Web-Omni",
      message: "当前页面不支持注入（chrome://、扩展商店等系统页面）"
    }, () => { if (chrome.runtime.lastError) { /* ignore */ } });
    return;
  }
  safeSendToTab(tab.id, { action: "TOGGLE_COMMAND_HUB", _wo_routed: true });
});

// ========== 安装 / 更新事件 ==========
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.local.set({ woFirstRun: true, woVersion: "4.0.1" });
  } else if (details.reason === "update") {
    chrome.storage.local.set({ woVersion: "4.0.1", woUpdated: true });
  }

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "wo-root", title: "Web-Omni", contexts: ["all"] });

    const menus = [
      { id: "wo-dictator", title: "元素消除" },
      { id: "wo-sticky",   title: "清除悬浮膏药 (Alt+S)" },
      { id: "wo-dark",     title: "暗黑模式" },
      { id: "wo-reader",   title: "阅读器模式" },
      { id: "wo-seals",    title: "解除复制限制" },
      { id: "wo-sep1",     type: "separator" },
      { id: "wo-media",    title: "提取图片/视频" },
      { id: "wo-harvest",  title: "框选提取" },
      { id: "wo-markdown", title: "剪藏 Markdown" },
      { id: "wo-ecommerce",title: "电商图片爬取" },
      { id: "wo-price",    title: "跨平台比价" },
      { id: "wo-sep2",     type: "separator" },
      { id: "wo-clean-url",title: "复制干净链接" },
      { id: "wo-pip",      title: "提取为画中画" },
      { id: "wo-audio",    title: "音频均衡 (护耳)" },
      { id: "wo-input-tm", title: "输入框保护 开/关" },
      { id: "wo-sep3",     type: "separator" },
      { id: "wo-vault",    title: "密码金库" },
      { id: "wo-privacy",  title: "隐私评分扫描" },
      { id: "wo-transfer", title: "局域网传输" },
    ];
    menus.forEach((m) => {
      chrome.contextMenus.create({
        id: m.id,
        parentId: "wo-root",
        title: m.title,
        type: m.type || "normal",
        contexts: ["all"]
      });
    });
  });
});

// ========== 右键菜单点击 ==========
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const map = {
    "wo-dictator":  "ACTIVATE_VISUAL_DICTATOR",
    "wo-sticky":    "STICKY_KILL",
    "wo-dark":      "TOGGLE_DARK_MODE",
    "wo-reader":    "TOGGLE_READER_MODE",
    "wo-seals":     "BREAK_SEALS",
    "wo-media":     "EXTRACT_MEDIA",
    "wo-harvest":   "ACTIVATE_DATA_HARVESTER",
    "wo-markdown":  "EXTRACT_MARKDOWN",
    "wo-ecommerce": "ECOMMERCE_SCRAPE",
    "wo-price":     "PRICE_COMPARE",
    "wo-clean-url": "CLEAN_URL_COPY",
    "wo-pip":       "ELEMENT_PIP",
    "wo-audio":     "AUDIO_NORMALIZE_TOGGLE",
    "wo-input-tm":  "INPUT_TM_TOGGLE",
    "wo-vault":     "OPEN_VAULT",
    "wo-privacy":   "PRIVACY_SCAN",
    "wo-transfer":  "LAN_TRANSFER",
  };
  const action = map[info.menuItemId];
  if (action && tab && isInjectablePage(tab.url)) {
    safeSendToTab(tab.id, { action, _wo_routed: true });
  }
});

// ========== Alarm: DOM Monitor 周期检查 ==========
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "wo-dom-monitor") return;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && isInjectablePage(tabs[0].url)) {
      safeSendToTab(tabs[0].id, { action: "DOM_MONITOR_CHECK", _wo_routed: true });
    }
  } catch (e) { /* ignore */ }
});
