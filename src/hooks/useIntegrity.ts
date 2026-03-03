'use client';

import { useEffect, useRef, useCallback } from 'react';

interface UseIntegrityOptions {
  attemptId: string | null;
  enabled: boolean;
}

async function logEvent(attemptId: string, eventType: string, detail?: Record<string, unknown>) {
  try {
    await fetch('/api/student/logIntegrity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attemptId, eventType, detail }),
    });
  } catch {
    // Best-effort logging
  }
}

export function useIntegrity({ attemptId, enabled }: UseIntegrityOptions) {
  const tabSwitchCountRef = useRef(0);

  const logIntegrity = useCallback(
    (eventType: string, detail?: Record<string, unknown>) => {
      if (attemptId && enabled) {
        logEvent(attemptId, eventType, detail);
      }
    },
    [attemptId, enabled]
  );

  useEffect(() => {
    if (!enabled || !attemptId) return;

    // Tab visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabSwitchCountRef.current++;
        logEvent(attemptId, 'tab_switch', {
          count: tabSwitchCountRef.current,
        });
      }
    };

    // Window blur/focus
    const handleBlur = () => {
      logEvent(attemptId, 'window_blur');
    };

    const handleFocus = () => {
      logEvent(attemptId, 'window_focus');
    };

    // Beforeunload
    const handleBeforeUnload = () => {
      logEvent(attemptId, 'page_unload');
    };

    const handleClipboard = (event: ClipboardEvent) => {
      logEvent(attemptId, `clipboard_${event.type}`);
    };

    const handleContextMenu = () => {
      logEvent(attemptId, 'context_menu_opened');
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const ctrlOrMeta = event.ctrlKey || event.metaKey;

      if (ctrlOrMeta && event.shiftKey && (key === 'i' || key === 'j' || key === 'c')) {
        logEvent(attemptId, 'suspicious_shortcut', { combo: `${ctrlOrMeta ? 'ctrl/meta+' : ''}shift+${key}` });
      }

      if (ctrlOrMeta && (key === 'u' || key === 'p' || key === 's')) {
        logEvent(attemptId, 'suspicious_shortcut', { combo: `${ctrlOrMeta ? 'ctrl/meta+' : ''}${key}` });
      }

      if (event.altKey && key === 'tab') {
        logEvent(attemptId, 'alt_tab_attempt');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('copy', handleClipboard);
    document.addEventListener('cut', handleClipboard);
    document.addEventListener('paste', handleClipboard);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('copy', handleClipboard);
      document.removeEventListener('cut', handleClipboard);
      document.removeEventListener('paste', handleClipboard);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [attemptId, enabled]);

  return { logIntegrity };
}
