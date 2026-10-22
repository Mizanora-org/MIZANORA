import SplashControl from './SplashControl';

// Branded opening screen. It is plain HTML + CSS, so it appears on the very first paint (before any JavaScript),
// stays at least a moment, and then fades away as soon as the shop is ready. Shown once per visit.
// Visitors without JavaScript never see it (noscript rule) and a safety timer hides it after 6 seconds in any case.
export default function SplashScreen() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: "try{if(sessionStorage.getItem('mz_splash'))document.documentElement.classList.add('mz-nosplash')}catch(e){}setTimeout(function(){var s=document.getElementById('mz-splash');if(s)s.setAttribute('data-hide','1')},6000)",
        }}
      />
      <noscript><style>{'#mz-splash{display:none!important}'}</style></noscript>
      <div id="mz-splash" role="status" aria-live="polite" aria-label="Loading Mizanora">
        <div className="mz-splash-geo" aria-hidden="true" />
        <div className="mz-splash-glow" aria-hidden="true" />
        <div className="mz-splash-box">
          <div className="mz-logo-wrap">
            <span className="ring" aria-hidden="true" /><span className="ring r2" aria-hidden="true" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="mz-logo" src="/icons/icon-192.png" width="96" height="96" alt="" />
          </div>
          <p className="mz-brand">MIZANORA</p>
          <p className="mz-tag">Shop smart. Shop halal.</p>
          <div className="mz-bar" aria-hidden="true"><i /></div>
        </div>
      </div>
      <SplashControl />
    </>
  );
}
