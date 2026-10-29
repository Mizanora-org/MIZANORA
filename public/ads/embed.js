/*!
 * MIZANORA ADS API - embed script (v32)
 * ------------------------------------------------------------------
 * Inject this in the <head> of ANY website or project:
 *
 *   <script async src="https://YOUR-SHOP.vercel.app/api/ads/embed.js?key=mza_xxx"></script>
 *
 * It looks for slots and fills them with ads:
 *   <div data-mz-ads></div>              -> best ad for the slot (auto)
 *   <div data-mz-ads="banner"></div>     -> banner / static creative
 *   <div data-mz-ads="video"></div>      -> video ad (real player: mp4, webm, HLS, YouTube, Facebook, Instagram, Vimeo, TikTok, Drive)
 *   <div data-mz-ads="animation"></div>  -> CSS animation ad
 *   <div data-mz-ads="product"></div>    -> product card
 *   <div data-mz-ads="html"></div>       -> your HTML creative
 *   <div data-mz-ads="auto"></div>       -> any type, server picks
 *
 * Optional global config (before the script loads):
 *   window.MZADS = { key: 'mza_xxx', rotate: 8000, lazy: true, auto: false }
 *
 *   auto:false (default) = only fills [data-mz-ads] slots. auto:true = also
 *   inserts a top banner when the page has no slots.
 *
 * Controls:
 *   window.MZADS_API.refresh()  - re-render all slots now
 *   window.MZADS_API.disable()  - stop everything (e.g. in a consent dialog)
 *   window.MZADS_API.version
 * ------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.MZADS_LOADED) return;
  window.MZADS_LOADED = 1;

  var cfg = window.MZADS || {};
  var script = null;
  try { script = document.currentScript || null; } catch (e) { script = null; }
  if (!script) {
    var all = document.getElementsByTagName('script');
    for (var i = 0; i < all.length; i++) {
      if (/embed\.js/.test(all[i].src || '')) { script = all[i]; break; }
    }
  }
  var src = script && script.src ? script.src : '';
  var u = src ? new URL(src, window.location.href) : null;
  var HOST = u ? u.origin : window.location.origin;
  // The shop origin the AD LINKS must point to. Served from the shop itself
  // (/api/ads/embed.js) it is our own origin; loaded from a shop URL it is that URL.
  var SHOP = HOST;
  var KEY = cfg.key || (u && u.searchParams.get('key')) || '';
  var api = { version: '2.0.0', disabled: false, refresh: function () { renderAll(true); } };
  window.MZADS_API = api;

  if (!KEY) { console.warn('[mzads] no key in the script URL'); return; }

  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- animation + player CSS (self-contained) -----------------------------
  var CSS = [
    '.mza-slot{position:relative;border-radius:16px;overflow:hidden;min-height:90px}',
    '.mza-badge{position:absolute;top:8px;left:8px;z-index:6;font:600 9px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#fff;background:rgba(11,107,69,.85);padding:3px 7px;border-radius:8px}',
    '.mza-close{position:absolute;top:6px;right:6px;z-index:7;width:22px;height:22px;border:0;border-radius:50%;background:rgba(0,0,0,.45);color:#fff;font:700 12px/22px sans-serif;cursor:pointer;display:grid;place-items:center}',
    '.mza-close:hover{background:rgba(0,0,0,.7)}',
    '.mza-creative{position:relative;display:flex;align-items:center;gap:14px;padding:14px 16px;min-height:90px;box-sizing:border-box;color:#fff;cursor:pointer;text-decoration:none;background:linear-gradient(135deg,#0B6B45,#0E8556);transition:transform .25s ease,box-shadow .25s ease}',
    '.mza-creative:hover{transform:translateY(-2px);box-shadow:0 14px 30px -14px rgba(11,107,69,.8)}',
    '.mza-creative .mza-txt{min-width:0;flex:1}',
    '.mza-creative .mza-h{font:700 14px/1.35 -apple-system,Segoe UI,Roboto,sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.mza-creative .mza-s{font:500 12px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;opacity:.88;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
    '.mza-creative .mza-btn{flex:none;font:700 12px/1 -apple-system,Segoe UI,Roboto,sans-serif;color:#073D28;background:#F2C766;border-radius:999px;padding:9px 14px;white-space:nowrap;box-shadow:0 4px 12px -4px rgba(0,0,0,.4)}',
    '.mza-creative .mza-price{font:800 13px/1 -apple-system,Segoe UI,Roboto,sans-serif;color:#F2C766;margin-top:3px}',
    '.mza-pic{position:absolute;inset:0;background-size:cover;background-position:center}',
    '.mza-shade{position:absolute;inset:0;background:linear-gradient(120deg,rgba(4,30,20,.88),rgba(4,30,20,.45) 55%,rgba(4,30,20,.2))}',
    '.mza-creative,.mza-creative *{position:relative}',
    '.mza-video{position:relative;border-radius:16px;overflow:hidden;background:#000;aspect-ratio:16/9;max-height:440px;width:100%}',
    '.mza-video.mza-vv{aspect-ratio:9/16;max-width:330px;margin:0 auto}',
    '.mza-video video,.mza-video iframe{position:absolute;inset:0;display:block;width:100%;height:100%;border:0;object-fit:cover;background:#000}',
    '.mza-video video{cursor:pointer}',
    '.mza-vplay{position:absolute;inset:0;z-index:3;display:grid;place-items:center;pointer-events:none}',
    '.mza-vplay.mza-hide{display:none}',
    '.mza-vbtn{pointer-events:auto;width:58px;height:58px;border-radius:50%;border:0;background:rgba(11,107,69,.92);color:#fff;display:grid;place-items:center;box-shadow:0 8px 24px -6px rgba(0,0,0,.6);cursor:pointer}',
    '.mza-vposter{position:absolute;inset:0;background-size:cover;background-position:center}',
    '.mza-vbar{position:absolute;left:0;right:0;bottom:0;z-index:4;display:flex;align-items:center;gap:8px;padding:10px 12px;background:linear-gradient(180deg,transparent,rgba(0,0,0,.78));pointer-events:none}',
    '.mza-vlabel{color:#fff;font:700 13px/1.3 -apple-system,Segoe UI,Roboto,sans-serif;text-shadow:0 1px 6px rgba(0,0,0,.7);min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.mza-vcta{pointer-events:auto;flex:none;font:700 11px/1 -apple-system,Segoe UI,Roboto,sans-serif;color:#073D28;background:#F2C766;border:0;border-radius:999px;padding:8px 12px;cursor:pointer;box-shadow:0 4px 12px -4px rgba(0,0,0,.45)}',
    '.mza-vskip{pointer-events:auto;flex:none;color:#fff;font:600 11px/1 -apple-system,Segoe UI,Roboto,sans-serif;background:rgba(0,0,0,.55);border:0;padding:7px 10px;border-radius:8px;cursor:pointer}',
    '.mza-vmute{position:absolute;right:8px;top:8px;z-index:5;width:30px;height:30px;border:0;border-radius:50%;background:rgba(0,0,0,.5);color:#fff;font:700 13px/30px sans-serif;cursor:pointer;display:grid;place-items:center}',
    '.mza-vhint{position:absolute;inset:0;z-index:5;display:grid;place-items:center;padding:16px;text-align:center;color:#fff;font:600 12px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;background:rgba(0,0,0,.55);text-decoration:none}',
    '.mza-card{position:relative;border-radius:16px;overflow:hidden;min-height:150px;display:flex;flex-direction:column;background:#0B6B45;color:#fff;cursor:pointer}',
    '.mza-card .mza-pimg{height:120px;background-size:cover;background-position:center}',
    '.mza-card .mza-pbody{padding:10px 12px;display:flex;flex-direction:column;gap:3px}',
    '.mza-card .mza-pname{font:700 13px/1.3 -apple-system,Segoe UI,Roboto,sans-serif;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
    '.mza-card .mza-prow{display:flex;align-items:baseline;gap:8px}',
    '.mza-card .mza-pprice{font:800 15px/1 -apple-system,Segoe UI,Roboto,sans-serif;color:#F2C766}',
    '.mza-card .mza-pcmp{font:500 11px/1 -apple-system,Segoe UI,Roboto,sans-serif;opacity:.65;text-decoration:line-through}',
    '.mza-card .mza-pcta{margin-top:2px;align-self:flex-start;font:700 11px/1 -apple-system,Segoe UI,Roboto,sans-serif;background:#F2C766;color:#073D28;border-radius:999px;padding:7px 12px}',
    '/* animations */',
    '.mza-anim-float{animation:mza-float 4.5s ease-in-out infinite}',
    '@keyframes mza-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}',
    '.mza-anim-shine{overflow:hidden}',
    '.mza-anim-shine::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.45) 50%,transparent 65%);transform:translateX(-130%);animation:mza-shine 3.2s ease-in-out infinite}',
    '@keyframes mza-shine{0%,60%{transform:translateX(-130%)}100%{transform:translateX(130%)}}',
    '.mza-anim-pulse{animation:mza-pulse 2.6s ease-in-out infinite}',
    '@keyframes mza-pulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(242,199,102,.5)}50%{transform:scale(1.025);box-shadow:0 0 0 14px rgba(242,199,102,0)}}',
    '.mza-anim-wave::before{content:"";position:absolute;inset:0;background:radial-gradient(120% 80% at 10% 120%,rgba(255,255,255,.25),transparent 60%);animation:mza-wave 5s ease-in-out infinite}',
    '@keyframes mza-wave{0%,100%{background-position-x:0}50%{background-position-x:140%}}',
    '.mza-anim-marquee .mza-h{display:inline-block;white-space:nowrap;animation:mza-mq 6s linear infinite;padding-left:100%}',
    '@keyframes mza-mq{0%{transform:translateX(0)}100%{transform:translateX(-100%)}}',
    '.mza-anim-spin::after{content:"";position:absolute;right:14px;top:50%;width:26px;height:26px;margin-top:-13px;border-radius:50%;border:3px solid rgba(255,255,255,.35);border-top-color:#F2C766;animation:mza-spin 2.4s linear infinite}',
    '@keyframes mza-spin{to{transform:rotate(360deg)}}',
    '.mza-anim-pop{animation:mza-pop .7s cubic-bezier(.2,1.4,.4,1) both}',
    '@keyframes mza-pop{0%{transform:scale(.7);opacity:0}70%{transform:scale(1.06)}100%{transform:scale(1);opacity:1}}',
    '.mza-anim-gradient{background-size:220% 220%;animation:mza-grad 8s ease infinite}',
    '@keyframes mza-grad{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}',
    '@media (prefers-reduced-motion:reduce){.mza-anim-float,.mza-anim-pulse,.mza-anim-pop,.mza-anim-gradient,.mza-anim-shine::after,.mza-anim-wave::before,.mza-anim-marquee .mza-h,.mza-anim-spin::after{animation:none!important;transform:none!important}}',
    '@media (max-width:560px){.mza-creative{flex-direction:column;align-items:flex-start;gap:8px}.mza-creative .mza-btn{align-self:flex-start}}',
  ].join('\n');

  function injectCss() {
    if (document.getElementById('mza-embed-css')) return;
    var st = document.createElement('style');
    st.id = 'mza-embed-css';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function warn(msg) { try { console.warn('[mzads]', msg); } catch (e) { /* ignore */ } }

  // ---- links ---------------------------------------------------------------
  // "/deals" on someone else's website must still open MIZANORA.
  function abs(href) {
    var s = String(href || '').trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;
    if (/^data:/i.test(s)) return s;
    return SHOP + (s.charAt(0) === '/' ? '' : '/') + s;
  }

  // A photo that fails to load in the visitor's browser is retried through the
  // shop's own image relay (/api/img). That fixes hosts that block hotlinking,
  // so an ad or a product card never shows an empty frame.
  function imgFill(parent, url) {
    var clean = String(url || '').trim().replace(/["'\\\n\r]/g, '');
    if (!clean) return null;
    var img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.style.cssText = 'position:absolute!important;inset:0;width:100%;height:100%;object-fit:cover;border:0';
    img.onerror = function () {
      if (!img.dataset.retried) {
        img.dataset.retried = '1';
        var full = abs(clean);
        if (/^https?:/i.test(full)) { img.src = SHOP + '/api/img?u=' + encodeURIComponent(full); return; }
      }
      img.style.display = 'none';
    };
    img.src = abs(clean);
    parent.style.position = parent.style.position || 'relative';
    parent.appendChild(img);
    return img;
  }

  // ---- tracking ------------------------------------------------------------
  // Impressions use the short-lived token, clicks the long-lived one.
  function track(kind, ad) {
    if (api.disabled || !ad || !ad.id) return;
    var token = kind === 'click' ? (ad.ctoken || ad.token) : (ad.token || ad.ctoken);
    var body = JSON.stringify({ key: KEY, campaign: ad.id, token: token, href: ad.href || '' });
    try {
      fetch(HOST + '/api/ads/' + kind, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, credentials: 'omit', keepalive: true }).catch(function () {});
    } catch (e) { /* offline or blocked: never break the host page */ }
  }

  var lastTracked = {};
  function trackOnce(kind, ad, gapMs) {
    if (!ad || !ad.id) return;
    var k = kind + ':' + ad.id;
    var now = Date.now();
    if (lastTracked[k] && now - lastTracked[k] < (gapMs || 30000)) return;
    lastTracked[k] = now;
    track(kind, ad);
  }

  function openAd(ad) {
    var href = abs(ad.href || (ad.product && ad.product.href) || (ad.product && ad.product.slug ? '/product/' + ad.product.slug : ''));
    if (!href) return;
    trackOnce('click', ad, 1500);
    try { window.open(href, '_blank', 'noopener'); } catch (e) { window.location.href = href; }
  }

  // ---- video links ---------------------------------------------------------
  // -> { kind: 'iframe' | 'hls' | 'file' | '', src, thumb, vertical, label }
  function videoInfo(url) {
    var raw = String(url || '').trim();
    if (!/^https?:\/\//i.test(raw)) return { kind: '', src: raw, thumb: '', vertical: false, label: '' };
    var m;
    if ((m = raw.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/i))) {
      var vertical = /\/shorts\//i.test(raw);
      return { kind: 'iframe', provider: 'youtube', src: 'https://www.youtube-nocookie.com/embed/' + m[1] + '?autoplay=1&mute=1&rel=0&playsinline=1&modestbranding=1', thumb: 'https://i.ytimg.com/vi/' + m[1] + '/hqdefault.jpg', vertical: vertical, label: 'YouTube' };
    }
    if (/^https?:\/\/(?:[\w-]+\.)?(?:facebook\.com|fb\.watch|fb\.com)\//i.test(raw)) {
      return { kind: 'iframe', provider: 'facebook', src: 'https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent(raw) + '&show_text=false&autoplay=true&muted=1', thumb: '', vertical: /\/reel\//i.test(raw), label: 'Facebook' };
    }
    if ((m = raw.match(/instagram\.com\/(reel|reels|p|tv)\/([\w-]+)/i))) {
      var kind = m[1] === 'reels' ? 'reel' : m[1];
      return { kind: 'iframe', provider: 'instagram', src: 'https://www.instagram.com/' + kind + '/' + m[2] + '/embed', thumb: '', vertical: true, label: 'Instagram' };
    }
    if ((m = raw.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/i))) {
      return { kind: 'iframe', provider: 'tiktok', src: 'https://www.tiktok.com/embed/v2/' + m[1], thumb: '', vertical: true, label: 'TikTok' };
    }
    if ((m = raw.match(/vimeo\.com\/(?:video\/|channels\/[\w-]+\/|groups\/[\w-]+\/videos\/)?(\d{6,})/i))) {
      return { kind: 'iframe', provider: 'vimeo', src: 'https://player.vimeo.com/video/' + m[1] + '?autoplay=1&muted=1&playsinline=1', thumb: '', vertical: false, label: 'Vimeo' };
    }
    if ((m = raw.match(/(?:dailymotion\.com\/(?:video|embed\/video)\/|dai\.ly\/)([a-z0-9]+)/i))) {
      return { kind: 'iframe', provider: 'dailymotion', src: 'https://www.dailymotion.com/embed/video/' + m[1] + '?autoplay=1&mute=1', thumb: '', vertical: false, label: 'Dailymotion' };
    }
    if ((m = raw.match(/streamable\.com\/(?:e\/)?([a-z0-9]+)/i))) {
      return { kind: 'iframe', provider: 'streamable', src: 'https://streamable.com/e/' + m[1] + '?autoplay=1&mute=1', thumb: '', vertical: false, label: 'Streamable' };
    }
    if ((m = raw.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([\w-]{20,})/i))) {
      return { kind: 'iframe', provider: 'drive', src: 'https://drive.google.com/file/d/' + m[1] + '/preview', thumb: '', vertical: false, label: 'Google Drive' };
    }
    if (/\.m3u8(\?|#|$)/i.test(raw)) return { kind: 'hls', provider: 'hls', src: raw, thumb: '', vertical: false, label: 'Live video' };
    return { kind: 'file', provider: 'file', src: raw, thumb: '', vertical: false, label: 'Video' };
  }

  // hls.js is served by the shop itself (no third-party CDN needed); a CDN is
  // only used when that file is missing.
  var hlsPromise = null;
  function loadHls() {
    if (window.Hls) return Promise.resolve(window.Hls);
    if (hlsPromise) return hlsPromise;
    var sources = [SHOP + '/api/ads/hls.js', 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js'];
    hlsPromise = new Promise(function (resolve) {
      var i = 0;
      function next() {
        if (i >= sources.length) return resolve(null);
        var s = document.createElement('script');
        s.src = sources[i++];
        s.async = true;
        s.onload = function () { resolve(window.Hls || null); };
        s.onerror = function () { next(); };
        (document.head || document.documentElement).appendChild(s);
      }
      next();
    });
    return hlsPromise;
  }

  // ---- creative builders ---------------------------------------------------
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function bindClick(node, ad) {
    node.setAttribute('data-mza-ad', ad.id);
    node.style.cursor = 'pointer';
    node.addEventListener('click', function (ev) {
      if (ev.target.closest && ev.target.closest('.mza-close,.mza-vcta,.mza-vskip,.mza-vmute')) return;
      if (ev.target.closest && ev.target.closest('button,a')) return;
      ev.preventDefault();
      openAd(ad);
    });
  }

  function buildProduct(ad) {
    var p = ad.product || {};
    var card = el('div', 'mza-card mza-anim-pop');
    card.setAttribute('role', 'link');
    card.setAttribute('tabindex', '0');
    if (p.img) { var img = el('div', 'mza-pimg'); imgFill(img, p.img); card.appendChild(img); }
    var body = el('div', 'mza-pbody');
    body.appendChild(el('div', 'mza-pname', esc(p.name || ad.headline || ad.name)));
    var row = el('div', 'mza-prow');
    if (p.price) row.appendChild(el('div', 'mza-pprice', 'Rs ' + p.price));
    if (p.comparePrice && p.comparePrice > p.price) row.appendChild(el('div', 'mza-pcmp', 'Rs ' + p.comparePrice));
    body.appendChild(row);
    body.appendChild(el('div', 'mza-pcta', esc(ad.cta || 'Buy now')));
    card.appendChild(body);
    bindClick(card, ad);
    return card;
  }

  function buildBanner(ad, slot) {
    var anim = (ad.type === 'animation' || slot === 'animation') ? ' mza-anim-' + (ad.anim || 'float') : '';
    var link = document.createElement('a');
    link.className = 'mza-creative mza-anim-pop' + anim;
    link.href = abs(ad.href) || '#';
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener sponsored nofollow');
    if (ad.bg) link.style.background = ad.bg;
    if (ad.img) {
      var pic = el('div', 'mza-pic');
      imgFill(pic, ad.img);
      link.appendChild(pic);
      link.appendChild(el('div', 'mza-shade'));
    }
    var txt = el('div', 'mza-txt');
    txt.appendChild(el('div', 'mza-h', esc(ad.headline || ad.name)));
    if (ad.sub) txt.appendChild(el('div', 'mza-s', esc(ad.sub)));
    if (ad.product && ad.product.price) txt.appendChild(el('div', 'mza-price', 'Rs ' + ad.product.price));
    link.appendChild(txt);
    if (ad.cta) link.appendChild(el('div', 'mza-btn', esc(ad.cta)));
    bindClick(link, ad);
    return link;
  }

  // A REAL video player. Never a black box:
  //   mp4/webm -> <video muted autoplay loop playsinline> + poster + working play button
  //   .m3u8    -> hls.js (served by the shop) or native Safari playback
  //   YouTube / Facebook / Instagram / TikTok / Vimeo / Drive -> an iframe player
  //   nothing playable -> the banner creative (image + headline + button)
  function buildVideo(ad) {
    var v = ad.video || {};
    var info = v.kind ? { kind: v.kind, provider: v.provider || '', src: v.src || v.url, thumb: v.thumb || '', vertical: !!v.vertical, label: v.label || 'Video' } : videoInfo(v.url);
    if (!info.kind && !v.poster && !ad.img) return buildBanner(ad, 'banner');

    var wrap = el('div', 'mza-video' + (info.vertical ? ' mza-vv' : ''));
    wrap.setAttribute('data-mz-live', '0');
    var holdUntil = 0;

    function bar() {
      var b = el('div', 'mza-vbar');
      b.appendChild(el('div', 'mza-vlabel', esc(ad.headline || ad.name || '')));
      var href = abs(ad.href);
      if (href) {
        var cta = el('button', 'mza-vcta', esc(ad.cta || 'Visit'));
        cta.type = 'button';
        cta.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); openAd(ad); });
        b.appendChild(cta);
      }
      return b;
    }

    if (info.kind === 'iframe') {
      var frame = document.createElement('iframe');
      frame.src = info.src;
      frame.title = (ad.headline || ad.name || 'Advertisement') + ' video';
      frame.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write');
      frame.setAttribute('allowfullscreen', '');
      frame.setAttribute('frameborder', '0');
      frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      frame.setAttribute('loading', 'lazy');
      wrap.appendChild(frame);
      wrap.appendChild(bar());
      // An embed plays on its own; give it a fair share of time before rotating.
      holdUntil = Date.now() + Math.max(20000, Number(v.holdMs) || 0);
      wrap.__mzaBusy = function () { return Date.now() < holdUntil; };
      return wrap;
    }

    // file / hls
    var video = document.createElement('video');
    var muted = v.muted !== false;
    video.muted = muted;
    video.defaultMuted = muted;
    video.loop = v.loop !== false;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.preload = 'metadata';
    video.setAttribute('x5-playsinline', '');
    var poster = abs(v.poster || info.thumb || '');
    if (poster) video.poster = poster;
    wrap.appendChild(video);

    var overlay = el('div', 'mza-vplay');
    var big = el('button', 'mza-vbtn', '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>');
    big.type = 'button';
    big.setAttribute('aria-label', 'Play ad video');
    overlay.appendChild(big);
    wrap.appendChild(overlay);

    var mutedBtn = el('button', 'mza-vmute', muted ? '\u{1F507}' : '\u{1F50A}');
    mutedBtn.type = 'button';
    mutedBtn.setAttribute('aria-label', muted ? 'Turn sound on' : 'Mute');
    mutedBtn.addEventListener('click', function (ev) {
      ev.stopPropagation(); ev.preventDefault();
      var next = !video.muted;
      video.muted = next;
      try { video.volume = next ? 0 : 1; } catch (e) { /* ignore */ }
      mutedBtn.textContent = next ? '\u{1F507}' : '\u{1F50A}';
      mutedBtn.setAttribute('aria-label', next ? 'Turn sound on' : 'Mute');
      if (!next) { var pr = video.play(); if (pr && pr.catch) pr.catch(function () {}); }
    });
    wrap.appendChild(mutedBtn);

    wrap.appendChild(bar());

    function showOverlay(on) {
      if (on) overlay.classList.remove('mza-hide'); else overlay.classList.add('mza-hide');
    }
    function playNow() {
      showOverlay(false);
      var p;
      try { p = video.play(); } catch (e) { p = null; }
      if (p && p.then) p.then(function () { wrap.setAttribute('data-mz-live', '1'); }).catch(function () { showOverlay(true); wrap.setAttribute('data-mz-live', '0'); });
      return p;
    }
    video.addEventListener('play', function () { wrap.setAttribute('data-mz-live', '1'); showOverlay(false); });
    video.addEventListener('pause', function () { wrap.setAttribute('data-mz-live', '0'); showOverlay(true); });
    video.addEventListener('ended', function () { wrap.setAttribute('data-mz-live', '0'); showOverlay(true); });
    video.addEventListener('error', function () {
      // Broken file link: say it in one line instead of showing a black box.
      var hint = wrap.querySelector('.mza-vhint');
      if (hint) return;
      var h = document.createElement(ad.href ? 'a' : 'div');
      h.className = 'mza-vhint';
      h.textContent = 'This video could not play here. ' + (ad.href ? 'Tap to open the ad.' : '');
      if (ad.href) { h.href = abs(ad.href); h.target = '_blank'; h.rel = 'noopener sponsored nofollow'; h.addEventListener('click', function () { trackOnce('click', ad, 1500); }); }
      wrap.appendChild(h);
      wrap.setAttribute('data-mz-live', '0');
    });
    overlay.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); playNow(); });
    video.addEventListener('click', function () {
      if (video.paused) playNow(); else { try { video.pause(); } catch (e) { /* ignore */ } }
    });

    // Search-friendly: a video ad never autoplays with sound.
    if (info.kind === 'hls') {
      var canNative = video.canPlayType('application/vnd.apple.mpegurl');
      if (canNative) video.src = info.src;
      else loadHls().then(function (Hls) {
        if (!Hls || !Hls.isSupported()) {
          var hint = document.createElement('a');
          hint.className = 'mza-vhint';
          hint.href = abs(ad.href) || info.src;
          hint.textContent = 'Tap to watch this video';
          hint.target = '_blank'; hint.rel = 'noopener';
          wrap.appendChild(hint);
          return;
        }
        var h = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 20, manifestLoadingMaxRetry: 2, fragLoadingMaxRetry: 3 });
        h.loadSource(info.src);
        h.attachMedia(video);
        h.on(Hls.Events.ERROR, function (_e, data) { if (data && data.fatal) { try { h.destroy(); } catch (er) { /* ignore */ } video.dispatchEvent(new Event('error')); } });
        autoStart();
      });
    } else if (info.src) {
      video.src = info.src;
      autoStart();
    } else {
      showOverlay(true);
    }

    // Autoplay only AFTER the player is in the page: browsers are stricter with a
    // detached <video>, and this is what makes muted autoplay work on phones.
    function autoStart() {
      if (REDUCED) { showOverlay(true); return; }
      setTimeout(function () {
        if (wrap.isConnected === false) return;
        playNow();
      }, 40);
    }

    // Skip countdown: after N seconds the visitor can move on.
    var skipAfter = Math.max(0, Math.min(30, Number(v.skipAfter) || 0));
    if (skipAfter > 0) {
      var skipBtn = el('button', 'mza-vskip', skipAfter + 's');
      skipBtn.type = 'button';
      skipBtn.setAttribute('aria-label', 'Skip ad');
      wrap.querySelector('.mza-vbar').appendChild(skipBtn);
      var left = skipAfter;
      var tick = setInterval(function () {
        left -= 1;
        if (left > 0) { skipBtn.textContent = left + 's'; return; }
        clearInterval(tick);
        skipBtn.textContent = 'Skip';
        skipBtn.addEventListener('click', function (ev) {
          ev.preventDefault(); ev.stopPropagation();
          try { video.pause(); } catch (e) { /* ignore */ }
          var parent = wrap.parentNode;
          wrap.style.display = 'none';
          try { wrap.dispatchEvent(new CustomEvent('mzads-skip', { bubbles: true })); } catch (e) { /* older browsers */ }
          if (parent) parent.setAttribute('data-mza-skipped', '1');
        });
      }, 1000);
    }

    wrap.__mzaBusy = function () { return !video.paused && !video.ended; };
    return wrap;
  }

  function buildHtml(ad) {
    var div = el('div', 'mza-slot mza-anim-pop');
    if (ad.html) div.innerHTML = ad.html;
    bindClick(div, ad);
    return div;
  }

  function buildCreative(ad, slot) {
    if (!ad) return null;
    if (ad.type === 'product') return buildProduct(ad);
    if (ad.type === 'video') return buildVideo(ad);
    if (ad.type === 'html') return buildHtml(ad);
    return buildBanner(ad, ad.type === 'animation' ? 'animation' : slot);
  }

  // ---- slot rendering ------------------------------------------------------
  function currentSlots() {
    var out = [];
    var nodes = document.querySelectorAll('[data-mz-ads]');
    for (var i = 0; i < nodes.length; i++) out.push(nodes[i]);
    return out;
  }

  function renderSlot(slot, force) {
    if (api.disabled) return;
    if (slot.getAttribute('data-mza-skipped') === '1') return;
    var want = String(slot.getAttribute('data-mz-ads') || 'auto').slice(0, 20);
    if (want === 'off' || want === 'false') return;
    if (slot.dataset.mzaDone === '1' && !force) return;
    slot.dataset.mzaDone = '1';
    var type = want === 'auto' ? '' : want;

    fetch(HOST + '/api/ads/serve?key=' + encodeURIComponent(KEY) + '&slot=' + encodeURIComponent(type) + '&count=3', { credentials: 'omit' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        // The server tells us the shop origin: every ad link must point THERE, even
        // if this script was inlined or proxied instead of loaded from the shop.
        if (j && j.base) SHOP = String(j.base).replace(/\/+$/, '');
        if (!j || !j.ok || !j.ads || !j.ads.length) { slot.dataset.mzaDone = ''; return; }
        renderCreatives(slot, j.ads, j.rotateMs || cfg.rotate || 8000);
      })
      .catch(function (e) { warn('serve failed: ' + e.message); slot.dataset.mzaDone = ''; });
  }

  function renderCreatives(slot, ads, rotateMs) {
    while (slot.firstChild) slot.removeChild(slot.firstChild);
    var i = 0;
    var timer = null;
    var visible = true;

    function show(index) {
      if (api.disabled || !ads[index]) return;
      while (slot.firstChild) slot.removeChild(slot.firstChild);
      var node = buildCreative(ads[index], slot.getAttribute('data-mz-ads'));
      if (!node) return;
      slot.__mzaCurrent = node;
      var badge = el('span', 'mza-badge', 'Ad');
      var close = el('button', 'mza-close', '\u00D7');
      close.type = 'button';
      close.setAttribute('aria-label', 'Close ad');
      close.addEventListener('click', function (ev) { ev.stopPropagation(); ev.preventDefault(); stop(); slot.style.display = 'none'; });
      slot.appendChild(node);
      slot.appendChild(badge);
      slot.appendChild(close);
      trackOnce('impression', ads[index], 60000);
    }

    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    function tick() {
      if (api.disabled || ads.length < 2 || document.hidden || !visible) return;
      var node = slot.__mzaCurrent;
      if (slot.getAttribute('data-mza-skipped') === '1') { stop(); return; }
      // Never cut a video that is playing (or a YouTube embed that is still starting).
      if (node && typeof node.__mzaBusy === 'function' && node.__mzaBusy()) return;
      i = (i + 1) % ads.length;
      show(i);
    }

    show(0);
    if (ads.length > 1) {
      timer = setInterval(tick, Math.max(2500, rotateMs));
      if (window.IntersectionObserver) {
        try {
          new IntersectionObserver(function (entries) {
            entries.forEach(function (en) { visible = en.isIntersecting; });
          }, { threshold: 0 }).observe(slot);
        } catch (e) { /* ignore */ }
      }
    }
  }

  // ---- lazy loading + auto slots ------------------------------------------
  var IO = window.IntersectionObserver;
  var rendered = new WeakSet();

  function renderAll(force) {
    injectCss();
    if (api.disabled) return;
    var slots = currentSlots();
    if (!slots.length && cfg.auto && !document.querySelector('[data-mz-auto-slot]')) {
      // no slots: insert one top banner slot once
      var s = document.createElement('div');
      s.setAttribute('data-mz-ads', 'auto');
      s.setAttribute('data-mz-auto-slot', '1');
      s.style.cssText = 'margin:12px auto;max-width:720px;padding:0 12px';
      var body = document.body;
      if (body) body.insertBefore(s, body.firstChild);
      slots = [s];
    }
    slots.forEach(function (slot) {
      if (rendered.has(slot) && !force) return;
      rendered.add(slot);
      if (IO && !force) {
        var obs = new IO(function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) { renderSlot(slot, false); obs.unobserve(slot); }
          });
        }, { rootMargin: '250px' });
        obs.observe(slot);
      } else {
        renderSlot(slot, false);
      }
    });
  }

  api.disable = function () { api.disabled = true; };

  // ---- boot ---------------------------------------------------------------
  function boot() {
    try {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { renderAll(false); });
      } else {
        renderAll(false);
      }
      // re-scan after SPA navigation / late content (shop pages use Next router)
      setTimeout(function () { renderAll(false); }, 2000);
      setTimeout(function () { renderAll(false); }, 6000);
      window.addEventListener('mzroute', function () {
        rendered = new WeakSet();
        setTimeout(function () { renderAll(false); }, 400);
      });
      // Any framework that adds slots later (React, Vue, infinite scroll...).
      if (window.MutationObserver && document.body) {
        var pending = null;
        new MutationObserver(function () {
          if (pending) return;
          pending = setTimeout(function () { pending = null; renderAll(false); }, 700);
        }).observe(document.body, { childList: true, subtree: true });
      }
    } catch (e) { warn(e.message); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
