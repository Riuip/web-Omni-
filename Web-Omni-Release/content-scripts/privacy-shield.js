// 神经末梢：隐私保护工具 (Privacy Shield)
// 追踪器拦截 · Referrer清除 · WebRTC防护 · 指纹保护 · 隐私评分
(function() {
  if (window.webOmniPrivacyShieldInjected) return;
  window.webOmniPrivacyShieldInjected = true;

  chrome.runtime.onMessage.addListener((req) => {
    switch(req.action) {
      case 'PRIVACY_CLEAN_TRACES': cleanTraces(); break;
      case 'PRIVACY_BLOCK_TRACKERS': blockTrackers(); break;
      case 'PRIVACY_STRIP_REFERRER': stripReferrer(); break;
      case 'PRIVACY_WEBRTC_PROTECT': webrtcProtect(); break;
      case 'PRIVACY_CLEAR_COOKIES': clearPageCookies(); break;
      case 'PRIVACY_ANTI_SCREENSHOT': antiScreenshot(); break;
      case 'PRIVACY_FINGERPRINT_PROTECT': fingerprintProtect(); break;
      case 'PRIVACY_SCAN': privacyScan(); break;
    }
  });

  // ===== 1. 一键清除痕迹 =====
  function cleanTraces() {
    let cleared = [];
    try { const c = localStorage.length; localStorage.clear(); cleared.push(`localStorage (${c}项)`); } catch(e){}
    try { const c = sessionStorage.length; sessionStorage.clear(); cleared.push(`sessionStorage (${c}项)`); } catch(e){}
    try {
      const cookies = document.cookie.split(';');
      cookies.forEach(c => {
        const name = c.split('=')[0].trim();
        if(name) document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
      });
      cleared.push(`Cookies (${cookies.filter(c=>c.trim()).length}项)`);
    } catch(e){}
    try {
      if(indexedDB.databases) {
        indexedDB.databases().then(dbs => {
          dbs.forEach(db => indexedDB.deleteDatabase(db.name));
          cleared.push(`IndexedDB (${dbs.length}个)`);
        });
      }
    } catch(e){}
    try {
      if(caches) {
        caches.keys().then(names => {
          names.forEach(n => caches.delete(n));
          cleared.push(`CacheStorage (${names.length}个)`);
        });
      }
    } catch(e){}

    showPrivacyPanel('痕迹清除', `<div style="padding:8px 0;">
      <p style="color:#3fb950;font-size:13px;margin-bottom:12px;">✓ 已清除以下数据:</p>
      ${cleared.map(c => `<div style="padding:4px 0;font-size:12px;border-bottom:1px solid #21262d;">· ${c}</div>`).join('')}
      <p style="color:#8b949e;font-size:11px;margin-top:12px;">注意：浏览器层面的历史记录需在浏览器设置中清除</p>
    </div>`);
  }

  // ===== 2. 追踪器检测与拦截 =====
  function blockTrackers() {
    const trackerDomains = [
      'google-analytics.com','googletagmanager.com','doubleclick.net',
      'facebook.net','fbcdn.net','connect.facebook.net',
      'hotjar.com','mixpanel.com','segment.io','amplitude.com',
      'baidu.com/hm.js','cnzz.com','51.la','umeng.com',
      'track.','pixel.','analytics.','beacon.',
      'ad.','ads.','adserver.','adtrack.',
      'clarity.ms','newrelic.com','sentry.io'
    ];

    const scripts = document.querySelectorAll('script[src]');
    const trackers = [], safe = [];

    scripts.forEach(s => {
      const src = s.src || '';
      if (trackerDomains.some(d => src.includes(d))) {
        trackers.push({ src, el: s });
      } else {
        safe.push(src);
      }
    });

    // 追踪像素
    const pixels = [];
    document.querySelectorAll('img[width="1"],img[height="1"],img[style*="display:none"]').forEach(img => {
      if (img.src && !img.src.startsWith('data:')) pixels.push(img.src);
    });

    // 拦截 XHR/Fetch
    let blockedCount = 0;
    if (!window._woTrackerBlocked) {
      window._woTrackerBlocked = true;
      const origFetch = window.fetch;
      window.fetch = function(input, init) {
        const url = typeof input === 'string' ? input : (input?.url || '');
        if (trackerDomains.some(d => url.includes(d))) { blockedCount++; return Promise.resolve(new Response('', {status: 200})); }
        return origFetch.apply(this, arguments);
      };
      const origOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(m, url) {
        if (trackerDomains.some(d => url.includes(d))) { this._woBlocked = true; }
        return origOpen.apply(this, arguments);
      };
      const origSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function() {
        if (this._woBlocked) { blockedCount++; return; }
        return origSend.apply(this, arguments);
      };
    }

    trackers.forEach(t => t.el.remove());

    showPrivacyPanel('追踪器拦截', `<div style="padding:8px 0;">
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <div style="flex:1;background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:10px;text-align:center;">
          <div style="font-size:20px;font-weight:700;color:#f85149;">${trackers.length}</div>
          <div style="font-size:11px;color:#8b949e;">追踪脚本</div>
        </div>
        <div style="flex:1;background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:10px;text-align:center;">
          <div style="font-size:20px;font-weight:700;color:#d29922;">${pixels.length}</div>
          <div style="font-size:11px;color:#8b949e;">追踪像素</div>
        </div>
        <div style="flex:1;background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:10px;text-align:center;">
          <div style="font-size:20px;font-weight:700;color:#3fb950;">${safe.length}</div>
          <div style="font-size:11px;color:#8b949e;">安全脚本</div>
        </div>
      </div>
      ${trackers.length > 0 ? '<div style="font-size:12px;color:#f85149;margin-bottom:4px;">已移除:</div>' + trackers.map(t => `<div style="padding:2px 0;font-size:11px;color:#8b949e;word-break:break-all;">${esc(t.src.substring(0,80))}</div>`).join('') : '<p style="color:#3fb950;font-size:12px;">✓ 未检测到已知追踪脚本</p>'}
      <p style="color:#8b949e;font-size:11px;margin-top:8px;">后续请求也将被拦截</p>
    </div>`);
  }

  // ===== 3. Referrer 清除 =====
  function stripReferrer() {
    let meta = document.querySelector('meta[name="referrer"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'referrer'; document.head.appendChild(meta); }
    meta.content = 'no-referrer';

    let count = 0;
    document.querySelectorAll('a[href]').forEach(a => {
      if (!a.rel.includes('noreferrer')) {
        a.rel = (a.rel ? a.rel + ' ' : '') + 'noreferrer';
        count++;
      }
    });
    if (window.webOmniShowToast) window.webOmniShowToast(`Referrer 已清除，${count} 个链接已设为 no-referrer`, 'success');
  }

  // ===== 4. WebRTC 泄露防护 =====
  function webrtcProtect() {
    if (window._woWebRTCBlocked) {
      if (window.webOmniShowToast) window.webOmniShowToast('WebRTC 防护已在运行中', 'info');
      return;
    }
    window._woWebRTCBlocked = true;

    const ips = [];
    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pc.createDataChannel('');
      pc.createOffer().then(offer => pc.setLocalDescription(offer));
      pc.onicecandidate = (e) => {
        if (!e.candidate) {
          pc.close();
          blockWebRTC();
          showPrivacyPanel('WebRTC 防护', `<div style="padding:8px 0;">
            <p style="color:#3fb950;font-size:13px;margin-bottom:8px;">✓ WebRTC IP 泄露防护已启动</p>
            ${ips.length > 0 ? '<div style="font-size:12px;color:#d29922;margin-bottom:4px;">之前暴露的 IP:</div>' + ips.map(ip => `<div style="padding:2px 0;font-size:12px;color:#f85149;">· ${ip}</div>`).join('') : ''}
            <p style="color:#8b949e;font-size:11px;margin-top:8px;">RTCPeerConnection 已被禁用</p>
          </div>`);
          return;
        }
        const candidate = e.candidate.candidate;
        const ipMatch = candidate.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
        if (ipMatch && !ips.includes(ipMatch[1])) ips.push(ipMatch[1]);
      };
    } catch(e) {
      blockWebRTC();
      if (window.webOmniShowToast) window.webOmniShowToast('WebRTC 已被禁用', 'success');
    }
  }

  function blockWebRTC() {
    window.RTCPeerConnection = function() { throw new Error('WebRTC blocked by Web-Omni'); };
    window.webkitRTCPeerConnection = window.RTCPeerConnection;
    if (window.mozRTCPeerConnection) window.mozRTCPeerConnection = window.RTCPeerConnection;
  }

  // ===== 5. 清除 Cookie =====
  function clearPageCookies() {
    const cookies = document.cookie.split(';').filter(c => c.trim());
    let cleared = 0;
    cookies.forEach(c => {
      const name = c.split('=')[0].trim();
      if (name) {
        const paths = ['/', '', location.pathname];
        const domain = location.hostname;
        paths.forEach(p => {
          document.cookie = `${name}=;expires=Thu,01 Jan 1970 00:00:00 GMT;path=${p}`;
          document.cookie = `${name}=;expires=Thu,01 Jan 1970 00:00:00 GMT;path=${p};domain=${domain}`;
          document.cookie = `${name}=;expires=Thu,01 Jan 1970 00:00:00 GMT;path=${p};domain=.${domain}`;
        });
        cleared++;
      }
    });
    if (window.webOmniShowToast) window.webOmniShowToast(`已清除 ${cleared} 个 Cookie`, 'success');
  }

  // ===== 6. 防截图 =====
  function antiScreenshot() {
    if (window._woAntiSS) {
      document.body.style.filter = '';
      document.body.style.userSelect = '';
      const st = document.getElementById('wo-anti-ss');
      if (st) st.remove();
      window._woAntiSS = false;
      if (window.webOmniShowToast) window.webOmniShowToast('防截图模式已关闭', 'info');
      return;
    }
    window._woAntiSS = true;

    const style = document.createElement('style');
    style.id = 'wo-anti-ss';
    style.textContent = `@media print { body { display: none !important; } } body { -webkit-user-select: none; user-select: none; }`;
    document.head.appendChild(style);

    document.addEventListener('keydown', function woAntiKey(e) {
      if (e.key === 'PrintScreen' || (e.ctrlKey && e.key === 'p')) {
        e.preventDefault();
        document.body.style.filter = 'blur(30px)';
        setTimeout(() => { document.body.style.filter = ''; }, 2000);
      }
    });

    document.addEventListener('visibilitychange', function() {
      if (document.hidden && window._woAntiSS) {
        document.body.style.filter = 'blur(20px)';
      } else {
        document.body.style.filter = '';
      }
    });

    if (window.webOmniShowToast) window.webOmniShowToast('防截图模式已开启（再次点击关闭）', 'success');
  }

  // ===== 7. 指纹保护 (Canvas + WebGL + AudioContext) =====
  function fingerprintProtect() {
    if (window._woFPBlocked) {
      if (window.webOmniShowToast) window.webOmniShowToast('指纹保护已在运行中', 'info');
      return;
    }
    window._woFPBlocked = true;
    let protected_items = [];

    // Canvas 指纹噪声注入
    try {
      const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type) {
        const ctx = this.getContext('2d');
        if (ctx && this.width > 0 && this.height > 0) {
          try {
            const imageData = ctx.getImageData(0, 0, Math.min(this.width, 10), Math.min(this.height, 10));
            for (let i = 0; i < imageData.data.length; i += 4) {
              imageData.data[i] = imageData.data[i] ^ (Math.random() > 0.5 ? 1 : 0);     // R
              imageData.data[i+1] = imageData.data[i+1] ^ (Math.random() > 0.5 ? 1 : 0); // G
            }
            ctx.putImageData(imageData, 0, 0);
          } catch(e) {}
        }
        return origToDataURL.apply(this, arguments);
      };

      const origToBlob = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
        const ctx = this.getContext('2d');
        if (ctx && this.width > 0 && this.height > 0) {
          try {
            const imageData = ctx.getImageData(0, 0, Math.min(this.width, 10), Math.min(this.height, 10));
            for (let i = 0; i < imageData.data.length; i += 4) {
              imageData.data[i] = imageData.data[i] ^ (Math.random() > 0.5 ? 1 : 0);
            }
            ctx.putImageData(imageData, 0, 0);
          } catch(e) {}
        }
        return origToBlob.apply(this, arguments);
      };
      protected_items.push('Canvas 指纹');
    } catch(e) {}

    // WebGL 渲染器/供应商伪装
    try {
      const getParam = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(param) {
        // UNMASKED_VENDOR_WEBGL
        if (param === 0x9245) return 'Google Inc. (Web-Omni Protected)';
        // UNMASKED_RENDERER_WEBGL
        if (param === 0x9246) return 'ANGLE (Web-Omni Protected, OpenGL ES 3.0)';
        return getParam.apply(this, arguments);
      };

      if (typeof WebGL2RenderingContext !== 'undefined') {
        const getParam2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function(param) {
          if (param === 0x9245) return 'Google Inc. (Web-Omni Protected)';
          if (param === 0x9246) return 'ANGLE (Web-Omni Protected, OpenGL ES 3.0)';
          return getParam2.apply(this, arguments);
        };
      }
      protected_items.push('WebGL 指纹');
    } catch(e) {}

    // AudioContext 指纹干扰
    try {
      const origGetFloat = AnalyserNode.prototype.getFloatFrequencyData;
      AnalyserNode.prototype.getFloatFrequencyData = function(array) {
        origGetFloat.apply(this, arguments);
        for (let i = 0; i < array.length; i++) {
          array[i] += (Math.random() - 0.5) * 0.001;
        }
      };
      protected_items.push('Audio 指纹');
    } catch(e) {}

    // Navigator 属性伪装
    try {
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
      protected_items.push('硬件信息');
    } catch(e) {}

    // 屏幕信息伪装
    try {
      Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
      protected_items.push('屏幕信息');
    } catch(e) {}

    showPrivacyPanel('指纹保护', `<div style="padding:8px 0;">
      <p style="color:#3fb950;font-size:13px;margin-bottom:12px;">✓ 已启用浏览器指纹保护</p>
      <div style="font-size:12px;color:#8b949e;margin-bottom:8px;">已保护项目:</div>
      ${protected_items.map(item => `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px;border-bottom:1px solid #21262d;">
        <span style="color:#3fb950;">●</span> ${item}
      </div>`).join('')}
      <p style="color:#8b949e;font-size:11px;margin-top:12px;">网站将获取到伪造的浏览器指纹信息，有效降低跨站追踪</p>
    </div>`);
  }

  // ===== 8. 隐私评分扫描 =====
  function privacyScan() {
    let score = 100;
    const risks = [];

    // 检测追踪脚本
    const trackerDomains = ['google-analytics.com','googletagmanager.com','doubleclick.net','facebook.net','hotjar.com','mixpanel.com','clarity.ms','cnzz.com','51.la','umeng.com','baidu.com/hm.js'];
    const scripts = document.querySelectorAll('script[src]');
    let trackerCount = 0;
    scripts.forEach(s => {
      if (trackerDomains.some(d => (s.src || '').includes(d))) trackerCount++;
    });
    if (trackerCount > 0) { score -= trackerCount * 8; risks.push({ level: 'high', text: `检测到 ${trackerCount} 个追踪脚本`, fix: 'PRIVACY_BLOCK_TRACKERS' }); }

    // 检查 Cookie 数量
    const cookieCount = document.cookie.split(';').filter(c => c.trim()).length;
    if (cookieCount > 10) { score -= 10; risks.push({ level: 'medium', text: `${cookieCount} 个 Cookie 存在`, fix: 'PRIVACY_CLEAR_COOKIES' }); }
    else if (cookieCount > 0) { score -= 3; risks.push({ level: 'low', text: `${cookieCount} 个 Cookie`, fix: 'PRIVACY_CLEAR_COOKIES' }); }

    // 检查 localStorage
    const storageCount = localStorage.length;
    if (storageCount > 20) { score -= 8; risks.push({ level: 'medium', text: `localStorage 存储 ${storageCount} 项数据`, fix: 'PRIVACY_CLEAN_TRACES' }); }
    else if (storageCount > 0) { score -= 2; risks.push({ level: 'low', text: `localStorage ${storageCount} 项`, fix: 'PRIVACY_CLEAN_TRACES' }); }

    // 检查 Referrer
    const referrerMeta = document.querySelector('meta[name="referrer"]');
    if (!referrerMeta || referrerMeta.content !== 'no-referrer') {
      score -= 5; risks.push({ level: 'low', text: 'Referrer 策略未设置为 no-referrer', fix: 'PRIVACY_STRIP_REFERRER' });
    }

    // 追踪像素
    const pixels = document.querySelectorAll('img[width="1"],img[height="1"]');
    if (pixels.length > 0) { score -= pixels.length * 5; risks.push({ level: 'medium', text: `${pixels.length} 个追踪像素`, fix: 'PRIVACY_BLOCK_TRACKERS' }); }

    // WebRTC
    if (!window._woWebRTCBlocked && window.RTCPeerConnection) {
      score -= 5; risks.push({ level: 'low', text: 'WebRTC 未禁用 (可能泄露真实 IP)', fix: 'PRIVACY_WEBRTC_PROTECT' });
    }

    // 指纹保护
    if (!window._woFPBlocked) {
      score -= 5; risks.push({ level: 'low', text: '浏览器指纹未保护', fix: 'PRIVACY_FINGERPRINT_PROTECT' });
    }

    score = Math.max(0, Math.min(100, score));

    // 评分颜色
    let scoreColor = '#3fb950';
    let scoreLabel = '优秀';
    if (score < 80) { scoreColor = '#58a6ff'; scoreLabel = '良好'; }
    if (score < 60) { scoreColor = '#d29922'; scoreLabel = '一般'; }
    if (score < 40) { scoreColor = '#f85149'; scoreLabel = '较差'; }

    const riskHTML = risks.map(r => {
      const lc = r.level === 'high' ? '#f85149' : r.level === 'medium' ? '#d29922' : '#8b949e';
      const ll = r.level === 'high' ? '高危' : r.level === 'medium' ? '中危' : '低危';
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #21262d;">
        <span style="font-size:10px;padding:1px 6px;border-radius:10px;background:${lc}22;color:${lc};border:1px solid ${lc}44;">${ll}</span>
        <span style="flex:1;font-size:12px;color:#c9d1d9;">${r.text}</span>
        <button class="wo-fix-btn" data-action="${r.fix}" style="font-size:11px;padding:2px 8px;background:#21262d;border:1px solid #30363d;color:#58a6ff;border-radius:4px;cursor:pointer;">修复</button>
      </div>`;
    }).join('');

    showPrivacyPanel('隐私评分', `<div style="padding:8px 0;">
      <div style="text-align:center;margin-bottom:16px;">
        <div style="font-size:48px;font-weight:700;color:${scoreColor};">${score}</div>
        <div style="font-size:13px;color:${scoreColor};">${scoreLabel}</div>
      </div>
      <div style="font-size:12px;color:#8b949e;margin-bottom:8px;">检测到 ${risks.length} 个风险项:</div>
      ${risks.length > 0 ? riskHTML : '<p style="color:#3fb950;font-size:12px;">✓ 未检测到隐私风险</p>'}
    </div>`, () => {
      // 修复按钮点击
      document.querySelectorAll('.wo-fix-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          chrome.runtime.sendMessage({ action: btn.dataset.action });
        });
      });
    });
  }

  // ===== 通用面板 =====
  function showPrivacyPanel(title, html, onMount) {
    let existing = document.getElementById('wo-privacy-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'wo-privacy-panel';
    panel.style.cssText = `position:fixed;top:0;right:0;width:380px;height:100vh;z-index:2147483646;
      background:#161b22;border-left:1px solid #30363d;overflow-y:auto;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#c9d1d9;
      transform:translateX(100%);transition:transform 0.25s ease;`;
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #21262d;position:sticky;top:0;background:#161b22;z-index:2;">
        <span style="font-size:14px;font-weight:600;color:#e6edf3;">${title}</span>
        <button id="wo-pp-close" style="background:#21262d;border:1px solid #30363d;color:#8b949e;padding:3px 8px;border-radius:6px;cursor:pointer;font-size:12px;">✕</button>
      </div>
      <div style="padding:12px 16px;">${html}</div>
    `;
    document.body.appendChild(panel);
    requestAnimationFrame(() => requestAnimationFrame(() => panel.style.transform = 'translateX(0)'));
    panel.querySelector('#wo-pp-close').onclick = () => {
      panel.style.transform = 'translateX(100%)';
      setTimeout(() => panel.remove(), 250);
    };
    if (onMount) setTimeout(onMount, 50);
  }

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
})();
