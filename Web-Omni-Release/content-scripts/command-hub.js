// Web-Omni 快捷指令中枢 (Command Hub)
// GitHub 风格简约设计 — 无 emoji 纯文字

(function() {
  if (window.webOmniCommandHubInjected) return;
  window.webOmniCommandHubInjected = true;

  // ========== Toast ==========
  function injectToastSystem() {
    if (document.getElementById("web-omni-toast-container")) return;
    const style = document.createElement("style");
    style.textContent = `
      #web-omni-toast-container{position:fixed;top:20px;right:20px;z-index:2147483646;display:flex;flex-direction:column;gap:8px;pointer-events:none;font-family:-apple-system,sans-serif;}
      .web-omni-toast{padding:10px 16px;border-radius:6px;color:#e6edf3;font-size:13px;background:#161b22;border:1px solid #30363d;transform:translateX(120%);transition:transform 0.3s ease,opacity 0.3s;opacity:0;pointer-events:auto;max-width:320px;line-height:1.4;}
      .web-omni-toast.show{transform:translateX(0);opacity:1;}
      .web-omni-toast.hide{transform:translateX(120%);opacity:0;}
      .web-omni-toast.success{border-color:#2ea04366;} .web-omni-toast.warn{border-color:#d2992266;} .web-omni-toast.error{border-color:#f8514966;}
    `;
    document.head.appendChild(style);
    const c = document.createElement("div");
    c.id = "web-omni-toast-container";
    document.body.appendChild(c);
  }

  window.webOmniShowToast = function(message, type, duration) {
    type = type || "info";
    duration = duration || 2500;
    injectToastSystem();
    const c = document.getElementById("web-omni-toast-container");
    const t = document.createElement("div");
    t.className = "web-omni-toast " + type;
    t.textContent = message;
    c.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add("show")));
    setTimeout(() => { t.classList.remove("show"); t.classList.add("hide"); setTimeout(() => t.remove(), 300); }, duration);
  };

  // ========== 分类指令 ==========
  const CATEGORIES = [
    {
      name: "视觉掌控", tab: "视觉", color: "#f59e0b", commands: [
        { action: "ACTIVATE_VISUAL_DICTATOR", label: "元素消除", desc: "点击消除页面元素", keywords: ["去广告","广告","删除","消除"] },
        { action: "OPEN_DICTATOR_DB", label: "规则管理", desc: "查看/恢复已消除元素", keywords: ["规则","恢复","管理"] },
      ]
    },
    {
      name: "数据收割", tab: "数据", color: "#3b82f6", commands: [
        { action: "EXTRACT_MEDIA", label: "提取图片/视频", desc: "嗅探页面媒体资源", keywords: ["图片","视频","media","image"] },
        { action: "ECOMMERCE_SCRAPE", label: "电商图片爬取", desc: "淘宝/京东/1688 批量取图", keywords: ["淘宝","京东","sku","电商"] },
        { action: "EXTRACT_MARKDOWN", label: "剪藏Markdown", desc: "正文转Markdown", keywords: ["剪藏","markdown","笔记"] },
        { action: "ACTIVATE_DATA_HARVESTER", label: "框选提取", desc: "框选文本或表格", keywords: ["框选","表格","csv"] },
      ]
    },
    {
      name: "比价工具", tab: "比价", color: "#f97316", commands: [
        { action: "PRICE_COMPARE", label: "多平台比价", desc: "淘宝/京东/拼多多/1688 比价", keywords: ["比价","价格","淘宝","京东","拼多多","对比"] },
      ]
    },
    {
      name: "密码管理", tab: "密码", color: "#8b5cf6", commands: [
        { action: "OPEN_VAULT", label: "密码金库", desc: "AES-256加密保险箱", keywords: ["密码","金库","vault","安全"] },
        { action: "PASSWORD_GENERATOR", label: "密码生成器", desc: "生成强随机密码", keywords: ["生成","随机","密码"] },
        { action: "VAULT_AUTO_FILL", label: "一键填充", desc: "自动填充登录信息", keywords: ["填充","登录","autofill"] },
        { action: "VAULT_AUTO_SAVE", label: "自动保存", desc: "检测并保存新密码", keywords: ["保存","检测","save"] },
      ]
    },
    {
      name: "隐私保护", tab: "隐私", color: "#10b981", commands: [
        { action: "PRIVACY_SCAN", label: "隐私评分", desc: "扫描页面隐私风险", keywords: ["隐私","评分","扫描","scan","privacy"] },
        { action: "PRIVACY_BLOCK_TRACKERS", label: "追踪器拦截", desc: "检测并移除追踪脚本", keywords: ["追踪","拦截","tracker","block"] },
        { action: "PRIVACY_FINGERPRINT_PROTECT", label: "指纹保护", desc: "Canvas/WebGL/Audio 伪装", keywords: ["指纹","canvas","webgl","fingerprint"] },
        { action: "PRIVACY_WEBRTC_PROTECT", label: "WebRTC 防护", desc: "防止 IP 泄露", keywords: ["webrtc","ip","泄露","防护"] },
        { action: "PRIVACY_STRIP_REFERRER", label: "清除 Referrer", desc: "阻止来源追踪", keywords: ["referrer","来源"] },
        { action: "PRIVACY_CLEAR_COOKIES", label: "清除 Cookie", desc: "删除当前页 Cookie", keywords: ["cookie","清除"] },
        { action: "PRIVACY_CLEAN_TRACES", label: "一键清痕", desc: "清除所有本地存储", keywords: ["清除","痕迹","storage","clean"] },
        { action: "PRIVACY_ANTI_SCREENSHOT", label: "防截图模式", desc: "防止截图/录制", keywords: ["防截图","截图"] },
      ]
    },
    {
      name: "高级爬虫", tab: "爬虫", color: "#06b6d4", commands: [
        { action: "EXTRACT_LINKS", label: "链接批量提取", desc: "按域名分组提取超链接", keywords: ["链接","url","导出"] },
        { action: "EXTRACT_STRUCTURED_DATA", label: "结构化数据", desc: "JSON-LD / OG / Meta", keywords: ["json-ld","seo","meta"] },
        { action: "EXTRACT_CSS_SELECTOR", label: "CSS选择器爬取", desc: "自定义选择器批量提取", keywords: ["css","选择器"] },
        { action: "EXTRACT_EMAIL_PHONE", label: "邮箱电话嗅探", desc: "正则扫描联系方式", keywords: ["邮箱","电话","email"] },
        { action: "EXTRACT_PAGE_SNAPSHOT", label: "页面快照", desc: "页面基础信息统计", keywords: ["快照","统计"] },
        { action: "EXTRACT_PAGE_SOURCE", label: "页面源码", desc: "查看完整HTML源码", keywords: ["源码","html","source"] },
        { action: "EXTRACT_AJAX_URLS", label: "API端点嗅探", desc: "从脚本中提取接口地址", keywords: ["api","ajax","fetch","接口"] },
      ]
    },
    {
      name: "渗透工具", tab: "渗透", color: "#ef4444", commands: [
        { action: "EXTRACT_COOKIES", label: "Cookie提取", desc: "提取当前页Cookie", keywords: ["cookie","会话","session"] },
        { action: "EXTRACT_HIDDEN_FIELDS", label: "隐藏字段/Token", desc: "hidden input 和 CSRF", keywords: ["hidden","csrf","token"] },
        { action: "DUMP_STORAGE", label: "Storage转储", desc: "localStorage/sessionStorage", keywords: ["storage","存储","本地"] },
        { action: "REVEAL_PASSWORDS", label: "密码明文显示", desc: "切换密码框明文/隐藏", keywords: ["密码","password","明文"] },
        { action: "DUMP_JS_GLOBALS", label: "全局变量转储", desc: "提取页面自定义JS变量", keywords: ["js","变量","global","window"] },
        { action: "HIJACK_EVENTS", label: "事件劫持监听", desc: "劫持EventListener记录", keywords: ["事件","劫持","event","hook"] },
        { action: "INTERCEPT_REQUESTS", label: "网络请求拦截", desc: "劫持XHR/Fetch记录请求", keywords: ["网络","请求","xhr","fetch","拦截"] },
        { action: "BROWSER_FINGERPRINT", label: "浏览器指纹", desc: "Canvas/WebGL/Audio 指纹", keywords: ["指纹","fingerprint","canvas","webgl"] },
        { action: "WEBSOCKET_MONITOR", label: "WebSocket监听", desc: "劫持WS收发消息", keywords: ["websocket","ws","实时"] },
        { action: "JS_INJECTOR", label: "JS代码注入", desc: "执行自定义JavaScript", keywords: ["注入","执行","inject","js","代码"] },
        { action: "CANVAS_SPOOF", label: "Canvas伪装", desc: "随机化Canvas指纹", keywords: ["伪装","反追踪","canvas","spoof"] },
      ]
    },
    {
      name: "YouTube", tab: "YT", color: "#dc2626", commands: [
        { action: "YT_SHORTCUTS", label: "快捷工具面板", desc: "截图/倍速/循环/影院", keywords: ["youtube","面板","加速"] },
        { action: "YT_TOGGLE_AD_SKIP", label: "跳过广告", desc: "自动点击跳过按钮", keywords: ["youtube","广告","跳过"] },
        { action: "YT_TOGGLE_LOOP", label: "A-B循环播放", desc: "片段循环", keywords: ["youtube","循环","loop"] },
        { action: "YT_CINEMA_MODE", label: "影院模式", desc: "暗化背景聚焦视频", keywords: ["youtube","影院","关灯"] },
        { action: "YT_SCREENSHOT", label: "视频截图", desc: "截取当前帧PNG", keywords: ["youtube","截图"] },
        { action: "YT_EXTRACT_INFO", label: "视频信息", desc: "标题/频道/标签", keywords: ["youtube","信息"] },
        { action: "YT_EXTRACT_AUDIO", label: "音频流嗅探", desc: "解析底层音频地址", keywords: ["youtube","音频","下载"] },
      ]
    },
    {
      name: "自动化", tab: "自动", color: "#22c55e", commands: [
        { action: "AUTO_FILL", label: "闪电填表", desc: "自动填写表单", keywords: ["填表","form","autofill"] },
      ]
    },
    {
      name: "沉浸阅读", tab: "阅读", color: "#a78bfa", commands: [
        { action: "TOGGLE_DARK_MODE", label: "暗黑模式", desc: "反色滤镜", keywords: ["暗黑","夜间","dark"] },
        { action: "TOGGLE_READER_MODE", label: "阅读器模式", desc: "聚焦正文", keywords: ["阅读","reader"] },
        { action: "BREAK_SEALS", label: "解除复制限制", desc: "恢复右键和选择", keywords: ["复制","右键","限制"] },
      ]
    },
    {
      name: "实用工具", tab: "工具", color: "#64748b", commands: [
        { action: "PAGE_QR_CODE", label: "页面二维码", desc: "生成当前页面二维码", keywords: ["二维码","qr"] },
        { action: "PAGE_PERFORMANCE", label: "性能速查", desc: "加载时间/资源分析", keywords: ["性能","performance"] },
        { action: "PAGE_ANNOTATE", label: "页面标注", desc: "在网页上画画标注", keywords: ["标注","涂鸦","draw"] },
      ]
    },
    {
      name: "效率神器", tab: "效率", color: "#f59e0b", commands: [
        { action: "STICKY_KILL", label: "膏药清理", desc: "一键清除所有悬浮元素 (Alt+S)", keywords: ["悬浮","fixed","sticky","膏药","清理","清除"] },
        { action: "CLEAN_URL_COPY", label: "链接净化", desc: "去除追踪参数并复制", keywords: ["链接","url","追踪","净化","clean","脱水"] },
        { action: "CLEAN_URL_ALL_LINKS", label: "全页链接净化", desc: "清理页面所有超链接", keywords: ["链接","全部","净化"] },
        { action: "INPUT_TM_TOGGLE", label: "输入框保护", desc: "自动保存输入内容/开关", keywords: ["输入","保护","时光机","恢复","保存","input"] },
        { action: "INPUT_TM_SHOW_HISTORY", label: "输入框历史", desc: "查看已保存的输入记录", keywords: ["历史","输入","恢复","history"] },
        { action: "AUDIO_NORMALIZE_TOGGLE", label: "音频均衡", desc: "自动均衡化页面音量", keywords: ["音频","均衡","音量","护耳","compressor"] },
        { action: "AUDIO_NORMALIZE_PANEL", label: "均衡器面板", desc: "调节压缩参数和增益", keywords: ["均衡器","面板","调节","audio"] },
        { action: "ELEMENT_PIP", label: "元素画中画", desc: "提取任意元素为悬浮窗", keywords: ["画中画","pip","悬浮","提取","浮窗"] },
        { action: "DOM_MONITOR_ADD", label: "添加监控", desc: "框选元素加入监控", keywords: ["监控","watch","monitor","盯盘"] },
        { action: "DOM_MONITOR_PANEL", label: "监控仪表盘", desc: "查看所有监控数据", keywords: ["仪表盘","监控","dashboard"] },
      ]
    },
    {
      name: "文件传输", tab: "传输", color: "#6366f1", commands: [
        { action: "LAN_TRANSFER", label: "局域网传输", desc: "WebRTC P2P 文件传输", keywords: ["传文件","局域网","lan","transfer","p2p"] },
      ]
    },
  ];

  // 快捷入口
  const QUICK_ACTIONS = [
    { action: "ACTIVATE_VISUAL_DICTATOR", label: "消除" },
    { action: "STICKY_KILL", label: "清膏药" },
    { action: "CLEAN_URL_COPY", label: "净链" },
    { action: "PRICE_COMPARE", label: "比价" },
    { action: "OPEN_VAULT", label: "密码" },
    { action: "PRIVACY_SCAN", label: "隐私" },
    { action: "ELEMENT_PIP", label: "画中画" },
    { action: "AUDIO_NORMALIZE_TOGGLE", label: "护耳" },
  ];

  let activeTab = "all";
  const collapsedState = {};
  CATEGORIES.forEach(cat => { collapsedState[cat.name] = false; });

  // ========== UI ==========
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "TOGGLE_COMMAND_HUB") toggleCommandHub();
  });

  let hubContainer = null;
  let hubInput = null;

  function buildTabBar() {
    let html = '<button class="wo-tab ' + (activeTab === 'all' ? 'active' : '') + '" data-tab="all">全部</button>';
    CATEGORIES.forEach(cat => {
      html += '<button class="wo-tab ' + (activeTab === cat.name ? 'active' : '') + '" data-tab="' + cat.name + '" title="' + cat.name + '">' + cat.tab + '</button>';
    });
    return html;
  }

  function buildQuickActions() {
    return QUICK_ACTIONS.map(q =>
      '<button class="wo-quick" data-action="' + q.action + '" title="' + q.label + '">'
      + '<span class="wo-quick-label">' + q.label + '</span></button>'
    ).join("");
  }

  function buildListHTML(filterVal) {
    const val = (filterVal || "").toLowerCase().trim();
    let html = "";

    CATEGORIES.forEach(cat => {
      if (activeTab !== "all" && activeTab !== cat.name) return;

      const matchedCmds = cat.commands.filter(cmd => {
        if (!val) return true;
        return (cmd.label + " " + cmd.desc + " " + cmd.keywords.join(" ") + " " + cat.name).toLowerCase().includes(val);
      });
      if (matchedCmds.length === 0) return;

      const isCollapsed = val ? false : collapsedState[cat.name];
      const arrowChar = isCollapsed ? ">" : "v";

      html += '<li class="wo-cmd-category" data-cat="' + cat.name + '">'
        + '<span class="wo-cat-arrow">' + arrowChar + '</span>'
        + '<span class="wo-cat-dot" style="background:' + cat.color + ';"></span>'
        + cat.name
        + '<span class="wo-cat-count">' + matchedCmds.length + '</span></li>';

      if (!isCollapsed) {
        matchedCmds.forEach(cmd => {
          html += '<li class="wo-cmd-item" data-action="' + cmd.action + '">'
            + '<span class="web-omni-cmd-icon" style="font-size:11px;color:#8b949e;">' + cmd.label.substring(0,2) + '</span>'
            + '<span class="wo-cmd-body">'
            + '<span class="web-omni-cmd-text">' + cmd.label + '</span>'
            + '<span class="wo-cmd-desc">' + cmd.desc + '</span>'
            + '</span></li>';
        });
      }
    });
    return html;
  }

  function initCommandHub() {
    hubContainer = document.createElement("div");
    hubContainer.id = "web-omni-command-hub-overlay";

    const totalCmds = CATEGORIES.reduce((s,c) => s + c.commands.length, 0);
    hubContainer.innerHTML = '<div id="web-omni-command-hub">'
      + '<div id="web-omni-command-header">'
      + '<span class="web-omni-logo">Web-Omni</span>'
      + '<span class="web-omni-hint">ESC 关闭</span></div>'
      + '<div id="web-omni-quick-bar">' + buildQuickActions() + '</div>'
      + '<input type="text" id="web-omni-command-input" placeholder="搜索功能... (' + totalCmds + ' 个命令)" autocomplete="off">'
      + '<div id="web-omni-tab-bar">' + buildTabBar() + '</div>'
      + '<ul id="web-omni-command-results">' + buildListHTML("") + '</ul>'
      + '<div id="web-omni-hub-footer"><span>Up/Down 导航</span><span>Enter 执行</span><span>Tab 切换</span></div></div>';

    document.body.appendChild(hubContainer);

    hubInput = document.getElementById("web-omni-command-input");
    const resultsList = document.getElementById("web-omni-command-results");
    const tabBar = document.getElementById("web-omni-tab-bar");

    hubContainer.addEventListener("click", (e) => {
      if (e.target === hubContainer) toggleCommandHub();
    });

    hubInput.addEventListener("input", (e) => {
      resultsList.innerHTML = buildListHTML(e.target.value);
      selectedIndex = -1;
    });

    tabBar.addEventListener("click", (e) => {
      const tab = e.target.closest(".wo-tab");
      if (!tab) return;
      activeTab = tab.dataset.tab;
      tabBar.innerHTML = buildTabBar();
      resultsList.innerHTML = buildListHTML(hubInput.value);
      selectedIndex = -1;
    });

    let selectedIndex = -1;
    function getActionItems() { return Array.from(resultsList.querySelectorAll(".wo-cmd-item")); }

    hubInput.addEventListener("keydown", (e) => {
      const items = getActionItems();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % items.length;
        items.forEach((el, i) => el.classList.toggle("selected", i === selectedIndex));
        if (items[selectedIndex]) items[selectedIndex].scrollIntoView({ block: "nearest" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + items.length) % items.length;
        items.forEach((el, i) => el.classList.toggle("selected", i === selectedIndex));
        if (items[selectedIndex]) items[selectedIndex].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedIndex >= 0 && items[selectedIndex]) executeAction(items[selectedIndex].dataset.action);
        else if (items.length > 0) executeAction(items[0].dataset.action);
      } else if (e.key === "Escape") {
        e.preventDefault(); toggleCommandHub();
      } else if (e.key === "Tab") {
        e.preventDefault();
        const tabNames = ["all"].concat(CATEGORIES.map(c => c.name));
        const idx = tabNames.indexOf(activeTab);
        activeTab = tabNames[(idx + 1) % tabNames.length];
        tabBar.innerHTML = buildTabBar();
        resultsList.innerHTML = buildListHTML(hubInput.value);
        selectedIndex = -1;
      }
    });

    resultsList.addEventListener("click", (e) => {
      const catEl = e.target.closest(".wo-cmd-category");
      if (catEl) {
        collapsedState[catEl.dataset.cat] = !collapsedState[catEl.dataset.cat];
        resultsList.innerHTML = buildListHTML(hubInput.value);
        return;
      }
      const li = e.target.closest(".wo-cmd-item");
      if (li && li.dataset.action) executeAction(li.dataset.action);
    });

    document.getElementById("web-omni-quick-bar").addEventListener("click", (e) => {
      const btn = e.target.closest(".wo-quick");
      if (btn && btn.dataset.action) executeAction(btn.dataset.action);
    });
  }

  function executeAction(actionName) {
    toggleCommandHub();
    chrome.runtime.sendMessage({ action: actionName });
  }

  function toggleCommandHub() {
    if (!hubContainer) initCommandHub();
    const isVisible = hubContainer.style.display === "flex";
    if (isVisible) {
      hubContainer.style.opacity = 0;
      setTimeout(() => { hubContainer.style.display = "none"; }, 200);
    } else {
      hubContainer.style.display = "flex";
      setTimeout(() => {
        hubContainer.style.opacity = 1;
        hubInput.value = "";
        hubInput.focus();
        activeTab = "all";
        document.getElementById("web-omni-tab-bar").innerHTML = buildTabBar();
        document.getElementById("web-omni-command-results").innerHTML = buildListHTML("");
      }, 10);
    }
  }

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'k') {
      e.preventDefault(); toggleCommandHub();
    }
  });

  // ========== 首次运行：隐私协议 + 使用说明弹窗 ==========
  async function checkFirstRun() {
    const data = await chrome.storage.local.get(['woFirstRun', 'woAgreed']);
    if (data.woFirstRun && !data.woAgreed) {
      showWelcomePopup();
    }
  }

  function showWelcomePopup() {
    const ov = document.createElement('div');
    ov.id = 'wo-welcome-overlay';
    ov.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(1,4,9,0.85);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;backdrop-filter:blur(4px);';

    ov.innerHTML = '<div style="background:#161b22;border:1px solid #30363d;border-radius:10px;width:520px;max-height:85vh;overflow-y:auto;color:#e6edf3;box-shadow:0 16px 48px rgba(0,0,0,0.5);">'
      // Header
      + '<div style="padding:24px 24px 16px;border-bottom:1px solid #21262d;">'
      + '<h2 style="font-size:20px;font-weight:700;margin:0 0 4px;">Web-Omni v4.0</h2>'
      + '<p style="font-size:13px;color:#8b949e;margin:0;">全能网页增强工具</p></div>'

      // Content
      + '<div style="padding:20px 24px;">'

      // 快速入门
      + '<h3 style="font-size:14px;font-weight:600;margin:0 0 10px;color:#f0f6fc;">快速入门</h3>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:18px;">'
      + '<div style="background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:10px;">'
      + '<div style="font-size:12px;font-weight:600;margin-bottom:3px;">Ctrl+Shift+K</div>'
      + '<div style="font-size:11px;color:#8b949e;">打开指令中枢 (Command Hub)</div></div>'
      + '<div style="background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:10px;">'
      + '<div style="font-size:12px;font-weight:600;margin-bottom:3px;">Alt+S</div>'
      + '<div style="font-size:11px;color:#8b949e;">一键清除悬浮膏药元素</div></div>'
      + '<div style="background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:10px;">'
      + '<div style="font-size:12px;font-weight:600;margin-bottom:3px;">右键菜单</div>'
      + '<div style="font-size:11px;color:#8b949e;">右键 → Web-Omni 子菜单</div></div>'
      + '<div style="background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:10px;">'
      + '<div style="font-size:12px;font-weight:600;margin-bottom:3px;">工具栏图标</div>'
      + '<div style="font-size:11px;color:#8b949e;">点击图标打开指令中枢</div></div>'
      + '</div>'

      // 功能亮点
      + '<h3 style="font-size:14px;font-weight:600;margin:0 0 8px;color:#f0f6fc;">核心功能</h3>'
      + '<div style="font-size:12px;color:#c9d1d9;line-height:1.8;margin-bottom:16px;">'
      + '<div style="display:flex;gap:6px;margin-bottom:3px;"><span style="color:#58a6ff;min-width:60px;">视觉掌控</span><span>元素消除、暗黑模式、膏药清理、阅读器</span></div>'
      + '<div style="display:flex;gap:6px;margin-bottom:3px;"><span style="color:#3fb950;min-width:60px;">数据收割</span><span>图片视频嗅探、电商批量取图、框选提取</span></div>'
      + '<div style="display:flex;gap:6px;margin-bottom:3px;"><span style="color:#f97316;min-width:60px;">效率神器</span><span>输入框保护、音频均衡、画中画、链接净化</span></div>'
      + '<div style="display:flex;gap:6px;margin-bottom:3px;"><span style="color:#a78bfa;min-width:60px;">安全隐私</span><span>密码管理、隐私评分、指纹防护、DOM监控</span></div>'
      + '<div style="display:flex;gap:6px;"><span style="color:#6366f1;min-width:60px;">文件传输</span><span>WebRTC P2P 局域网扫码传文件</span></div>'
      + '</div>'

      // 隐私协议
      + '<h3 style="font-size:14px;font-weight:600;margin:0 0 8px;color:#f0f6fc;">隐私协议</h3>'
      + '<div style="background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:12px;font-size:11px;color:#8b949e;line-height:1.7;max-height:140px;overflow-y:auto;margin-bottom:16px;">'
      + '<p style="margin:0 0 6px;"><strong style="color:#c9d1d9;">数据存储</strong>：所有数据（密码、设置、监控项、历史记录）仅存储在你本地浏览器的 chrome.storage.local 中，不会上传到任何服务器。</p>'
      + '<p style="margin:0 0 6px;"><strong style="color:#c9d1d9;">网络通信</strong>：局域网传输使用 WebRTC P2P 直连，数据不经过第三方存储。PeerJS 信令服务器仅用于建立连接，不传输文件内容。</p>'
      + '<p style="margin:0 0 6px;"><strong style="color:#c9d1d9;">密码安全</strong>：密码管理器使用 AES-256-GCM 加密 + PBKDF2 (600,000次迭代) 派生密钥，主密码永不存储。</p>'
      + '<p style="margin:0 0 6px;"><strong style="color:#c9d1d9;">权限说明</strong>：本扩展申请 &lt;all_urls&gt; 权限以在所有网页上运行内容脚本。storage 用于本地数据存储；downloads 用于保存文件；alarms 用于 DOM 监控定时检查；notifications 用于监控提醒。</p>'
      + '<p style="margin:0;"><strong style="color:#c9d1d9;">开源透明</strong>：所有代码逻辑均可在扩展源文件中直接查看审计，不包含任何混淆或远程加载的可执行代码。</p>'
      + '</div>'

      + '</div>'

      // Footer
      + '<div style="padding:16px 24px;border-top:1px solid #21262d;display:flex;justify-content:space-between;align-items:center;">'
      + '<span style="font-size:11px;color:#484f58;">继续即表示你已阅读并同意以上隐私协议</span>'
      + '<button id="wo-agree-btn" style="padding:8px 24px;background:#238636;border:1px solid #2ea043;color:#fff;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">同意并开始使用</button>'
      + '</div></div>';

    document.body.appendChild(ov);

    document.getElementById('wo-agree-btn').addEventListener('click', () => {
      chrome.storage.local.set({ woAgreed: true, woFirstRun: false });
      ov.style.opacity = '0';
      ov.style.transition = 'opacity 0.3s';
      setTimeout(() => ov.remove(), 300);
    });
  }

  // 延迟检查首次运行
  setTimeout(checkFirstRun, 1500);

})();
