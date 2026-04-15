// Web-Omni v4.0 Background Service Worker
console.log("Web-Omni v4.0 Background Worker 启动");

// ========== 核心：消息中继路由 ==========
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (sender.tab && request.action) {
    chrome.tabs.sendMessage(sender.tab.id, request);
  }
});

// Ctrl+Shift+K 呼出 Command Hub
chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-command-hub") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) chrome.tabs.sendMessage(tabs[0].id, { action: "TOGGLE_COMMAND_HUB" });
    });
  }
});

// 右上角图标点击
chrome.action.onClicked.addListener((tab) => {
  if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:")) return;
  chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_COMMAND_HUB" });
});

// ========== 安装/更新事件 ==========
chrome.runtime.onInstalled.addListener((details) => {
  // 首次安装：标记需要显示欢迎弹窗
  if (details.reason === 'install') {
    chrome.storage.local.set({ woFirstRun: true, woVersion: '4.0.0' });
  }
  // 更新：标记新版本
  if (details.reason === 'update') {
    chrome.storage.local.set({ woVersion: '4.0.0', woUpdated: true });
  }

  // 创建右键菜单（分组）
  chrome.contextMenus.removeAll(() => {
    const parent = { id: "wo-root", title: "Web-Omni", contexts: ["all"] };
    chrome.contextMenus.create(parent);

    const menus = [
      // 视觉
      { id: "wo-dictator", parentId: "wo-root", title: "元素消除" },
      { id: "wo-sticky", parentId: "wo-root", title: "清除悬浮膏药 (Alt+S)" },
      { id: "wo-dark", parentId: "wo-root", title: "暗黑模式" },
      { id: "wo-reader", parentId: "wo-root", title: "阅读器模式" },
      { id: "wo-seals", parentId: "wo-root", title: "解除复制限制" },
      { type: "separator", id: "wo-sep1", parentId: "wo-root" },
      // 数据
      { id: "wo-media", parentId: "wo-root", title: "提取图片/视频" },
      { id: "wo-harvest", parentId: "wo-root", title: "框选提取" },
      { id: "wo-markdown", parentId: "wo-root", title: "剪藏 Markdown" },
      { id: "wo-ecommerce", parentId: "wo-root", title: "电商图片爬取" },
      { id: "wo-price", parentId: "wo-root", title: "跨平台比价" },
      { type: "separator", id: "wo-sep2", parentId: "wo-root" },
      // 效率
      { id: "wo-clean-url", parentId: "wo-root", title: "复制干净链接" },
      { id: "wo-pip", parentId: "wo-root", title: "提取为画中画" },
      { id: "wo-audio", parentId: "wo-root", title: "音频均衡 (护耳)" },
      { id: "wo-input-tm", parentId: "wo-root", title: "输入框保护 开/关" },
      { type: "separator", id: "wo-sep3", parentId: "wo-root" },
      // 安全
      { id: "wo-vault", parentId: "wo-root", title: "密码金库" },
      { id: "wo-privacy", parentId: "wo-root", title: "隐私评分扫描" },
      { id: "wo-transfer", parentId: "wo-root", title: "局域网传输" },
    ];

    menus.forEach(m => {
      chrome.contextMenus.create({
        id: m.id,
        parentId: m.parentId,
        title: m.title,
        type: m.type || "normal",
        contexts: ["all"]
      });
    });
  });
});

// 右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const map = {
    "wo-dictator": "ACTIVATE_VISUAL_DICTATOR",
    "wo-sticky": "STICKY_KILL",
    "wo-dark": "TOGGLE_DARK_MODE",
    "wo-reader": "TOGGLE_READER_MODE",
    "wo-seals": "BREAK_SEALS",
    "wo-media": "EXTRACT_MEDIA",
    "wo-harvest": "ACTIVATE_DATA_HARVESTER",
    "wo-markdown": "EXTRACT_MARKDOWN",
    "wo-ecommerce": "ECOMMERCE_SCRAPE",
    "wo-price": "PRICE_COMPARE",
    "wo-clean-url": "CLEAN_URL_COPY",
    "wo-pip": "ELEMENT_PIP",
    "wo-audio": "AUDIO_NORMALIZE_TOGGLE",
    "wo-input-tm": "INPUT_TM_TOGGLE",
    "wo-vault": "OPEN_VAULT",
    "wo-privacy": "PRIVACY_SCAN",
    "wo-transfer": "LAN_TRANSFER",
  };
  const action = map[info.menuItemId];
  if (action && tab) chrome.tabs.sendMessage(tab.id, { action });
});

// ========== DOM Monitor: 定时轮询 ==========
chrome.runtime.onMessage.addListener((request) => {
  if (request.type === 'DOM_MONITOR_START') {
    chrome.alarms.create('wo-dom-monitor', { periodInMinutes: 5 });
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'wo-dom-monitor') return;
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length > 0) chrome.tabs.sendMessage(tabs[0].id, { action: 'DOM_MONITOR_CHECK' });
});

// ========== 下载代理 ==========
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "DOWNLOAD_FILE") {
    chrome.downloads.download({ url: request.url, filename: request.filename || undefined, saveAs: false });
  }
  if (request.type === "PROXY_DOWNLOAD") {
    (async () => {
      try {
        const headers = new Headers({ "Accept": "image/webp,image/apng,image/*,*/*;q=0.8" });
        if (request.referer) headers.append("Referer", request.referer);
        const resp = await fetch(request.url, { headers, referrerPolicy: "no-referrer", mode: "cors", credentials: "omit" });
        if (!resp.ok) throw new Error("fetch failed " + resp.status);
        const blob = await resp.blob();
        const reader = new FileReader();
        reader.onloadend = function() {
          chrome.downloads.download({ url: reader.result, filename: request.filename || "image.jpg", saveAs: false });
        };
        reader.readAsDataURL(blob);
      } catch(e) {
        chrome.downloads.download({ url: request.url, filename: request.filename || undefined, saveAs: false });
      }
    })();
  }
});
