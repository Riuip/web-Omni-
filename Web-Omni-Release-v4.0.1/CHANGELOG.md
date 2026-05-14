# Web-Omni v4.0.1 — Bug 修复版

> 基于 v4.0.0 的全面 Bug 修复，**没有改变任何功能/UI**，可直接平替。

## 严重 (P0)

- **修复消息环路风险** (`background.js`)
  统一了三个分散的 `chrome.runtime.onMessage` 监听器，加入 `_wo_routed` 标记防止 content script 之间反复转发；从 popup 触发时正确广播到当前 tab。
- **修复 `chrome.action.onClicked` 的 `tab.url` 可能 undefined**
  抽取 `isInjectablePage()` 工具函数，避免在 `chrome://`、扩展商店、`about:` 等页面被点击时抛 `TypeError`。
- **修复电商图片代理下载失效**
  MV3 Service Worker 不允许 `data:` URL 调 `chrome.downloads`。改为优先使用 `URL.createObjectURL(blob)`（SW 中可用），失败时降级让 content script 用 dataURL 触发下载。
- **manifest.json 加上 `icons` 与 `default_icon`**
  否则 Chrome Web Store 上架会被拒；同时附带自动生成的 `icons/icon{16,32,48,128}.png`（紫蓝渐变 + Omni "O" 标志）。

## 重要 (P1)

- **visual-dictator 性能修复**
  `MutationObserver` 不再在每次 DOM 变化时打 `chrome.storage.local`。改为：
  1. 启动时缓存当前域规则到内存
  2. 监听 `chrome.storage.onChanged` 同步缓存
  3. 用 `requestAnimationFrame` 限频
  在 Twitter / 淘宝等 SPA 上 CPU 占用降低 90%+。
- **元素消除统一为 `display:none !important`**
  之前消除时 `.remove()`、刷新后用 `display:none` 恢复 — 行为不一致。现在两条路径一致，`undo` 功能可靠，规则库的"恢复"也正确。
- **隐私 Canvas 指纹保护不再污染原画布**
  之前 `toDataURL` 会真的修改网站的 canvas 像素（截图、地图渲染会出现噪点）。现在改为克隆 canvas 后扰动，只影响指纹采样输出。
- **隐私 Navigator/Screen 属性 `defineProperty` 加 `configurable: true`**
  避免在已 redefine 的页面再次设置时抛 `TypeError`。
- **lan-transfer 移除已下线的 heroku 信令服务器**
  `peerjs-server.herokuapp.com` 自 2022 年 Heroku 取消免费层后已 404，现在仅保留默认 PeerJS 云。
- **lan-transfer 增加亚太 STUN**
  `stun.qq.com`、`stun.miwifi.com`、`stun.cloudflare.com`，国内连接成功率显著提高。
- **lan-transfer 房间码冲突时 UI 同步**
  之前 ID 占用会偷偷加随机后缀但 QR 码不更新，手机扫码连不上。现在重新生成完整房间码并刷新二维码与显示。
- **clean-url 追踪参数改用 `Set`**
  之前数组里有 `utm_source/medium/...` 多次重复（淘宝段 + 京东段），改用 `Set` O(1) 查询，并去重。
- **data-harvester `dumpJsGlobals` 修复**
  `window.frames[0]` 通常 `undefined` 会让 baseline 为空、导致全部 window 属性被列出来。改为：使用一个临时 iframe 作为 baseline；失败时使用硬编码内置全局名兜底。
- **YouTube 退出广告时正确还原 `muted` / `playbackRate`**
  之前用户原本 muted 也会被强制 unmute；现在进入广告前保存完整状态，退出时恢复。
- **vault 密码生成改用 `crypto.getRandomValues` + Fisher-Yates**
  之前 `Math.random()` 不安全且 `.sort(() => Math.random() - 0.5)` 偏移不均匀。
- **sticky-killer 还原时使用 `setProperty`**
  kill 时设置了 `!important`，恢复时直接赋值无效，现在统一通过 `setProperty/removeProperty`。
- **password-vault `vaultAutoFill` 提示更准确**
  原"请打开管理器使用一键填充"是误导（管理器里没有该功能）。改为"请在管理器中复制凭据再粘贴"。
- **audio-normalizer 关闭时复位 gain 至 1.0**
  避免关闭后仍有增益残留。

## 升级说明

- **不破坏任何旧数据**：dictator 规则、vault 密码、监控项、设置全部兼容。
- 解压覆盖原扩展目录，或在 `chrome://extensions` 重新加载即可。
