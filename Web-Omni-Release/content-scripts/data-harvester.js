// 神经末梢：数据收割机 (Data Harvester)
// 智能框选提取、媒体嗅探与扒取、Markdown 一键剪藏、高级爬虫

(function() {
  if (window.webOmniDataHarvesterInjected) return;
  window.webOmniDataHarvesterInjected = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case "ACTIVATE_DATA_HARVESTER": activateSmartSelection(); break;
      case "EXTRACT_MEDIA": extractMedia(); break;
      case "EXTRACT_MARKDOWN": extractMarkdown(); break;
      case "EXTRACT_LINKS": extractLinks(); break;
      case "EXTRACT_STRUCTURED_DATA": extractStructuredData(); break;
      case "EXTRACT_CSS_SELECTOR": promptCssExtraction(); break;
      case "EXTRACT_EMAIL_PHONE": extractEmailPhone(); break;
      case "EXTRACT_PAGE_SNAPSHOT": extractPageSnapshot(); break;
      case "EXTRACT_PAGE_SOURCE": extractPageSource(); break;
      case "EXTRACT_COOKIES": extractCookies(); break;
      case "EXTRACT_HIDDEN_FIELDS": extractHiddenFields(); break;
      case "EXTRACT_AJAX_URLS": extractAjaxUrls(); break;
      case "DUMP_STORAGE": dumpStorage(); break;
      case "REVEAL_PASSWORDS": revealPasswords(); break;
      case "DUMP_JS_GLOBALS": dumpJsGlobals(); break;
      case "HIJACK_EVENTS": hijackEvents(); break;
      case "INTERCEPT_REQUESTS": interceptRequests(); break;
      case "BROWSER_FINGERPRINT": browserFingerprint(); break;
      case "WEBSOCKET_MONITOR": websocketMonitor(); break;
      case "JS_INJECTOR": jsInjector(); break;
      case "CANVAS_SPOOF": canvasSpoof(); break;
    }
  });

  // =============== 通用侧栏结果面板 ===============
  function showResultPanel(title, bodyHTML) {
    let existing = document.getElementById('wo-result-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'wo-result-panel';
    panel.style.cssText = `
      position:fixed;top:0;right:0;width:420px;height:100vh;z-index:2147483646;
      background:#1a1a1a;border-left:1px solid #333;
      overflow-y:auto;font-family:system-ui,-apple-system,sans-serif;
      color:#ccc;transform:translateX(100%);transition:transform 0.25s ease;
    `;

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #2a2a2a;position:sticky;top:0;background:#1a1a1a;z-index:2;">
        <b style="font-size:14px;color:#eee;">${title}</b>
        <div style="display:flex;gap:8px;">
          <button id="wo-rp-copy" style="background:#252525;border:1px solid #3a3a3a;color:#aaa;padding:4px 10px;border-radius:5px;cursor:pointer;font-size:12px;">复制全部</button>
          <button id="wo-rp-close" style="background:#252525;border:1px solid #3a3a3a;color:#aaa;padding:4px 8px;border-radius:5px;cursor:pointer;font-size:12px;">✕</button>
        </div>
      </div>
      <div id="wo-rp-body" style="padding:12px 16px;font-size:13px;line-height:1.7;">${bodyHTML}</div>
    `;

    document.body.appendChild(panel);
    requestAnimationFrame(() => requestAnimationFrame(() => panel.style.transform = 'translateX(0)'));

    panel.querySelector('#wo-rp-close').onclick = () => {
      panel.style.transform = 'translateX(100%)';
      setTimeout(() => panel.remove(), 250);
    };
    panel.querySelector('#wo-rp-copy').onclick = () => {
      const text = panel.querySelector('#wo-rp-body').innerText;
      navigator.clipboard.writeText(text).then(() => {
        if (window.webOmniShowToast) window.webOmniShowToast("已复制到剪贴板", "success");
      });
    };
  }

  // ========== 智能框选提取 ==========
  let isSelecting = false;
  let selectionBox = null;
  let startX = 0, startY = 0;

  function activateSmartSelection() {
    if (isSelecting) return;
    isSelecting = true;

    if (window.webOmniShowToast) window.webOmniShowToast("框选模式已激活，拖动鼠标框选区域", "info");

    const overlay = document.createElement("div");
    overlay.id = "web-omni-selection-overlay";
    overlay.style.cssText = `position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483645;cursor:crosshair;background:transparent;`;
    document.body.appendChild(overlay);

    selectionBox = document.createElement("div");
    selectionBox.style.cssText = `position:fixed;border:2px dashed #888;background:rgba(128,128,128,0.08);z-index:2147483646;pointer-events:none;display:none;`;
    document.body.appendChild(selectionBox);

    overlay.addEventListener("mousedown", (e) => {
      startX = e.clientX; startY = e.clientY;
      selectionBox.style.display = "block";
      selectionBox.style.left = startX + "px"; selectionBox.style.top = startY + "px";
      selectionBox.style.width = "0"; selectionBox.style.height = "0";
    });

    overlay.addEventListener("mousemove", (e) => {
      if (selectionBox.style.display === "none") return;
      selectionBox.style.left = Math.min(e.clientX, startX) + "px";
      selectionBox.style.top = Math.min(e.clientY, startY) + "px";
      selectionBox.style.width = Math.abs(e.clientX - startX) + "px";
      selectionBox.style.height = Math.abs(e.clientY - startY) + "px";
    });

    overlay.addEventListener("mouseup", (e) => {
      const rect = {
        left: Math.min(e.clientX, startX), top: Math.min(e.clientY, startY),
        right: Math.max(e.clientX, startX), bottom: Math.max(e.clientY, startY)
      };

      let texts = [];
      document.querySelectorAll("p, span, td, th, li, h1, h2, h3, h4, h5, h6, a, div").forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.left >= rect.left && r.right <= rect.right && r.top >= rect.top && r.bottom <= rect.bottom) {
          const text = el.innerText.trim();
          if (text && !texts.includes(text)) texts.push(text);
        }
      });

      let csvData = "";
      document.querySelectorAll("table").forEach(table => {
        const tr = table.getBoundingClientRect();
        if (tr.left < rect.right && tr.right > rect.left && tr.top < rect.bottom && tr.bottom > rect.top) {
          table.querySelectorAll("tr").forEach(row => {
            const cells = Array.from(row.querySelectorAll("td, th")).map(c => `"${c.innerText.trim().replace(/"/g, '""')}"`).join(",");
            csvData += cells + "\n";
          });
        }
      });

      overlay.remove(); selectionBox.remove(); isSelecting = false;

      if (csvData) {
        showResultPanel(`框选表格 (CSV)`, `<pre style="white-space:pre-wrap;color:#aaa;font-size:12px;">${escHtml(csvData)}</pre>`);
      } else if (texts.length > 0) {
        showResultPanel(`框选文本 (${texts.length}条)`, texts.map(t => `<div style="padding:4px 0;border-bottom:1px solid #252525;">${escHtml(t)}</div>`).join(''));
      } else {
        if (window.webOmniShowToast) window.webOmniShowToast("框选区域内未找到文本", "warn");
      }
    });

    function onEsc(e) {
      if (e.key === "Escape") {
        overlay.remove(); selectionBox.remove(); isSelecting = false;
        document.removeEventListener("keydown", onEsc);
      }
    }
    document.addEventListener("keydown", onEsc);
  }

  // ========== 媒体嗅探 ==========
  function extractMedia() {
    const images = [], seen = new Set();
    document.querySelectorAll("img").forEach(img => {
      const src = img.src || img.dataset.src || img.dataset.original;
      if (src && !seen.has(src) && !src.startsWith("data:image/svg")) {
        seen.add(src);
        images.push({ src, w: img.naturalWidth || 0, h: img.naturalHeight || 0 });
      }
    });
    document.querySelectorAll("*").forEach(el => {
      const bg = getComputedStyle(el).backgroundImage;
      if (bg && bg !== "none") {
        const m = bg.match(/url\(["']?(.*?)["']?\)/);
        if (m && m[1] && !seen.has(m[1]) && !m[1].startsWith("data:image/svg")) {
          seen.add(m[1]); images.push({ src: m[1], w: 0, h: 0 });
        }
      }
    });
    const videos = [];
    document.querySelectorAll("video").forEach(v => {
      const src = v.src || v.querySelector("source")?.src;
      if (src) videos.push(src);
    });

    if (images.length === 0 && videos.length === 0) {
      if (window.webOmniShowToast) window.webOmniShowToast("未找到媒体资源", "warn");
      return;
    }
    showMediaPanel(images, videos);
  }

  function showMediaPanel(images, videos) {
    const existing = document.getElementById("web-omni-media-panel");
    if (existing) existing.remove();

    const panel = document.createElement("div");
    panel.id = "web-omni-media-panel";
    panel.style.cssText = `position:fixed;top:0;right:0;width:400px;height:100vh;z-index:2147483646;background:#1a1a1a;border-left:1px solid #333;overflow-y:auto;font-family:system-ui,sans-serif;color:#ccc;transform:translateX(100%);transition:transform 0.25s ease;`;

    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #2a2a2a;position:sticky;top:0;background:#1a1a1a;z-index:2;">
        <b style="font-size:14px;">媒体资源 (${images.length + videos.length})</b>
        <div style="display:flex;gap:6px;">
          <button id="wo-media-dl-all" style="background:#252525;border:1px solid #3a3a3a;color:#aaa;padding:4px 10px;border-radius:5px;cursor:pointer;font-size:12px;">全部下载</button>
          <button id="wo-media-close" style="background:#252525;border:1px solid #3a3a3a;color:#aaa;padding:4px 8px;border-radius:5px;cursor:pointer;font-size:12px;">✕</button>
        </div>
      </div>`;

    if (images.length > 0) {
      html += `<div style="padding:10px 12px;"><span style="font-size:11px;color:#888;">图片 (${images.length})</span></div>`;
      html += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;padding:0 12px;">`;
      images.forEach(img => {
        html += `<div class="wo-mi" style="position:relative;aspect-ratio:1;background:#222;border-radius:4px;overflow:hidden;cursor:pointer;" data-src="${img.src}">
          <img src="${img.src}" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;" loading="lazy" onerror="this.style.opacity='0.2'">
          <button class="wo-dl" data-url="${img.src}" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.6);border:none;color:#ccc;width:22px;height:22px;border-radius:4px;cursor:pointer;font-size:10px;display:none;">⬇</button>
        </div>`;
      });
      html += `</div>`;
    }
    if (videos.length > 0) {
      html += `<div style="padding:10px 16px;"><span style="font-size:11px;color:#888;">视频 (${videos.length})</span></div>`;
      videos.forEach(src => {
        html += `<div style="padding:6px 16px;font-size:12px;border-bottom:1px solid #252525;display:flex;align-items:center;gap:8px;">
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${src}">🎬 ${src.split('/').pop() || src}</span>
          <button class="wo-dl" data-url="${src}" style="background:#252525;border:1px solid #3a3a3a;color:#aaa;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:11px;">⬇</button>
        </div>`;
      });
    }
    panel.innerHTML = html;

    const style = document.createElement('style');
    style.textContent = '.wo-mi:hover .wo-dl{display:block!important;}';
    panel.appendChild(style);
    document.body.appendChild(panel);
    requestAnimationFrame(() => requestAnimationFrame(() => panel.style.transform = 'translateX(0)'));

    panel.querySelector('#wo-media-close').onclick = () => {
      panel.style.transform = 'translateX(100%)'; setTimeout(() => panel.remove(), 250);
    };
    panel.querySelector('#wo-media-dl-all').onclick = () => {
      const all = [...images.map(i => i.src), ...videos];
      all.forEach((url, i) => {
        setTimeout(() => chrome.runtime.sendMessage({ type: "DOWNLOAD_FILE", url, filename: url.split('/').pop().split('?')[0] || "media" }), i * 150);
      });
      if (window.webOmniShowToast) window.webOmniShowToast(`正在下载 ${all.length} 个文件`, "success");
    };
    panel.addEventListener('click', e => {
      const dl = e.target.closest('.wo-dl');
      if (dl) { chrome.runtime.sendMessage({ type: "DOWNLOAD_FILE", url: dl.dataset.url, filename: dl.dataset.url.split('/').pop().split('?')[0] || "media" }); return; }
      const mi = e.target.closest('.wo-mi');
      if (mi && mi.dataset.src) window.open(mi.dataset.src, '_blank');
    });
  }

  // ========== Markdown 剪藏 ==========
  function extractMarkdown() {
    let title = document.title, url = window.location.href;
    let md = `# ${title}\n> 来源: ${url}\n> 时间: ${new Date().toLocaleString()}\n\n`;
    const article = document.querySelector("article") || document.querySelector("[role='main']") || document.querySelector("main") || document.querySelector(".post-content") || document.querySelector("#content") || document.body;

    function ex(node) {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent.trim();
      if (node.nodeType !== Node.ELEMENT_NODE) return "";
      const tag = node.tagName.toLowerCase();
      if (["script","style","nav","footer","header","aside","iframe","noscript"].includes(tag)) return "";
      if (node.id && node.id.startsWith("web-omni")) return "";
      if (node.id && node.id.startsWith("wo-")) return "";
      const ch = Array.from(node.childNodes).map(ex).filter(t => t).join("");
      switch(tag) {
        case "h1": return `# ${ch}\n\n`; case "h2": return `## ${ch}\n\n`;
        case "h3": return `### ${ch}\n\n`; case "h4": return `#### ${ch}\n\n`;
        case "p": return ch ? `${ch}\n\n` : ""; case "br": return "\n";
        case "strong": case "b": return `**${ch}**`;
        case "em": case "i": return `*${ch}*`;
        case "a": return `[${ch}](${node.href || ""})`; case "img": return `![${node.alt || ""}](${node.src || ""})\n\n`;
        case "li": return `- ${ch}\n`; case "ul": case "ol": return `\n${ch}\n`;
        case "blockquote": return `> ${ch.replace(/\n/g, "\n> ")}\n\n`;
        case "code": return `\`${ch}\``; case "pre": return `\n\`\`\`\n${node.innerText}\n\`\`\`\n\n`;
        default: return ch;
      }
    }
    md += ex(article);
    showResultPanel("Markdown 剪藏", `<pre style="white-space:pre-wrap;font-size:12px;color:#aaa;">${escHtml(md)}</pre>`);
  }

  // ========== 链接提取 → 面板展示 ==========
  function extractLinks() {
    const links = Array.from(document.querySelectorAll("a[href]"));
    const domains = {};
    let total = 0;
    links.forEach(a => {
      try {
        const u = new URL(a.href);
        if (u.protocol !== "http:" && u.protocol !== "https:") return;
        const d = u.hostname;
        const t = (a.innerText || a.title || "无标题").trim().replace(/\n/g, ' ').substring(0, 80);
        if (!domains[d]) domains[d] = [];
        if (!domains[d].find(i => i.href === a.href)) { domains[d].push({ text: t, href: a.href }); total++; }
      } catch(e) {}
    });
    if (total === 0) { if (window.webOmniShowToast) window.webOmniShowToast("未找到有效链接", "warn"); return; }

    let html = '';
    Object.keys(domains).sort((a,b) => domains[b].length - domains[a].length).forEach(d => {
      html += `<div style="margin-bottom:12px;"><b style="color:#888;font-size:12px;">${escHtml(d)} (${domains[d].length})</b>`;
      domains[d].forEach(l => {
        html += `<div style="padding:3px 0;font-size:12px;border-bottom:1px solid #222;"><a href="${l.href}" target="_blank" style="color:#7ab;text-decoration:none;">${escHtml(l.text)}</a></div>`;
      });
      html += `</div>`;
    });
    showResultPanel(`链接提取 (${total})`, html);
  }

  // ========== 结构化数据 → 面板展示 ==========
  function extractStructuredData() {
    const data = { meta: {}, openGraph: {}, twitter: {}, jsonLd: [] };
    document.querySelectorAll("meta[name]").forEach(m => { const n = m.getAttribute("name"); if (n && !n.startsWith("twitter:")) data.meta[n] = m.content; });
    document.querySelectorAll("meta[property^='og:']").forEach(m => { data.openGraph[m.getAttribute("property").replace("og:", "")] = m.content; });
    document.querySelectorAll("meta[name^='twitter:']").forEach(m => { data.twitter[m.getAttribute("name").replace("twitter:", "")] = m.content; });
    document.querySelectorAll('script[type="application/ld+json"]').forEach(s => { try { data.jsonLd.push(JSON.parse(s.textContent)); } catch(e) {} });

    let html = '';
    const sections = [['Meta', data.meta], ['Open Graph', data.openGraph], ['Twitter', data.twitter]];
    sections.forEach(([name, obj]) => {
      const keys = Object.keys(obj);
      if (keys.length === 0) return;
      html += `<div style="margin-bottom:12px;"><b style="color:#888;font-size:12px;">${name}</b>`;
      keys.forEach(k => { html += `<div style="padding:2px 0;font-size:12px;"><span style="color:#999;">${escHtml(k)}:</span> ${escHtml(obj[k])}</div>`; });
      html += `</div>`;
    });
    if (data.jsonLd.length > 0) {
      html += `<div style="margin-bottom:12px;"><b style="color:#888;font-size:12px;">JSON-LD (${data.jsonLd.length})</b><pre style="white-space:pre-wrap;font-size:11px;color:#aaa;background:#111;padding:8px;border-radius:4px;max-height:300px;overflow:auto;">${escHtml(JSON.stringify(data.jsonLd, null, 2))}</pre></div>`;
    }
    showResultPanel("结构化数据", html || '<span style="color:#666;">未找到</span>');
  }

  // ========== CSS选择器爬取 → 面板展示 ==========
  function promptCssExtraction() {
    const selector = prompt("输入 CSS 选择器 (如 .article p, h2):");
    if (!selector) return;
    try {
      const els = document.querySelectorAll(selector);
      if (els.length === 0) { if (window.webOmniShowToast) window.webOmniShowToast("未找到匹配元素", "warn"); return; }
      let html = '';
      els.forEach((el, i) => {
        html += `<div style="padding:6px 0;border-bottom:1px solid #252525;"><span style="color:#666;font-size:11px;">[${i+1}]</span> <span style="font-size:12px;">${escHtml(el.innerText.trim().substring(0, 200))}</span></div>`;
      });
      showResultPanel(`CSS提取 "${selector}" (${els.length})`, html);
    } catch(e) {
      if (window.webOmniShowToast) window.webOmniShowToast("无效的选择器", "error");
    }
  }

  // ========== 邮箱/电话嗅探 → 面板展示 ==========
  function extractEmailPhone() {
    const text = document.body.innerText || "";
    const emails = [...new Set((text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []))];
    const phonesRaw = text.match(/(?:\+?86)?1[3-9]\d{9}|(?:\d{3,4}-)?\d{7,8}/g) || [];
    const phones = [...new Set(phonesRaw.filter(p => !p.match(/^20\d{2}$/) && p.length >= 7))];

    if (emails.length === 0 && phones.length === 0) {
      if (window.webOmniShowToast) window.webOmniShowToast("未嗅探到邮箱或电话", "warn"); return;
    }
    let html = '';
    if (emails.length > 0) {
      html += `<b style="color:#888;font-size:12px;">📧 邮箱 (${emails.length})</b>`;
      emails.forEach(e => { html += `<div style="padding:3px 0;font-size:13px;">${escHtml(e)}</div>`; });
      html += '<br>';
    }
    if (phones.length > 0) {
      html += `<b style="color:#888;font-size:12px;">📞 电话 (${phones.length})</b>`;
      phones.forEach(p => { html += `<div style="padding:3px 0;font-size:13px;">${escHtml(p)}</div>`; });
    }
    showResultPanel(`联系方式嗅探`, html);
  }

  // ========== 页面快照 → 面板展示 ==========
  function extractPageSnapshot() {
    const textLen = (document.body.innerText || "").replace(/\s/g, '').length;
    const items = [
      ["标题", document.title],
      ["网址", location.href],
      ["描述", document.querySelector('meta[name="description"]')?.content || "无"],
      ["关键词", document.querySelector('meta[name="keywords"]')?.content || "无"],
      ["纯文本字数", `约 ${textLen} 字`],
      ["图片数量", document.querySelectorAll('img').length],
      ["链接数量", document.querySelectorAll('a').length],
      ["脚本数量", document.querySelectorAll('script').length],
      ["Cookie数量", document.cookie.split(';').filter(c => c.trim()).length],
      ["DOM节点数", document.querySelectorAll('*').length],
    ];
    try {
      const timing = performance.timing;
      items.push(["加载耗时", ((timing.loadEventEnd - timing.navigationStart) / 1000).toFixed(2) + 's']);
    } catch(e) {}

    let html = items.map(([k, v]) => `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #252525;font-size:13px;"><span style="color:#888;">${k}</span><span>${escHtml(String(v))}</span></div>`).join('');
    showResultPanel("页面快照", html);
  }

  // ========== 新增：页面源码提取 ==========
  function extractPageSource() {
    const source = document.documentElement.outerHTML;
    showResultPanel("页面源码", `<div style="margin-bottom:8px;font-size:12px;color:#888;">共 ${source.length} 字符</div><pre style="white-space:pre-wrap;word-break:break-all;font-size:11px;color:#aaa;max-height:80vh;overflow:auto;">${escHtml(source.substring(0, 50000))}${source.length > 50000 ? '\n\n... (已截断)' : ''}</pre>`);
  }

  // ========== 新增：Cookie 提取 ==========
  function extractCookies() {
    const cookies = document.cookie.split(';').map(c => c.trim()).filter(c => c);
    if (cookies.length === 0) {
      if (window.webOmniShowToast) window.webOmniShowToast("当前页面无可读Cookie", "warn"); return;
    }
    let html = '';
    cookies.forEach(c => {
      const [name, ...rest] = c.split('=');
      const val = rest.join('=');
      html += `<div style="padding:4px 0;border-bottom:1px solid #252525;font-size:12px;word-break:break-all;"><b style="color:#999;">${escHtml(name.trim())}</b> = <span style="color:#7ab;">${escHtml(val)}</span></div>`;
    });
    showResultPanel(`Cookie (${cookies.length})`, html);
  }

  // ========== 新增：隐藏表单字段提取 ==========
  function extractHiddenFields() {
    const hiddens = document.querySelectorAll('input[type="hidden"]');
    const tokens = [];
    hiddens.forEach(h => {
      tokens.push({ name: h.name || h.id || '(unnamed)', value: h.value });
    });
    // 也提取 CSRF tokens
    document.querySelectorAll('meta[name*="csrf"], meta[name*="token"]').forEach(m => {
      tokens.push({ name: `meta:${m.getAttribute('name')}`, value: m.content });
    });

    if (tokens.length === 0) {
      if (window.webOmniShowToast) window.webOmniShowToast("未找到隐藏字段", "warn"); return;
    }
    let html = tokens.map(t =>
      `<div style="padding:4px 0;border-bottom:1px solid #252525;font-size:12px;word-break:break-all;"><b style="color:#999;">${escHtml(t.name)}</b> = <span style="color:#c97;">${escHtml(t.value)}</span></div>`
    ).join('');
    showResultPanel(`隐藏字段/Token (${tokens.length})`, html);
  }

  // ========== 新增：AJAX/API端点嗅探 ==========
  function extractAjaxUrls() {
    const urls = new Set();
    // 从 script 标签中正则提取 API/fetch/xhr 地址
    document.querySelectorAll('script:not([src])').forEach(s => {
      const text = s.textContent || "";
      // 匹配 fetch/axios/$.ajax/XMLHttpRequest 中的URL
      const patterns = [
        /fetch\s*\(\s*["'`](https?:\/\/[^"'`]+)["'`]/gi,
        /(?:url|endpoint|api|baseURL|baseUrl)\s*[:=]\s*["'`](https?:\/\/[^"'`]+)["'`]/gi,
        /["'`](\/api\/[^"'`]+)["'`]/gi,
        /["'`](https?:\/\/[^"'`]*\/api\/[^"'`]+)["'`]/gi,
        /\.(?:get|post|put|delete|patch)\s*\(\s*["'`](https?:\/\/[^"'`]+)["'`]/gi,
        /\.(?:get|post|put|delete|patch)\s*\(\s*["'`](\/[^"'`]+)["'`]/gi,
      ];
      patterns.forEach(reg => {
        let m;
        while ((m = reg.exec(text)) !== null) {
          if (m[1] && m[1].length < 500) urls.add(m[1]);
        }
      });
    });

    // 从 script[src] 提取外部脚本地址
    document.querySelectorAll('script[src]').forEach(s => {
      if (s.src) urls.add(s.src);
    });

    if (urls.size === 0) {
      if (window.webOmniShowToast) window.webOmniShowToast("未嗅探到API端点", "warn"); return;
    }

    const arr = [...urls].sort();
    let html = arr.map(u => `<div style="padding:3px 0;border-bottom:1px solid #252525;font-size:12px;word-break:break-all;"><a href="${u}" target="_blank" style="color:#7ab;text-decoration:none;">${escHtml(u)}</a></div>`).join('');
    showResultPanel(`API/脚本端点 (${arr.length})`, html);
  }

  // ========== 新增：localStorage/sessionStorage 转储 ==========
  function dumpStorage() {
    let html = '';
    const storages = [['localStorage', localStorage], ['sessionStorage', sessionStorage]];
    storages.forEach(([name, store]) => {
      try {
        const keys = Object.keys(store);
        if (keys.length === 0) { html += `<b style="color:#888;font-size:12px;">${name} (空)</b><br><br>`; return; }
        html += `<b style="color:#888;font-size:12px;">${name} (${keys.length})</b>`;
        keys.forEach(k => {
          let v = store.getItem(k);
          if (v && v.length > 200) v = v.substring(0, 200) + '...';
          html += `<div style="padding:3px 0;border-bottom:1px solid #252525;font-size:12px;word-break:break-all;"><b style="color:#c97;">${escHtml(k)}</b> = <span style="color:#aaa;">${escHtml(v)}</span></div>`;
        });
        html += '<br>';
      } catch(e) { html += `<b>${name}</b>: 访问被拒绝<br>`; }
    });
    showResultPanel('Storage 转储', html);
  }

  // ========== 新增：密码框明文显示 ==========
  function revealPasswords() {
    const pwFields = document.querySelectorAll('input[type="password"]');
    if (pwFields.length === 0) {
      if (window.webOmniShowToast) window.webOmniShowToast('页面中没有密码框', 'warn');
      return;
    }
    let html = '';
    pwFields.forEach((input, i) => {
      const name = input.name || input.id || input.placeholder || `密码框${i+1}`;
      const val = input.value;
      // 切换明文/密码
      input.type = input.type === 'password' ? 'text' : 'password';
      // 视觉标记
      input.style.outline = '2px solid #c97';
      input.style.outlineOffset = '1px';
      html += `<div style="padding:4px 0;border-bottom:1px solid #252525;font-size:13px;"><b style="color:#999;">${escHtml(name)}</b>: <span style="color:#e95;font-family:monospace;">${val ? escHtml(val) : '(空)'}</span></div>`;
    });
    showResultPanel(`密码框 (${pwFields.length})`, html + '<br><small style="color:#666;">密码框已切换明文 / 再次点击恢复</small>');
  }

  // ========== 新增：全局JS变量转储 ==========
  function dumpJsGlobals() {
    const defaultKeys = new Set(Object.getOwnPropertyNames(window.frames[0] || {}));
    // 备选：使用一个干净iframe来获取默认属性
    try {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      Object.getOwnPropertyNames(iframe.contentWindow).forEach(k => defaultKeys.add(k));
      iframe.remove();
    } catch(e) {}

    const customs = [];
    Object.getOwnPropertyNames(window).forEach(k => {
      if (defaultKeys.has(k)) return;
      if (k.startsWith('__') || k.startsWith('webOmni')) return;
      try {
        const val = window[k];
        const type = typeof val;
        let preview = '';
        if (type === 'string') preview = val.substring(0, 100);
        else if (type === 'number' || type === 'boolean') preview = String(val);
        else if (type === 'object' && val !== null) preview = JSON.stringify(val).substring(0, 100) + '...';
        else if (type === 'function') preview = '(function)';
        else preview = String(val);
        customs.push({ k, type, preview });
      } catch(e) { customs.push({ k, type: '?', preview: '(不可读)' }); }
    });

    if (customs.length === 0) {
      if (window.webOmniShowToast) window.webOmniShowToast('未发现自定义全局变量', 'warn'); return;
    }
    let html = customs.map(c =>
      `<div style="padding:3px 0;border-bottom:1px solid #252525;font-size:12px;word-break:break-all;"><b style="color:#7ab;">${escHtml(c.k)}</b> <span style="color:#555;">[${c.type}]</span> = <span style="color:#aaa;">${escHtml(c.preview)}</span></div>`
    ).join('');
    showResultPanel(`全局JS变量 (${customs.length})`, html);
  }

  // ========== 新增：事件劫持监听器 ==========
  function hijackEvents() {
    if (window._woEventHijacked) {
      if (window.webOmniShowToast) window.webOmniShowToast('事件监听器已在工作中', 'info'); return;
    }
    window._woEventHijacked = true;
    window._woEventLog = [];

    const origAdd = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      window._woEventLog.push({
        target: this === window ? 'window' : this === document ? 'document' : (this.tagName || 'unknown'),
        type, time: Date.now()
      });
      return origAdd.call(this, type, listener, options);
    };

    // 显示已存在的事件
    const log = window._woEventLog;
    setTimeout(() => {
      let html = `<div style="margin-bottom:8px;font-size:12px;color:#888;">事件劫持已激活，后续注册的事件将被记录</div>`;
      if (log.length > 0) {
        html += log.slice(-50).map(e =>
          `<div style="padding:2px 0;font-size:11px;border-bottom:1px solid #222;"><span style="color:#7ab;">${e.target}</span>.<span style="color:#c97;">${e.type}</span></div>`
        ).join('');
      } else {
        html += '<div style="color:#555;">尚未捕获到新事件注册</div>';
      }
      showResultPanel('事件劫持', html);
    }, 500);

    if (window.webOmniShowToast) window.webOmniShowToast('事件劫持已开启', 'success');
  }

  // ========== 新增：网络请求拦截 ==========
  function interceptRequests() {
    if (window._woNetIntercepted) {
      // 显示已收集的请求
      const reqs = window._woNetLog || [];
      if (reqs.length === 0) { if (window.webOmniShowToast) window.webOmniShowToast('尚未捕获到请求', 'warn'); return; }
      let html = reqs.slice(-80).map(r =>
        `<div style="padding:3px 0;border-bottom:1px solid #252525;font-size:11px;word-break:break-all;"><span style="color:${r.method === 'POST' ? '#e95' : '#7ab'};font-weight:bold;">${r.method}</span> <a href="${r.url}" target="_blank" style="color:#aaa;text-decoration:none;">${escHtml(r.url.substring(0, 120))}</a></div>`
      ).join('');
      showResultPanel(`拦截请求 (${reqs.length})`, html);
      return;
    }
    window._woNetIntercepted = true;
    window._woNetLog = [];

    // 劫持 XMLHttpRequest
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      window._woNetLog.push({ method: method.toUpperCase(), url: String(url), time: Date.now() });
      return origOpen.apply(this, arguments);
    };

    // 劫持 fetch
    const origFetch = window.fetch;
    window.fetch = function(input, init) {
      const url = typeof input === 'string' ? input : (input?.url || String(input));
      const method = init?.method || 'GET';
      window._woNetLog.push({ method: method.toUpperCase(), url, time: Date.now() });
      return origFetch.apply(this, arguments);
    };

    if (window.webOmniShowToast) window.webOmniShowToast('网络拦截已开启，操作页面后再次点击查看', 'success');
  }

  // ========== 新增：浏览器指纹检测 ==========
  function browserFingerprint() {
    const fp = {};
    // Canvas 指纹
    try {
      const c = document.createElement('canvas'); c.width=200;c.height=50;
      const ctx=c.getContext('2d');ctx.textBaseline='top';ctx.font='14px Arial';ctx.fillStyle='#f60';ctx.fillRect(125,1,62,20);ctx.fillStyle='#069';ctx.fillText('Web-Omni FP',2,15);ctx.fillStyle='rgba(102,204,0,0.7)';ctx.fillText('Web-Omni FP',4,17);
      fp.canvas = c.toDataURL().substring(0,80)+'...';
      fp.canvasHash = hashStr(c.toDataURL());
    } catch(e){fp.canvas='不可用';}
    // WebGL 指纹
    try {
      const c=document.createElement('canvas');const gl=c.getContext('webgl')||c.getContext('experimental-webgl');
      fp.webglVendor=gl.getParameter(gl.VENDOR);fp.webglRenderer=gl.getParameter(gl.RENDERER);
      const dbg=gl.getExtension('WEBGL_debug_renderer_info');
      if(dbg){fp.webglUnmaskedVendor=gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL);fp.webglUnmaskedRenderer=gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);}
    } catch(e){fp.webgl='不可用';}
    // Audio 指纹
    try {
      const ac=new (window.AudioContext||window.webkitAudioContext)();
      const osc=ac.createOscillator();const a=ac.createAnalyser();const g=ac.createGain();
      g.gain.value=0;osc.connect(a);a.connect(g);g.connect(ac.destination);osc.start(0);
      const d=new Float32Array(a.frequencyBinCount);a.getFloatFrequencyData(d);
      fp.audioHash=hashStr(d.slice(0,30).join(','));osc.stop();ac.close();
    } catch(e){fp.audio='不可用';}
    // 基本信息
    fp.userAgent=navigator.userAgent;fp.platform=navigator.platform;fp.language=navigator.language;
    fp.hardwareConcurrency=navigator.hardwareConcurrency;fp.deviceMemory=navigator.deviceMemory||'N/A';
    fp.screenRes=screen.width+'x'+screen.height;fp.colorDepth=screen.colorDepth;
    fp.timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
    fp.touchSupport='ontouchstart' in window;fp.plugins=navigator.plugins?navigator.plugins.length:0;
    // 字体检测 (简化)
    const testFonts=['Arial','Verdana','Courier New','Georgia','Comic Sans MS','Impact','Lucida Console','Palatino','Tahoma','Trebuchet MS'];
    const baseFonts=['monospace','sans-serif','serif'];
    const s=document.createElement('span');s.style.cssText='position:absolute;left:-9999px;font-size:72px;';s.textContent='mmmmmmmmmmlli';document.body.appendChild(s);
    const baseWidths={};baseFonts.forEach(f=>{s.style.fontFamily=f;baseWidths[f]=s.offsetWidth;});
    fp.detectedFonts=testFonts.filter(f=>{return baseFonts.some(b=>{s.style.fontFamily=`"${f}",${b}`;return s.offsetWidth!==baseWidths[b];});});
    s.remove();

    let html=Object.entries(fp).map(([k,v])=>{const val=Array.isArray(v)?v.join(', '):String(v);return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #252525;font-size:12px;word-break:break-all;"><span style="color:#888;flex-shrink:0;margin-right:12px;">${k}</span><span style="color:#7ab;text-align:right;">${escHtml(val)}</span></div>`;}).join('');
    showResultPanel('🔎 浏览器指纹',html);
  }
  function hashStr(s){let h=0;for(let i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0;}return 'hash_'+Math.abs(h).toString(16);}

  // ========== 新增：WebSocket 监听 ==========
  function websocketMonitor() {
    if(window._woWSMonitor){
      const logs=window._woWSLog||[];
      if(!logs.length){if(window.webOmniShowToast)window.webOmniShowToast('尚未捕获到WebSocket消息','warn');return;}
      let html=logs.slice(-100).map(l=>`<div style="padding:3px 0;border-bottom:1px solid #252525;font-size:11px;word-break:break-all;"><span style="color:${l.dir==='send'?'#e95':'#7ab'};font-weight:bold;">${l.dir==='send'?'↑ SEND':'↓ RECV'}</span> <span style="color:#555;">[${new Date(l.time).toLocaleTimeString()}]</span> <span style="color:#aaa;">${escHtml(String(l.data).substring(0,200))}</span></div>`).join('');
      showResultPanel(`WebSocket 消息 (${logs.length})`,html);return;
    }
    window._woWSMonitor=true;window._woWSLog=[];
    const OrigWS=window.WebSocket;
    window.WebSocket=function(...args){
      const ws=new OrigWS(...args);
      const origSend=ws.send.bind(ws);
      ws.send=function(data){window._woWSLog.push({dir:'send',data,time:Date.now()});return origSend(data);};
      ws.addEventListener('message',e=>{window._woWSLog.push({dir:'recv',data:e.data,time:Date.now()});});
      return ws;
    };
    window.WebSocket.prototype=OrigWS.prototype;
    if(window.webOmniShowToast)window.webOmniShowToast('WebSocket 监听已开启，操作页面后再次点击查看','success');
  }

  // ========== 新增：JS代码注入器 ==========
  function jsInjector() {
    const existing=document.getElementById('wo-js-injector');if(existing){existing.remove();return;}
    const overlay=document.createElement('div');overlay.id='wo-js-injector';
    overlay.style.cssText='position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483647;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;font-family:-apple-system,sans-serif;';
    overlay.innerHTML=`<div style="background:rgba(28,28,30,0.98);backdrop-filter:blur(28px);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px;width:500px;max-height:80vh;color:#fff;"><h3 style="margin:0 0 16px;font-size:16px;font-weight:700;">💉 JS 代码注入器</h3><textarea id="wo-jsi-code" style="width:100%;height:200px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:#e2e8f0;font-family:'SF Mono',Monaco,monospace;font-size:13px;padding:12px;outline:none;resize:vertical;box-sizing:border-box;" placeholder="// 在此输入 JavaScript 代码&#10;// 代码将在当前页面上下文中执行&#10;alert('Hello from Web-Omni!');"></textarea><div id="wo-jsi-result" style="margin-top:8px;max-height:120px;overflow:auto;font-size:12px;color:#888;font-family:monospace;"></div><div style="display:flex;gap:8px;margin-top:12px;"><button id="wo-jsi-run" style="flex:1;padding:10px;background:linear-gradient(135deg,#ef4444,#dc2626);border:none;color:#fff;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">▶ 执行</button><button id="wo-jsi-close" style="padding:10px 16px;background:rgba(255,255,255,0.06);border:none;color:#aaa;border-radius:8px;cursor:pointer;font-size:13px;">关闭</button></div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#wo-jsi-run').addEventListener('click',()=>{
      const code=overlay.querySelector('#wo-jsi-code').value;
      const resultDiv=overlay.querySelector('#wo-jsi-result');
      try{const r=eval(code);resultDiv.innerHTML=`<div style="color:#4ade80;">✓ 执行成功</div><pre style="color:#aaa;white-space:pre-wrap;margin-top:4px;">${escHtml(String(r))}</pre>`;} catch(e){resultDiv.innerHTML=`<div style="color:#ef4444;">✗ 错误: ${escHtml(e.message)}</div>`;}
    });
    overlay.querySelector('#wo-jsi-close').addEventListener('click',()=>overlay.remove());
    overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
  }

  // ========== 新增：Canvas指纹伪装 ==========
  function canvasSpoof() {
    if(window._woCanvasSpoofed){if(window.webOmniShowToast)window.webOmniShowToast('Canvas 伪装已经在运行中','info');return;}
    window._woCanvasSpoofed=true;
    const origToDataURL=HTMLCanvasElement.prototype.toDataURL;
    const origToBlob=HTMLCanvasElement.prototype.toBlob;
    const origGetImageData=CanvasRenderingContext2D.prototype.getImageData;
    // 对每个像素添加微小噪音
    function addNoise(data){for(let i=0;i<data.length;i+=4){data[i]=Math.max(0,Math.min(255,data[i]+(Math.random()*4-2)|0));data[i+1]=Math.max(0,Math.min(255,data[i+1]+(Math.random()*4-2)|0));data[i+2]=Math.max(0,Math.min(255,data[i+2]+(Math.random()*4-2)|0));}return data;}
    HTMLCanvasElement.prototype.toDataURL=function(...args){const ctx=this.getContext('2d');if(ctx){try{const id=origGetImageData.call(ctx,0,0,this.width,this.height);addNoise(id.data);ctx.putImageData(id,0,0);}catch(e){}}return origToDataURL.apply(this,args);};
    HTMLCanvasElement.prototype.toBlob=function(cb,...args){const ctx=this.getContext('2d');if(ctx){try{const id=origGetImageData.call(ctx,0,0,this.width,this.height);addNoise(id.data);ctx.putImageData(id,0,0);}catch(e){}}return origToBlob.call(this,cb,...args);};
    CanvasRenderingContext2D.prototype.getImageData=function(...args){const id=origGetImageData.apply(this,args);addNoise(id.data);return id;};
    if(window.webOmniShowToast)window.webOmniShowToast('🎭 Canvas 指纹伪装已启动，页面的 Canvas 指纹已被随机化','success');
  }

  // ========== 工具函数 ==========
  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

})();
