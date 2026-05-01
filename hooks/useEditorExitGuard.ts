// hooks/useEditorExitGuard.ts
"use client";

import { useCallback } from "react";

const STORAGE_KEY = "editor-exit-timestamp";

export function useEditorExitGuard(cooldownMs = 4000) {
  const markExit = useCallback(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(STORAGE_KEY, Date.now().toString());
  }, []);

  const getRemainingMs = useCallback(() => {
    if (typeof window === "undefined") return 0;
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const elapsed = Date.now() - parseInt(raw, 10);
    return Math.max(0, cooldownMs - elapsed);
  }, [cooldownMs]);

  const canEnter = useCallback(() => {
    return getRemainingMs() === 0;
  }, [getRemainingMs]);

  return { markExit, canEnter, getRemainingMs };
}
