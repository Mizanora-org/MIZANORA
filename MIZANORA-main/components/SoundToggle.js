'use client';
import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { setSound, soundOn } from '@/lib/sound';

export default function SoundToggle({ className = '' }) {
  const [on, setOn] = useState(true);
  useEffect(() => { const sync = () => setOn(soundOn()); sync(); window.addEventListener('mz-sound', sync); return () => window.removeEventListener('mz-sound', sync); }, []);
  return (
    <button type="button" data-nosound aria-pressed={on} aria-label={on ? 'Turn sounds off' : 'Turn sounds on'} onClick={() => setSound(!on)} className={`rounded-full p-2.5 hover:bg-white/10 ${className}`}>
      {on ? <Volume2 size={22} /> : <VolumeX size={22} />}
    </button>
  );
}
