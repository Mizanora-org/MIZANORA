'use client';
import { Sparkles } from 'lucide-react';

// Opens the assistant (components/AssistantFab.js listens for this).
export default function AskAssistant({ q = '', name = 'Noor', className = '', children }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('mz-assistant', { detail: { q } }))} className={className}>
      <Sparkles size={16} />{children || `Ask ${name}`}
    </button>
  );
}
