/*!
 * MIZANORA ADS API - embed script (v31)
 * ------------------------------------------------------------------
 * Inject this in the <head> of ANY website or project:
 *
 *   <script async src="https://YOUR-SHOP.vercel.app/api/ads/embed.js?key=mza_xxx"></script>
 *
 * It looks for slots and fills them with ads:
 *   <div data-mz-ads></div>              -> best ad for the slot (auto)
 *   <div data-mz-ads="banner"></div>     -> banner / static creative
 *   <div data-mz-ads="video"></div>      -> video ad (muted autoplay + play button + skip countdown)
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
  var KEY = cfg.key || (u && u.searchParams.get('key')) || '';
  var api = { version: '1.0.0', disabled: false, refresh: function () { renderAll(true); } };
  window.MZADS_API = api;

  if (!KEY) { console.warn('[mzads] no key in the script URL'); return; }

  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- animation CSS (self-contained) --------------------------------------
  var CSS = [
    '.mza-slot{position:relative;border-radius:16px;overflow:hidden;min-height:90px}',
    '.mza-badge{position:absolute;top:8px;left:8px;z-index:3;font:600 9px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#fff;background:rgba(11,107,69,.85);padding:3px 7px;border-radius:8px}',
    '.mza-close{position:absolute;top:6px;right:6px;z-index:4;width:22px;height:22px;border:0;border-radius:50%;background:rgba(0,0,0,.45);color:#fff;font:700 12px/22px sans-serif;cursor:pointer;display:grid;place-items:center}',
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
    '.mza-video{position:relative;border-radius:16px;overflow:hidden;min-height:180px;background:#000;cursor:pointer}',
    '.mza-video video{display:block;width:100%;height:100%;object-fit:cover}',
    '.mza-vplay{position:absolute;inset:0;display:grid;place-items:center}',
    '.mza-vbtn{width:56px;height:56px;border-radius:50%;border:0;background:rgba(11,107,69,.92);color:#fff;display:grid;place-items:center;box-shadow:0 8px 24px -6px rgba(0,0,0,.6);cursor:pointer}',
    '.mza-vlabel{position:absolute;left:12px;bottom:10px;color:#fff;font:700 13px/1.3 -apple-system,Segoe UI,Roboto,sans-serif;text-shadow:0 1px 6px rgba(0,0,0,.7);max-width:70%}',
    '.mza-vskip{position:absolute;right:10px;bottom:10px;color:#fff;font:600 11px/1 -apple-system,Segoe UI,Roboto,sans-serif;background:rgba(0,0,0,.55);padding:6px 9px;border-radius:8px;cursor:pointer}',
    '.mza-vshade{position:absolute;inset:0;background:linear-gradient(180deg,transparent 40%,rgba(0,0,0,.65))}',
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

  function warn(msg) { console.warn('[mzads]', msg); }

  // ---- tracking ------------------------------------------------------------
  function track(kind, ad) {
    if (api.disabled || !ad) return;
    var body = JSON.stringify({ key: KEY, campaign: ad.id, token: ad.token, href: ad.href || '' });
    try {
      fetch(HOST + '/api/ads/' + kind, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, credentials: 'omit', keepalive: true }).catch(function () {});
    } catch (e) { /* offline or blocked: never break the host page */ }
  }

  // ---- creative builders ---------------------------------------------------
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function bindClick(node, ad) {
    node.setAttribute('data-mza-ad', ad.id);
    node.addEventListener('click', function (ev) {
      if (ev.target.closest && ev.target.closest('.mza-close')) return;
      ev.preventDefault();
      track('click', ad);
      var href = ad.href || (ad.product && ad.product.slug ? '/product/' + ad.product.slug : '');
      if (!href) return;
      try { window.open(href, '_blank', 'noopener'); } catch (e) { window.location.href = href; }
    });
  }

  function buildProduct(ad) {
    var p = ad.product || {};
    var card = el('div', 'mza-card mza-anim-pop');
    var href = ad.href || (p.slug ? '/product/' + p.slug : '#');
    card.setAttribute('role', 'link');
    card.setAttribute('tabindex', '0');
    var img = p.img ? el('div', 'mza-pimg') : null;
    if (img) { img.style.backgroundImage = "url('" + p.img + "')"; card.appendChild(img); }
    var body = el('div', 'mza-pbody');
    body.appendChild(el('div', 'mza-pname', esc(p.name || ad.headline || ad.name)));
    var row = el('div', 'mza-prow');
    if (p.price) row.appendChild(el('div', 'mza-pprice', 'Rs ' + p.price));
    if (p.comparePrice && p.comparePrice > p.price) row.appendChild(el('div', 'mza-pcmp', 'Rs ' + p.comparePrice));
    body.appendChild(row);
    body.appendChild(el('div', 'mza-pcta', esc(ad.cta || 'Buy now')));
    card.appendChild(body);
    bindClick(card, { id: ad.id, href: href, token: ad.token });
    return card;
  }

  function buildVideo(ad) {
    var v = ad.video || {};
    var wrap = el('div', 'mza-video');
    var video = document.createElement('video');
    video.muted = v.muted !== false;
    video.loop = v.loop !== false;
    video.playsInline = true;
    video.preload = 'metadata';
    if (v.poster) video.poster = v.poster;
    if (v.url) video.src = v.url;
    var shade = el('div', 'mza-vshade');
    var label = el('div', 'mza-vlabel', esc((ad.headline || ad.name) + (ad.sub ? ' — ' + ad.sub : '')));
    var play = el('div', 'mza-vplay');
    var btn = el('button', 'mza-vbtn', '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>');
    btn.setAttribute('aria-label', 'Play');
    play.appendChild(btn);
    wrap.appendChild(video); wrap.appendChild(shade); wrap.appendChild(label); wrap.appendChild(play);
    if (!REDUCED) {
      var pr = video.play();
      if (pr && pr.catch) pr.catch(function () {});
    }
    video.addEventListener('click', function () {
      track('click', { id: ad.id, href: ad.href, token: ad.token });
      var href = ad.href || '';
      if (href) { try { window.open(href, '_blank', 'noopener'); } catch (e) { window.location.href = href; } }
    });
    // skip countdown: shows how long until the ad can be skipped
    var skipAfter = Math.max(0, Math.min(30, Number(v.skipAfter) || 0));
    var skipBtn = null;
    if (skipAfter > 0 && !REDUCED) {
      skipBtn = el('button', 'mza-vskip', skipAfter + 's');
      wrap.appendChild(skipBtn);
      var left = skipAfter;
      var tick = setInterval(function () {
        left -= 1;
        if (left <= 0) {
          clearInterval(tick);
          skipBtn.textContent = 'Skip';
          skipBtn.addEventListener('click', function (ev) { ev.stopPropagation(); video.pause(); wrap.style.display = 'none'; });
        } else skipBtn.textContent = left + 's';
      }, 1000);
    }
    return wrap;
  }

  function buildBanner(ad, slot) {
    var a = (ad.type === 'animation' || slot === 'animation') ? ' mza-anim-' + (ad.anim || 'float') : '';
    var link = document.createElement('a');
    link.className = 'mza-creative mza-anim-pop' + a;
    if (ad.href) link.href = ad.href;
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener sponsored nofollow');
    if (ad.bg) link.style.background = ad.bg;
    if (ad.img) {
      var pic = el('div', 'mza-pic');
      pic.style.backgroundImage = "url('" + ad.img + "')";
      link.appendChild(pic);
      link.appendChild(el('div', 'mza-shade'));
    }
    var txt = el('div', 'mza-txt');
    txt.appendChild(el('div', 'mza-h', esc(ad.headline || ad.name)));
    if (ad.sub) txt.appendChild(el('div', 'mza-s', esc(ad.sub)));
    if (ad.product && ad.product.price) txt.appendChild(el('div', 'mza-price', 'Rs ' + ad.product.price));
    link.appendChild(txt);
    if (ad.cta) link.appendChild(el('div', 'mza-btn', esc(ad.cta)));
    bindClick(link, { id: ad.id, href: ad.href, token: ad.token });
    return link;
  }

  function buildHtml(ad) {
    var div = el('div', 'mza-slot mza-anim-pop');
    if (ad.html) div.innerHTML = ad.html;
    bindClick(div, { id: ad.id, href: ad.href, token: ad.token });
    return div;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function buildCreative(ad, slot) {
    if (ad.type === 'product' || slot === 'product') return buildProduct(ad);
    if (ad.type === 'video' || slot === 'video') return buildVideo(ad);
    if (ad.type === 'html' || slot === 'html') return buildHtml(ad);
    // banner / animation / auto
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
    var want = String(slot.getAttribute('data-mz-ads') || 'auto').slice(0, 20);
    if (want === 'off' || want === 'false') return;
    if (slot.dataset.mzaDone && !force) return;
    slot.dataset.mzaDone = '1';
    var type = want === 'auto' ? '' : want;

    fetch(HOST + '/api/ads/serve?key=' + encodeURIComponent(KEY) + '&slot=' + encodeURIComponent(type) + '&count=2', { credentials: 'omit' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok || !j.ads || !j.ads.length) { slot.dataset.mzaDone = ''; return; }
        renderCreatives(slot, j.ads, j.rotateMs || cfg.rotate || 8000);
      })
      .catch(function (e) { warn('serve failed: ' + e.message); slot.dataset.mzaDone = ''; });
  }

  function renderCreatives(slot, ads, rotateMs) {
    // wipe previous content, keep the slot element itself
    while (slot.firstChild) slot.removeChild(slot.firstChild);
    var shown = [];
    function show(i) {
      if (api.disabled || !ads[i]) return;
      while (slot.firstChild) slot.removeChild(slot.firstChild);
      var node = buildCreative(ads[i], slot.getAttribute('data-mz-ads'));
      var badge = el('span', 'mza-badge', 'Ad');
      var close = el('button', 'mza-close', '×');
      close.setAttribute('aria-label', 'Close ad');
      close.addEventListener('click', function (ev) { ev.stopPropagation(); slot.style.display = 'none'; });
      slot.appendChild(node);
      slot.appendChild(badge);
      slot.appendChild(close);
      if (shown.indexOf(i) < 0) { shown.push(i); track('impression', ads[i]); }
    }
    show(0);
    if (ads.length > 1) {
      setInterval(function () {
        var next = (shown.length ? shown[shown.length - 1] + 1 : 1) % ads.length;
        show(next);
      }, Math.max(2000, rotateMs));
    }
  }

  // ---- lazy loading + auto slots ------------------------------------------
  var IO = window.IntersectionObserver;
  var rendered = new WeakSet();

  function renderAll(force) {
    injectCss();
    var slots = currentSlots();
    if (!slots.length && cfg.auto) {
      // no slots: insert one top banner slot once
      var s = document.createElement('div');
      s.setAttribute('data-mz-ads', 'auto');
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
        }, { rootMargin: '200px' });
        obs.observe(slot);
      } else {
        renderSlot(slot, false);
      }
    });
  }

  // ---- boot ---------------------------------------------------------------
  function boot() {
    try {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { renderAll(false); });
      } else {
        renderAll(false);
      }
      // re-scan after SPA navigation / late content (shop pages use Next router)
      setTimeout(function () { renderAll(false); }, 2500);
      setTimeout(function () { renderAll(false); }, 8000);
      window.addEventListener('mzroute', function () { setTimeout(function () { rendered = new WeakSet(); renderAll(false); }, 600); });
    } catch (e) { warn(e.message); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
