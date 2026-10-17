'use client';
import { useEffect, useState } from 'react';
import { Music4, VolumeX } from 'lucide-react';

// The header button for the shop's background music.
//
// It does not own the music: components/AppMusic.js does. This button only asks the player to
// switch (window event "mz-app-music-cmd") and listens to what the player reports back
// (window event "mz-app-music"), so the icon always tells the truth:
//   note with a soft pulse = the music is playing
//   plain note             = the music is on, but the browser is waiting for a tap
//   crossed note           = the shopper turned the music off
//
// If the admin has not set a link yet, the button is not shown at all.
export default function MusicToggle({ enabled = false, className = '' }) {
  const [state, setState] = useState({ on: false, playing: false, failed: false });

  useEffect(() => {
    const sync = (e) => { if (e.detail) setState((s) => ({ ...s, ...e.detail })); };
    window.addEventListener('mz-app-music', sync);
    // ask the player for its current state (it may already be running)
    window.dispatchEvent(new CustomEvent('mz-app-music-cmd', { detail: { cmd: 'state' } }));
    return () => window.removeEventListener('mz-app-music', sync);
  }, []);

  if (!enabled) return null;

  const { on, playing, failed } = state;
  const label = failed ? 'The background music could not be played'
    : !on ? 'Background music off'
      : playing ? 'Turn background music off' : 'Play background music';

  return (
    <button
      type="button"
      data-nosound
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={() => window.dispatchEvent(new CustomEvent('mz-app-music-cmd', { detail: { cmd: 'toggle' } }))}
      className={`relative rounded-full p-2.5 transition hover:bg-white/10 active:scale-90 ${className}`}
    >
      {on ? <Music4 size={22} className={playing ? 'text-saffron' : ''} /> : <VolumeX size={21} className="opacity-70" />}
      {/* a soft ring while the music is playing: it is the only "alive" hint in the header */}
      {playing && <span className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-saffron/20" style={{ animation: 'mz-pulse-ring 2.4s ease-out infinite' }} />}
      {/* the link did not work in this browser: a small red dot so the admin can spot it */}
      {failed && <span className="pointer-events-none absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />}
    </button>
  );
}
