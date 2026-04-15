// Web-Omni 局域网文件传输 — 完美版
// 本地 QR 码 · PeerJS 多服务器容错 · 拖拽上传 · 分块传输
(function () {
  'use strict';
  const CHUNK = 64 * 1024; // 64KB
  const $ = id => document.getElementById(id);

  // ============================================================
  //  工具函数
  // ============================================================
  function formatSize(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
    return (b / 1073741824).toFixed(2) + ' GB';
  }
  function generateRoomCode() {
    const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let r = '';
    for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)];
    return r;
  }
  function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // ============================================================
  //  本地 QR 码生成（使用已加载的 qrcode-generator 库）
  // ============================================================
  function renderQRCode(text, container, cellSize) {
    cellSize = cellSize || 4;
    container.innerHTML = '';
    try {
      var qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      var img = document.createElement('img');
      img.src = qr.createDataURL(cellSize, 0);
      img.style.cssText = 'width:160px;height:160px;image-rendering:pixelated;display:block;';
      container.appendChild(img);
    } catch (e) {
      container.textContent = '房间码: ' + text;
      container.style.cssText = 'font-family:monospace;font-size:14px;padding:20px;text-align:center;color:#e6edf3;';
    }
  }

  // ============================================================
  //  PeerJS 连接管理器（容错 + 自动重试）
  // ============================================================
  const roomCode = generateRoomCode();
  const peerId = 'wo-' + roomCode.toLowerCase();
  let peer = null;
  let activeConn = null;
  let retryCount = 0;
  const MAX_RETRIES = 3;

  // 多个 PeerJS 信令服务器（容错）
  const PEER_SERVERS = [
    {}, // 默认 PeerJS 云服务器 (0.peerjs.com)
    { host: '0.peerjs.com', port: 443, secure: true },
    { host: 'peerjs-server.herokuapp.com', port: 443, secure: true },
  ];

  function setStatus(text, state) {
    $('connText').textContent = text;
    $('connStatus').className = 'conn-status ' + (state || '');
  }

  function createPeer(serverIdx) {
    if (peer) { try { peer.destroy(); } catch(e){} }
    serverIdx = serverIdx || 0;

    const serverConfig = PEER_SERVERS[Math.min(serverIdx, PEER_SERVERS.length - 1)];
    const opts = {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
        ]
      }
    };
    if (serverConfig.host) {
      opts.host = serverConfig.host;
      opts.port = serverConfig.port;
      opts.secure = serverConfig.secure;
      opts.path = serverConfig.path || '/';
    }

    setStatus('正在连接信令服务器... (' + (serverIdx + 1) + '/' + PEER_SERVERS.length + ')', 'connecting');

    peer = new Peer(peerId, opts);

    // 连接超时
    const timeout = setTimeout(() => {
      if (peer && !peer.open) {
        console.warn('[WO] Peer server ' + serverIdx + ' timeout');
        if (serverIdx + 1 < PEER_SERVERS.length) {
          createPeer(serverIdx + 1); // 尝试下一个服务器
        } else if (retryCount < MAX_RETRIES) {
          retryCount++;
          setStatus('连接超时，重试中... (' + retryCount + '/' + MAX_RETRIES + ')', 'connecting');
          createPeer(0);
        } else {
          setStatus('信令服务器不可用，请检查网络', '');
        }
      }
    }, 8000);

    peer.on('open', (id) => {
      clearTimeout(timeout);
      retryCount = 0;
      setStatus('等待手机连接...', 'connecting');

      // 生成 QR 码（编码房间码，不是 chrome-extension URL）
      renderQRCode(roomCode, $('qrTarget'));
      $('roomCodeDisplay').textContent = roomCode;
    });

    peer.on('connection', (conn) => {
      activeConn = conn;
      setStatus('已连接', 'connected');
      setupDataHandlers(conn);

      conn.on('close', () => {
        activeConn = null;
        setStatus('对方已断开', 'connecting');
      });
    });

    peer.on('error', (err) => {
      clearTimeout(timeout);
      console.error('[WO] Peer error:', err);

      if (err.type === 'unavailable-id') {
        // ID 被占用，加随机后缀重试
        const newId = peerId + Math.random().toString(36).substr(2, 2);
        peer = new Peer(newId, opts);
        return;
      }

      if (serverIdx + 1 < PEER_SERVERS.length) {
        createPeer(serverIdx + 1);
      } else {
        setStatus('连接失败: ' + err.type, '');
      }
    });

    peer.on('disconnected', () => {
      if (!peer.destroyed) {
        setStatus('连接断开，重连中...', 'connecting');
        try { peer.reconnect(); } catch(e){}
      }
    });
  }

  // ============================================================
  //  数据接收处理
  // ============================================================
  const recvFiles = {};

  function setupDataHandlers(conn) {
    conn.on('data', (data) => {
      if (!data || typeof data !== 'object') return;

      switch (data.type) {
        case 'file-meta':
          recvFiles[data.id] = { name: data.name, size: data.size, chunks: [], received: 0, startTime: Date.now() };
          addFileItem(data.id, data.name, data.size, 'recv', '接收中...');
          break;

        case 'file-chunk':
          const rf = recvFiles[data.id];
          if (!rf) return;
          rf.chunks.push(data.chunk);
          rf.received += data.chunk.byteLength || data.chunk.length || 0;
          const pct = Math.min(100, Math.round(rf.received / rf.size * 100));
          const speed = rf.received / ((Date.now() - rf.startTime) / 1000);
          updateFileProgress(data.id, pct, formatSize(Math.round(speed)) + '/s');
          break;

        case 'file-done':
          const df = recvFiles[data.id];
          if (!df) return;
          try {
            const blob = new Blob(df.chunks);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = df.name;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
            const elapsed = ((Date.now() - df.startTime) / 1000).toFixed(1);
            updateFileStatus(data.id, '已保存 (' + elapsed + 's)', 'done');
          } catch (e) {
            updateFileStatus(data.id, '保存失败', 'error');
          }
          delete recvFiles[data.id];
          break;
      }
    });
  }

  // ============================================================
  //  文件发送（电脑 → 手机）
  // ============================================================
  function sendFile(file) {
    if (!activeConn || !activeConn.open) {
      alert('没有已连接的设备。请先让手机扫码连接。');
      return;
    }
    const id = 'send-' + Math.random().toString(36).substr(2, 8);
    addFileItem(id, file.name, file.size, 'send', '发送中...');

    activeConn.send({ type: 'file-meta', id: id, name: file.name, size: file.size });

    const startTime = Date.now();
    let offset = 0;
    const reader = new FileReader();

    function readNext() {
      reader.readAsArrayBuffer(file.slice(offset, offset + CHUNK));
    }

    reader.onload = (ev) => {
      activeConn.send({ type: 'file-chunk', id: id, chunk: ev.target.result });
      offset += ev.target.result.byteLength;

      const pct = Math.min(100, Math.round(offset / file.size * 100));
      const speed = offset / ((Date.now() - startTime) / 1000);
      updateFileProgress(id, pct, formatSize(Math.round(speed)) + '/s');

      if (offset < file.size) {
        // 流控：避免淹没 DataChannel 缓冲区
        const dc = activeConn.dataChannel || activeConn._dc;
        if (dc && dc.bufferedAmount > 8 * CHUNK) {
          setTimeout(readNext, 50);
        } else {
          readNext();
        }
      } else {
        activeConn.send({ type: 'file-done', id: id });
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        updateFileStatus(id, '已发送 (' + elapsed + 's)', 'done');
      }
    };

    reader.onerror = () => {
      updateFileStatus(id, '读取失败', 'error');
    };

    readNext();
  }

  // ============================================================
  //  文件列表 UI
  // ============================================================
  function addFileItem(id, name, size, dir, status) {
    const list = $('fileList');
    if (list.querySelector('.empty-state')) list.innerHTML = '';

    const arrow = dir === 'recv' ? '↓' : '↑';
    const label = dir === 'recv' ? '接收' : '发送';
    const item = document.createElement('div');
    item.className = 'file-item';
    item.dataset.id = id;
    item.innerHTML = '<div class="icon" title="' + label + '">' + arrow + '</div>'
      + '<div class="info"><div class="name">' + escHtml(name) + '</div>'
      + '<div class="meta">' + formatSize(size) + ' <span class="speed"></span></div>'
      + '<div class="progress"><div class="progress-bar" style="width:0%"></div></div></div>'
      + '<div class="status">' + status + '</div>';
    list.appendChild(item);
  }

  function updateFileProgress(id, pct, speedText) {
    const item = document.querySelector('.file-item[data-id="' + id + '"]');
    if (!item) return;
    item.querySelector('.progress-bar').style.width = pct + '%';
    const sp = item.querySelector('.speed');
    if (sp && speedText) sp.textContent = '· ' + speedText;
  }

  function updateFileStatus(id, text, cls) {
    const item = document.querySelector('.file-item[data-id="' + id + '"]');
    if (!item) return;
    item.querySelector('.progress-bar').style.width = '100%';
    if (cls === 'done') item.querySelector('.progress-bar').style.background = '#3fb950';
    if (cls === 'error') item.querySelector('.progress-bar').style.background = '#f85149';
    const s = item.querySelector('.status');
    s.textContent = text;
    s.className = 'status ' + (cls || '');
  }

  // ============================================================
  //  拖拽上传
  // ============================================================
  const dz = $('dropZone'), fi = $('fileInput');
  if (dz && fi) {
    // 点击选择
    dz.addEventListener('click', (e) => {
      if (e.target !== fi && e.target.tagName !== 'LABEL') fi.click();
    });

    // 拖拽
    ['dragenter', 'dragover'].forEach(evt => {
      dz.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dz.classList.add('drag-over'); });
    });
    ['dragleave', 'drop'].forEach(evt => {
      dz.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dz.classList.remove('drag-over'); });
    });
    dz.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) Array.from(files).forEach(f => sendFile(f));
    });

    // 文件选择器
    fi.addEventListener('change', (e) => {
      if (e.target.files.length > 0) Array.from(e.target.files).forEach(f => sendFile(f));
      fi.value = '';
    });
  }

  // 同时支持拖拽到整个页面
  document.body.addEventListener('dragover', (e) => { e.preventDefault(); });
  document.body.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      Array.from(e.dataTransfer.files).forEach(f => sendFile(f));
    }
  });

  // ============================================================
  //  按钮事件
  // ============================================================
  $('copyCode').addEventListener('click', () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      $('copyCode').textContent = '已复制';
      setTimeout(() => $('copyCode').textContent = '复制房间码', 2000);
    });
  });

  $('reconnectBtn').addEventListener('click', () => {
    retryCount = 0;
    createPeer(0);
  });

  $('downloadMobile').addEventListener('click', () => {
    const pid = peer && peer.id ? peer.id : peerId;
    generateMobilePage(pid, roomCode);
  });

  // ============================================================
  //  生成独立手机端 HTML（完全自包含）
  // ============================================================
  function generateMobilePage(peerId, roomCode) {
    // 注意：手机端在普通浏览器打开，可以使用 CDN
    const html = '<!DOCTYPE html>\n'
+ '<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n'
+ '<title>Web-Omni 传文件</title>\n'
+ '<style>\n'
+ '*{margin:0;padding:0;box-sizing:border-box}\n'
+ 'body{font-family:-apple-system,system-ui,sans-serif;background:#0d1117;color:#e6edf3;min-height:100vh}\n'
+ '.c{max-width:420px;margin:0 auto;padding:24px 16px}\n'
+ 'h1{font-size:20px;font-weight:600;text-align:center;margin:20px 0 4px}\n'
+ '.sub{text-align:center;font-size:13px;color:#8b949e;margin-bottom:24px}\n'
+ '.panel{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px;margin-bottom:12px}\n'
+ '.label{font-size:12px;color:#8b949e;margin-bottom:6px}\n'
+ '.code-input{width:100%;padding:12px;background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#e6edf3;font-size:20px;text-align:center;letter-spacing:6px;font-family:ui-monospace,monospace;text-transform:uppercase;outline:none}\n'
+ '.code-input:focus{border-color:#58a6ff;box-shadow:0 0 0 3px rgba(88,166,255,0.15)}\n'
+ '.btn{width:100%;padding:12px;font-size:14px;font-weight:600;border-radius:6px;border:none;cursor:pointer;font-family:inherit;margin-top:8px}\n'
+ '.btn-primary{background:#238636;color:#fff}\n'
+ '.btn-primary:active{background:#2ea043}\n'
+ '.btn-primary:disabled{opacity:0.5;cursor:not-allowed}\n'
+ '.st{display:flex;align-items:center;justify-content:center;gap:6px;font-size:13px;color:#8b949e;margin:12px 0}\n'
+ '.st .d{width:8px;height:8px;border-radius:50%;background:#484f58}\n'
+ '.st.ok .d{background:#3fb950}\n'
+ '.st.wait .d{background:#d29922;animation:p 1s infinite}\n'
+ '@keyframes p{0%,100%{opacity:1}50%{opacity:.3}}\n'
+ '.drop{padding:32px;border:2px dashed #30363d;border-radius:8px;text-align:center;color:#8b949e;cursor:pointer;margin-top:12px;display:none}\n'
+ '.drop.show{display:block}\n'
+ '.drop:active{border-color:#58a6ff}\n'
+ '.fi{display:flex;align-items:center;gap:8px;padding:10px;background:#0d1117;border:1px solid #21262d;border-radius:6px;margin-top:6px}\n'
+ '.fi .n{flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n'
+ '.fi .s{font-size:12px;color:#3fb950;white-space:nowrap}\n'
+ '.info{text-align:center;font-size:11px;color:#484f58;margin-top:20px;line-height:1.6}\n'
+ '</style></head><body><div class="c">\n'
+ '<h1>Web-Omni</h1>\n'
+ '<p class="sub">局域网文件传输 · 手机端</p>\n'
+ '<div class="panel">\n'
+ '<div class="label">输入电脑上显示的房间码</div>\n'
+ '<input class="code-input" id="code" maxlength="6" placeholder="------" value="' + roomCode + '">\n'
+ '<button class="btn btn-primary" id="go">连接</button>\n'
+ '</div>\n'
+ '<div class="st wait" id="st"><span class="d"></span><span id="stx">输入房间码后点击连接</span></div>\n'
+ '<div class="drop" id="dr">点击选择文件发送到电脑</div>\n'
+ '<input type="file" id="fi" multiple hidden>\n'
+ '<div id="fl"></div>\n'
+ '<div class="info">文件通过 WebRTC P2P 直接传输到电脑<br>不经过任何服务器存储</div>\n'
+ '</div>\n'
+ '<script src="https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js"></'+'script>\n'
+ '<script>\n'
+ 'var CHUNK=64*1024,conn=null;\n'
+ 'function $(i){return document.getElementById(i)}\n'
+ 'function fmt(b){if(b<1024)return b+" B";if(b<1048576)return(b/1024).toFixed(1)+" KB";return(b/1048576).toFixed(1)+" MB"}\n'
+ '$("go").onclick=function(){\n'
+ '  var code=$("code").value.trim().toUpperCase();\n'
+ '  if(code.length<4){alert("请输入房间码");return;}\n'
+ '  $("go").disabled=true;$("go").textContent="连接中...";\n'
+ '  $("stx").textContent="正在连接...";$("st").className="st wait";\n'
+ '  var pid="wo-"+code.toLowerCase();\n'
+ '  var p=new Peer(undefined,{config:{iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun1.l.google.com:19302"}]}});\n'
+ '  p.on("open",function(){\n'
+ '    conn=p.connect(pid,{reliable:true,serialization:"binary"});\n'
+ '    conn.on("open",function(){\n'
+ '      $("stx").textContent="已连接到电脑";$("st").className="st ok";\n'
+ '      $("go").textContent="已连接";$("dr").className="drop show";\n'
+ '    });\n'
+ '    conn.on("error",function(e){$("stx").textContent="连接失败";$("go").disabled=false;$("go").textContent="重试";});\n'
+ '    conn.on("close",function(){$("stx").textContent="连接已断开";$("go").disabled=false;$("go").textContent="重新连接";$("dr").className="drop";});\n'
+ '    conn.on("data",function(d){\n'
+ '      if(d&&d.type==="file-meta"){addRecv(d.id,d.name,d.size);}\n'
+ '      if(d&&d.type==="file-chunk"&&window._rb&&window._rb[d.id]){window._rb[d.id].chunks.push(d.chunk);window._rb[d.id].got+=d.chunk.byteLength||0;updRecv(d.id);}\n'
+ '      if(d&&d.type==="file-done"&&window._rb&&window._rb[d.id]){saveRecv(d.id);}\n'
+ '    });\n'
+ '  });\n'
+ '  p.on("error",function(e){\n'
+ '    $("stx").textContent="连接错误: "+e.type;\n'
+ '    $("go").disabled=false;$("go").textContent="重试";\n'
+ '  });\n'
+ '  setTimeout(function(){if(!conn||conn.open===false){$("stx").textContent="连接超时，请检查房间码";$("go").disabled=false;$("go").textContent="重试";}},15000);\n'
+ '};\n'
+ 'window._rb={};\n'
+ 'function addRecv(id,name,size){window._rb[id]={name:name,size:size,chunks:[],got:0};var e=document.createElement("div");e.className="fi";e.id="r-"+id;e.innerHTML="<span class=\\"n\\">"+name+"</span><span class=\\"s\\" id=\\"rs-"+id+"\\">0%</span>";$("fl").appendChild(e);}\n'
+ 'function updRecv(id){var r=window._rb[id];if(!r)return;var p=Math.min(100,Math.round(r.got/r.size*100));document.getElementById("rs-"+id).textContent=p+"%";}\n'
+ 'function saveRecv(id){var r=window._rb[id];if(!r)return;var b=new Blob(r.chunks);var u=URL.createObjectURL(b);var a=document.createElement("a");a.href=u;a.download=r.name;document.body.appendChild(a);a.click();a.remove();document.getElementById("rs-"+id).textContent="Done";delete window._rb[id];}\n'
+ '$("dr").onclick=function(){$("fi").click();};\n'
+ '$("fi").onchange=function(e){\n'
+ '  if(!conn||!conn.open){alert("未连接到电脑");return;}\n'
+ '  Array.from(e.target.files).forEach(function(file){\n'
+ '    var id=Math.random().toString(36).substr(2,8);\n'
+ '    conn.send({type:"file-meta",id:id,name:file.name,size:file.size});\n'
+ '    var el=document.createElement("div");el.className="fi";\n'
+ '    el.innerHTML="<span class=\\"n\\">"+file.name+" ("+fmt(file.size)+")</span><span class=\\"s\\" id=\\"s-"+id+"\\">0%</span>";\n'
+ '    $("fl").appendChild(el);\n'
+ '    var off=0,rd=new FileReader();\n'
+ '    function next(){rd.readAsArrayBuffer(file.slice(off,off+CHUNK));}\n'
+ '    rd.onload=function(ev){\n'
+ '      conn.send({type:"file-chunk",id:id,chunk:ev.target.result});\n'
+ '      off+=ev.target.result.byteLength;\n'
+ '      var pct=Math.min(100,Math.round(off/file.size*100));\n'
+ '      document.getElementById("s-"+id).textContent=pct+"%";\n'
+ '      if(off<file.size){setTimeout(next,10);}else{\n'
+ '        conn.send({type:"file-done",id:id});\n'
+ '        document.getElementById("s-"+id).textContent="Done";\n'
+ '      }\n'
+ '    };\n'
+ '    next();\n'
+ '  });\n'
+ '};\n'
+ 'if($("code").value.length>=4){$("go").click();}\n'
+ '</'+'script></body></html>';

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'web-omni-mobile.html'; a.click();
    URL.revokeObjectURL(url);
  }

  // ============================================================
  //  启动
  // ============================================================
  $('roomCodeDisplay').textContent = roomCode;
  createPeer(0);

})();
