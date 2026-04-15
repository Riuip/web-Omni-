// 神经末梢：密码管理器入口 (Password Vault)
// 点击打开独立网页版密码管理器
(function() {
  if (window.webOmniPasswordVaultInjected) return;
  window.webOmniPasswordVaultInjected = true;

  chrome.runtime.onMessage.addListener((req) => {
    if (req.action === "OPEN_VAULT") {
      const url = chrome.runtime.getURL("vault/index.html");
      window.open(url, "_blank");
      if (window.webOmniShowToast) window.webOmniShowToast("正在打开密码管理器...", "info");
    }
    else if (req.action === "PASSWORD_GENERATOR") {
      const url = chrome.runtime.getURL("vault/index.html#generator");
      window.open(url, "_blank");
    }
    else if (req.action === "VAULT_AUTO_FILL") {
      vaultAutoFill();
    }
    else if (req.action === "VAULT_AUTO_SAVE") {
      vaultAutoSave();
    }
  });

  // ===== 一键填充（从 storage 读取并填充当前页面） =====
  async function vaultAutoFill() {
    const stored = await new Promise(r => chrome.storage.local.get(["woVaultSalt","woVaultCheck","woVaultEntries"], r));
    if (!stored.woVaultSalt || !stored.woVaultEntries) {
      if (window.webOmniShowToast) window.webOmniShowToast("请先打开密码管理器设置主密码", "warn");
      return;
    }
    // 尝试用简单匹配填充
    // 注意：由于安全限制，content script 无法直接解密
    // 需要提示用户打开密码管理器页面
    if (window.webOmniShowToast) window.webOmniShowToast("请打开密码管理器，在管理器中使用一键填充", "info");
    const url = chrome.runtime.getURL("vault/index.html");
    window.open(url, "_blank");
  }

  // ===== 自动保存检测 =====
  function vaultAutoSave() {
    document.querySelectorAll("form").forEach(form => {
      if (form._woAS) return;
      form._woAS = true;
      form.addEventListener("submit", () => {
        const pw = form.querySelector("input[type='password']");
        if (!pw || !pw.value) return;
        let u = "";
        form.querySelectorAll("input[type='text'],input[type='email'],input:not([type])").forEach(inp => {
          const id = ((inp.name||"")+" "+(inp.id||"")+" "+(inp.placeholder||"")).toLowerCase();
          if (id.match(/user|email|login|account|用户|邮箱/) && inp.value) u = inp.value;
        });
        // 提示保存
        const bar = document.createElement("div");
        bar.style.cssText = "position:fixed;top:12px;right:12px;z-index:2147483647;background:#161b22;border:1px solid #30363d;border-radius:6px;padding:14px 18px;font-family:-apple-system,sans-serif;color:#c9d1d9;max-width:320px;box-shadow:0 8px 32px rgba(0,0,0,0.4);transform:translateX(120%);transition:transform 0.3s;";
        bar.innerHTML = `<div style="font-size:13px;font-weight:600;margin-bottom:6px;">检测到登录</div><div style="font-size:12px;color:#8b949e;margin-bottom:8px;">${esc(location.hostname)} · ${esc(u||"(未知)")}</div><div style="display:flex;gap:6px;"><button id="wo-sv-y" style="flex:1;padding:6px;background:#238636;border:1px solid #2ea043;color:#fff;border-radius:6px;cursor:pointer;font-size:12px;">打开管理器保存</button><button id="wo-sv-n" style="padding:6px 12px;background:#21262d;border:1px solid #30363d;color:#8b949e;border-radius:6px;cursor:pointer;font-size:12px;">忽略</button></div>`;
        document.body.appendChild(bar);
        requestAnimationFrame(() => requestAnimationFrame(() => bar.style.transform = "translateX(0)"));
        const close = () => { bar.style.transform = "translateX(120%)"; setTimeout(() => bar.remove(), 300); };
        bar.querySelector("#wo-sv-y").addEventListener("click", () => { close(); window.open(chrome.runtime.getURL("vault/index.html"), "_blank"); });
        bar.querySelector("#wo-sv-n").addEventListener("click", close);
        setTimeout(() => { if (bar.parentElement) close(); }, 12000);
      });
    });
    if (window.webOmniShowToast) window.webOmniShowToast("登录检测已开启", "info");
  }

  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
})();
