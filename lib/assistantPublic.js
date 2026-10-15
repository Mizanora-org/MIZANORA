import { unstable_cache } from 'next/cache';
import { loadAssistant } from './gemini';

// What the website may know about the assistant (no keys). Cached; refreshed when the admin saves (tag "assistant").
export const getPublicAssistant = unstable_cache(async () => {
  try {
    const { cfg, keys } = await loadAssistant(true);
    return { enabled: Boolean(cfg.enabled && keys.length), name: cfg.name, voiceMode: cfg.voiceMode, greeting: cfg.greeting, maxOff: cfg.maxOff };
  } catch { return { enabled: false, name: 'Noor', voiceMode: 'browser', greeting: '' }; }
}, ['mz-assistant-public-v1'], { revalidate: 3600, tags: ['assistant'] });
