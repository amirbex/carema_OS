import { useState } from 'react';
import { Database, RotateCcw, Sparkles } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { resetDemoData } from '../lib/demoStore';

/**
 * Shown only in demo/preview mode (`VITE_DEMO_MODE=true`), i.e. the static
 * GitHub Pages build. Makes it obvious that no server, API key or Firebase
 * project is involved and that data lives in this browser tab.
 */
export default function DemoBanner() {
  const { t } = useI18n();
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = () => {
    if (!window.confirm(t('demoResetConfirm'))) return;
    setIsResetting(true);
    try {
      resetDemoData();
    } finally {
      setTimeout(() => setIsResetting(false), 400);
    }
  };

  return (
    <div
      role="status"
      className="shrink-0 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-200/90"
    >
      <span className="flex items-center gap-1.5 font-medium">
        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
        {t('demoBannerTitle')}
      </span>
      <span className="hidden sm:flex items-center gap-1.5 text-amber-200/70">
        <Database className="w-3.5 h-3.5" aria-hidden="true" />
        {t('demoBannerBody')}
      </span>
      <button
        type="button"
        onClick={handleReset}
        disabled={isResetting}
        className="flex items-center gap-1 rounded border border-amber-400/30 px-2 py-0.5 font-medium text-amber-100/90 transition-colors hover:bg-amber-400/10 disabled:opacity-50"
      >
        <RotateCcw className="w-3 h-3" aria-hidden="true" />
        {t('demoReset')}
      </button>
    </div>
  );
}
