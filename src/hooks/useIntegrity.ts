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

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [attemptId, enabled]);

  return { logIntegrity };
}
