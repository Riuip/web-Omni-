// 神经末梢：沉浸式阅读与魔改 (Immersive Modding)
// 强行暗黑模式、极简阅读器、解除封印反反复制

(function() {
  if (window.webOmniImmersiveModdingInjected) return;
  window.webOmniImmersiveModdingInjected = true;

  let isDarkMode = false;
  let isReaderMode = false;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "TOGGLE_DARK_MODE") toggleDarkMode();
    else if (request.action === "TOGGLE_READER_MODE") toggleReaderMode();
    else if (request.action === "BREAK_SEALS") breakSeals();
  });

  function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.documentElement.classList.toggle("web-omni-force-dark");
    if (window.webOmniShowToast) {
      window.webOmniShowToast(isDarkMode ? "🌙 暗黑模式已开启" : "☀️ 暗黑模式已关闭", "success");
    }
  }

  function toggleReaderMode() {
    isReaderMode = !isReaderMode;
    if (isReaderMode) {
      // 隐藏非正文元素
      document.querySelectorAll("nav, aside, footer, header, .sidebar, .ad, .ads, .advertisement, [role='banner'], [role='navigation'], [role='complementary']").forEach(el => {
        if (!el.closest("article, main, [role='main']")) {
          el.dataset.webOmniHidden = "true";
          el.style.setProperty("display", "none", "important");
        }
      });
      document.body.classList.add("web-omni-reader-mode");
      if (window.webOmniShowToast) window.webOmniShowToast("📖 阅读器模式已开启", "success");
    } else {
      document.querySelectorAll("[data-web-omni-hidden]").forEach(el => {
        el.style.removeProperty("display");
        delete el.dataset.webOmniHidden;
      });
      document.body.classList.remove("web-omni-reader-mode");
      if (window.webOmniShowToast) window.webOmniShowToast("📖 阅读器模式已关闭", "info");
    }
  }

  function breakSeals() {
    // 阻止页面的反复制/反右键事件
    const events = ['contextmenu','copy','paste','cut','selectstart','dragstart','mousedown','mouseup'];
    events.forEach(eventName => {
      document.addEventListener(eventName, function(e) { e.stopPropagation(); }, true);
    });

    // 清除行内禁用事件
    document.body.oncontextmenu = null;
    document.body.onselectstart = null;
    document.body.ondragstart = null;
    document.body.oncopy = null;
    document.body.oncut = null;
    document.body.onpaste = null;

    // 递归清除所有元素的禁用事件
    document.querySelectorAll("*").forEach(el => {
      el.oncontextmenu = null;
      el.onselectstart = null;
      el.oncopy = null;
    });

    // 注入解禁 CSS
    const style = document.createElement('style');
    style.id = "web-omni-break-seals-css";
    style.textContent = `
      * {
        user-select: auto !important;
        -webkit-user-select: auto !important;
        -ms-user-select: auto !important;
        -moz-user-select: auto !important;
        -webkit-touch-callout: default !important;
      }
    `;
    if (!document.getElementById("web-omni-break-seals-css")) {
      document.head.appendChild(style);
    }

    if (window.webOmniShowToast) window.webOmniShowToast("🔓 页面限制已解除！右键、复制、选择全部恢复", "success");
  }
})();
