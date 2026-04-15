// Web-Omni 密码管理器 — 独立页面逻辑
// 必须作为外部 JS 文件加载（MV3 CSP 禁止内联脚本）
(function(){
  'use strict';
  const LOCK_MS = 5 * 60 * 1000;
  let dKey = null, lockTm = null, entries = [];
  const $ = id => document.getElementById(id);

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  async function dk(pw, salt) {
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
      km,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function enc(d, k) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(JSON.stringify(d)));
    return { iv: Array.from(iv), data: Array.from(new Uint8Array(ct)) };
  }

  async function dec(o, k) {
    try {
      return JSON.parse(new TextDecoder().decode(
        await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(o.iv) }, k, new Uint8Array(o.data))
      ));
    } catch(e) { return null; }
  }

  function chkStr(pw) {
    let s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 12) s++;
    if (pw.length >= 16) s++;
    if (/[a-z]/.test(pw)) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^a-zA-Z0-9]/.test(pw)) s++;
    if (pw.length < 6) s = Math.min(s, 1);
    const L = [
      {m:0,l:'极弱',c:'#f85149',w:'15%'},
      {m:2,l:'弱',c:'#d29922',w:'30%'},
      {m:3,l:'一般',c:'#e3b341',w:'50%'},
      {m:5,l:'强',c:'#3fb950',w:'75%'},
      {m:6,l:'极强',c:'#58a6ff',w:'100%'}
    ];
    let r = L[0];
    for (const x of L) if (s >= x.m) r = x;
    return r;
  }

  function genPw(len, o) {
    len = len || 16;
    o = o || {};
    const lc='abcdefghijkmnopqrstuvwxyz', uc='ABCDEFGHJKLMNPQRSTUVWXYZ', dg='23456789', sy='!@#$%^&*_+-=?';
    let ch='', rq=[];
    if (o.lower !== false) { ch += lc; rq.push(lc); }
    if (o.upper !== false) { ch += uc; rq.push(uc); }
    if (o.digits !== false) { ch += dg; rq.push(dg); }
    if (o.symbols !== false) { ch += sy; rq.push(sy); }
    if (!ch) ch = lc + uc + dg;
    let pw = '';
    rq.forEach(s => { pw += s[Math.floor(Math.random() * s.length)]; });
    for (let i = pw.length; i < len; i++) pw += ch[Math.floor(Math.random() * ch.length)];
    return pw.split('').sort(() => Math.random() - 0.5).join('');
  }

  async function save() {
    if (!dKey) return;
    const e = await enc(entries, dKey);
    chrome.storage.local.set({ woVaultEntries: e });
  }

  function resetLock() {
    clearTimeout(lockTm);
    lockTm = setTimeout(() => { dKey = null; entries = []; showAuth(); }, LOCK_MS);
  }

  // ===== Auth =====
  async function init() {
    try {
      const st = await chrome.storage.local.get(['woVaultSalt', 'woVaultCheck']);
      if (!st.woVaultSalt) showSetup(); else showUnlock(st);
    } catch(e) {
      console.error('Vault init error:', e);
      $('authScreen').innerHTML = '<div class="auth-box"><div class="auth-icon">!</div><h2 class="auth-title">加载失败</h2><p class="auth-desc">请确保从扩展页面打开此页面</p></div>';
    }
  }

  function showAuth() {
    $('authScreen').style.display = 'flex';
    $('mainScreen').style.display = 'none';
    $('headerBtns').style.display = 'none';
    init();
  }

  function showSetup() {
    $('authScreen').innerHTML = '<div class="auth-box">'
      + '<div class="auth-icon">[ + ]</div>'
      + '<h2 class="auth-title">创建密码库</h2>'
      + '<p class="auth-desc">设置主密码和安全码来保护你的凭据</p>'
      + '<div class="form-group"><label class="label">主密码 (至少8位)</label>'
      + '<input id="sp1" type="password" class="input" placeholder="设置强密码">'
      + '<div class="strength-bar"><div id="sb" class="strength-fill" style="width:0;"></div></div>'
      + '<div id="st" style="font-size:11px;margin-top:3px;color:#8b949e;"></div></div>'
      + '<div class="form-group"><label class="label">确认主密码</label>'
      + '<input id="sp2" type="password" class="input" placeholder="再次输入"></div>'
      + '<div class="form-group"><label class="label">安全码 (4-8位数字)</label>'
      + '<input id="spin" type="password" class="input" placeholder="数字安全码" maxlength="8"></div>'
      + '<button id="sbtn" class="btn btn-green" style="width:100%;margin-top:8px;padding:10px;">创建密码库</button>'
      + '</div>';

    $('sp1').addEventListener('input', e => {
      const s = chkStr(e.target.value);
      $('sb').style.cssText = 'width:' + s.w + ';background:' + s.c + ';height:100%;border-radius:2px;transition:all 0.3s;';
      $('st').textContent = e.target.value ? '强度: ' + s.l : '';
      $('st').style.color = s.c;
    });

    $('sbtn').addEventListener('click', async () => {
      const p1 = $('sp1').value, p2 = $('sp2').value, pin = $('spin').value;
      if (p1.length < 8) { alert('主密码至少8位'); return; }
      if (p1 !== p2) { alert('密码不一致'); return; }
      if (pin.length < 4) { alert('安全码至少4位'); return; }
      const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)));
      dKey = await dk(p1 + ':' + pin, new Uint8Array(salt));
      const ck = await enc({ check: 'OK', t: Date.now() }, dKey);
      await chrome.storage.local.set({ woVaultSalt: salt, woVaultCheck: ck, woVaultEntries: null });
      entries = [];
      resetLock();
      showMain();
    });
  }

  function showUnlock(st) {
    $('authScreen').innerHTML = '<div class="auth-box">'
      + '<div class="auth-icon">[ * ]</div>'
      + '<h2 class="auth-title">解锁密码库</h2>'
      + '<p class="auth-desc">输入主密码和安全码</p>'
      + '<div class="form-group"><input id="upw" type="password" class="input" placeholder="主密码"></div>'
      + '<div class="form-group"><input id="upin" type="password" class="input" placeholder="安全码" maxlength="8"></div>'
      + '<button id="ubtn" class="btn btn-green" style="width:100%;padding:10px;">解锁</button>'
      + '<button id="urst" class="btn" style="width:100%;margin-top:8px;color:#8b949e;">忘记密码？重置</button>'
      + '</div>';

    async function tryU() {
      const pw = $('upw').value, pin = $('upin').value;
      if (!pw || !pin) return;
      dKey = await dk(pw + ':' + pin, new Uint8Array(st.woVaultSalt));
      const ck = await dec(st.woVaultCheck, dKey);
      if (!ck || ck.check !== 'OK') { alert('密码或安全码错误'); dKey = null; return; }
      const st2 = await chrome.storage.local.get(['woVaultEntries']);
      entries = st2.woVaultEntries ? (await dec(st2.woVaultEntries, dKey)) || [] : [];
      resetLock();
      showMain();
    }

    $('ubtn').addEventListener('click', tryU);
    $('upw').addEventListener('keydown', e => { if (e.key === 'Enter') $('upin').focus(); });
    $('upin').addEventListener('keydown', e => { if (e.key === 'Enter') tryU(); });
    $('urst').addEventListener('click', () => {
      if (confirm('重置将删除所有已保存的密码！确定吗？')) {
        chrome.storage.local.remove(['woVaultSalt', 'woVaultCheck', 'woVaultEntries'], () => init());
      }
    });
    setTimeout(() => $('upw').focus(), 200);
  }

  // ===== Main =====
  function showMain() {
    $('authScreen').style.display = 'none';
    $('mainScreen').style.display = 'block';
    $('headerBtns').style.display = 'flex';
    $('headerBtns').innerHTML = '<button class="btn" id="hExport">导出</button>'
      + '<button class="btn" id="hImport">导入</button>'
      + '<button class="btn" id="hLock">锁定</button>';

    $('hExport').onclick = () => {
      const b = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
      const u = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = u; a.download = 'vault-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
    };
    $('hImport').onclick = () => {
      const ip = document.createElement('input'); ip.type = 'file'; ip.accept = '.json';
      ip.onchange = async e => {
        try {
          const d = JSON.parse(await e.target.files[0].text());
          if (!Array.isArray(d)) throw 0;
          entries = [...entries, ...d]; await save(); renderVault();
          alert('导入 ' + d.length + ' 条');
        } catch(e) { alert('格式错误'); }
      };
      ip.click();
    };
    $('hLock').onclick = () => { dKey = null; entries = []; showAuth(); };

    $('mainTabs').addEventListener('click', e => {
      const t = e.target.closest('.tab');
      if (!t) return;
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      $('vaultTab').style.display = t.dataset.tab === 'vault' ? 'block' : 'none';
      $('generatorTab').style.display = t.dataset.tab === 'generator' ? 'block' : 'none';
    });

    renderVault();
    renderGenerator();
    checkHash();
  }

  function renderVault(filter) {
    filter = filter || '';
    $('countBadge').textContent = entries.length;
    const fi = entries.filter(e => !filter || (e.site + ' ' + e.username).toLowerCase().includes(filter.toLowerCase()));

    let html = '<div class="vault-header"><div class="search-box">'
      + '<input id="vSearch" class="input" placeholder="搜索..." value="' + esc(filter) + '"></div>'
      + '<button class="btn btn-green" id="vAdd">+ 新增</button></div>';

    if (!fi.length) {
      html += '<div class="empty"><span>--</span><p>' + (entries.length ? '无匹配结果' : '还没有保存的密码') + '</p></div>';
    } else {
      fi.forEach((e, i) => {
        const d = e.site ? e.site.replace(/^https?:\/\//, '').split('/')[0] : '?';
        html += '<div class="entry" data-i="' + i + '">'
          + '<div class="entry-icon">' + d[0].toUpperCase() + '</div>'
          + '<div class="entry-info"><div class="entry-site">' + esc(d) + '</div>'
          + '<div class="entry-user">' + esc(e.username || '(无用户名)') + '</div></div>'
          + '<div class="entry-actions">'
          + '<button class="btn" data-copy="' + esc(e.password) + '" style="padding:3px 8px;font-size:12px;">复制</button>'
          + '<button class="btn" data-del="' + i + '" style="padding:3px 8px;font-size:12px;">删除</button>'
          + '</div></div>';
      });
    }
    $('vaultTab').innerHTML = html;
    $('vSearch').addEventListener('input', e => renderVault(e.target.value));
    $('vAdd').addEventListener('click', showAddDialog);
    document.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      navigator.clipboard.writeText(b.dataset.copy);
      b.textContent = 'OK';
      setTimeout(() => b.textContent = '复制', 1500);
    }));
    document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm('删除此凭据？')) return;
      entries.splice(parseInt(b.dataset.del), 1);
      await save();
      renderVault();
    }));
  }

  function showAddDialog() {
    const ov = document.createElement('div'); ov.className = 'overlay';
    const gp = genPw(16), gs = chkStr(gp);
    ov.innerHTML = '<div class="dialog"><h3>添加凭据</h3>'
      + '<div class="form-group"><label class="label">网站</label><input id="as" class="input" placeholder="example.com"></div>'
      + '<div class="form-group"><label class="label">用户名 / 邮箱</label><input id="au" class="input" placeholder="user@example.com"></div>'
      + '<div class="form-group"><label class="label">密码</label><div style="display:flex;gap:6px;"><input id="ap" class="input" value="' + gp + '" style="flex:1;"><button class="btn" id="aGen">随机</button></div>'
      + '<div class="strength-bar"><div id="asb" class="strength-fill" style="width:' + gs.w + ';background:' + gs.c + ';"></div></div>'
      + '<span id="ast" style="font-size:11px;color:' + gs.c + ';">' + gs.l + '</span></div>'
      + '<div class="form-group"><label class="label">备注</label><input id="an" class="input" placeholder="可选"></div>'
      + '<div style="display:flex;gap:8px;margin-top:12px;"><button class="btn btn-green" id="aSave" style="flex:1;">保存</button><button class="btn" id="aCancel">取消</button></div></div>';
    document.body.appendChild(ov);

    $('ap').addEventListener('input', e => {
      const s = chkStr(e.target.value);
      $('asb').style.cssText = 'width:' + s.w + ';background:' + s.c + ';height:100%;border-radius:2px;transition:all 0.3s;';
      $('ast').style.color = s.c;
      $('ast').textContent = s.l;
    });
    $('aGen').addEventListener('click', () => { $('ap').value = genPw(16); $('ap').dispatchEvent(new Event('input')); });
    $('aSave').addEventListener('click', async () => {
      const s = $('as').value.trim(), u = $('au').value.trim(), p = $('ap').value, n = $('an').value.trim();
      if (!s || !p) { alert('网站和密码必填'); return; }
      entries.push({ site: s, username: u, password: p, note: n, created: Date.now() });
      await save(); ov.remove(); renderVault();
    });
    $('aCancel').addEventListener('click', () => ov.remove());
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  }

  function renderGenerator() {
    const pw = genPw(16), s = chkStr(pw);
    $('generatorTab').innerHTML = '<div class="panel"><div class="gen-result" id="gRes">' + pw + '</div>'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">'
      + '<div style="flex:1;"><div class="strength-bar"><div id="gSb" class="strength-fill" style="width:' + s.w + ';background:' + s.c + ';"></div></div></div>'
      + '<span id="gSt" style="font-size:12px;color:' + s.c + ';">' + s.l + '</span></div>'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'
      + '<label class="label" style="margin:0;width:36px;">长度</label>'
      + '<input id="gLen" type="range" min="6" max="64" value="16" style="flex:1;accent-color:#58a6ff;">'
      + '<span id="gLv" style="font-size:13px;">16</span></div>'
      + '<div class="options"><label><input type="checkbox" id="g1" checked>小写</label>'
      + '<label><input type="checkbox" id="g2" checked>大写</label>'
      + '<label><input type="checkbox" id="g3" checked>数字</label>'
      + '<label><input type="checkbox" id="g4" checked>符号</label></div>'
      + '<div style="display:flex;gap:8px;">'
      + '<button class="btn btn-green" id="gNew" style="flex:1;">重新生成</button>'
      + '<button class="btn" id="gCopy" style="flex:1;">复制</button></div></div>';

    function regen() {
      const l = parseInt($('gLen').value);
      const o = { lower: $('g1').checked, upper: $('g2').checked, digits: $('g3').checked, symbols: $('g4').checked };
      const p = genPw(l, o), s = chkStr(p);
      $('gRes').textContent = p;
      $('gSb').style.cssText = 'width:' + s.w + ';background:' + s.c + ';height:100%;border-radius:2px;transition:all 0.3s;';
      $('gSt').style.color = s.c;
      $('gSt').textContent = s.l;
    }
    $('gLen').addEventListener('input', e => { $('gLv').textContent = e.target.value; regen(); });
    ['g1','g2','g3','g4'].forEach(id => $(id).addEventListener('change', regen));
    $('gNew').addEventListener('click', regen);
    $('gCopy').addEventListener('click', () => {
      navigator.clipboard.writeText($('gRes').textContent);
      $('gCopy').textContent = '已复制';
      setTimeout(() => $('gCopy').textContent = '复制', 1500);
    });
  }

  function checkHash() {
    const hash = location.hash.replace('#', '');
    if (hash === 'generator' && $('mainScreen').style.display !== 'none') {
      document.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === 'generator');
      });
      $('vaultTab').style.display = 'none';
      $('generatorTab').style.display = 'block';
    }
  }
  window.addEventListener('hashchange', checkHash);

  // 启动
  init();
})();
