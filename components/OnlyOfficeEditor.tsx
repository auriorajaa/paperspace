// components/OnlyOfficeEditor.tsx
"use client";

import { DocumentEditor } from "@onlyoffice/document-editor-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";

import { useTheme } from "@/contexts/ThemeContext";

interface OnlyOfficeEditorProps {
  fileUrl: string;
  fileName: string;
  fileKey: string;
  documentId?: string;
  templateId?: string;
  storageId?: string;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  onReady?: () => void;
  onError?: () => void;
}

const LOADING_STEPS = [
  { delay: 0, label: "Connecting to editor..." },
  { delay: 1500, label: "Fetching document..." },
  { delay: 3000, label: "Rendering content..." },
  { delay: 6000, label: "Almost ready..." },
];

function LoadingSteps() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = LOADING_STEPS.slice(1).map((s, i) =>
      setTimeout(() => setStep(i + 1), s.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: "var(--accent-light, #7c9dff)" }}
      />
      <p
        className="text-[12px] transition-all duration-300"
        style={{ color: "var(--text-muted, rgba(255,255,255,0.45))" }}
      >
        {LOADING_STEPS[step].label}
      </p>
    </div>
  );
}

function OnlyOfficeInner({
  fileUrl,
  fileName,
  fileKey,
  documentId,
  templateId,
  storageId,
  userId,
  userName,
  userAvatar,
  onReady,
  onError,
}: OnlyOfficeEditorProps) {
  const [editorId] = useState(() => `oo-${crypto.randomUUID().slice(0, 8)}`);
  const [editorData, setEditorData] = useState<{
    config: object;
    serverUrl: string;
  } | null>(null);
  const [configError, setConfigError] = useState(false);

  const mountedRef = useRef(true);
  const { theme } = useTheme();

  // ── FIX: Config key HANYA berdasarkan identitas dokumen yang stabil ───────
  // storageId SENGAJA tidak dimasukkan — storageId berubah setiap OO save.
  // Kalau masuk ke configKey akan trigger rebuild editor di tengah sesi.
  const configKey = `${fileKey}::${documentId ?? ""}::${templateId ?? ""}`;

  // Track configKey yang sudah di-fetch agar tidak re-fetch yang sama
  const fetchedConfigKeyRef = useRef<string>("");

  const uiTheme = theme === "light" ? "default-light" : "theme-contrast-dark";

  // Keep latest callbacks in refs — hindari stale closure
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onReadyRef.current = onReady;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Skip fetch kalau configKey sama persis — mencegah double-fetch
    // karena React StrictMode atau re-render parent
    if (configKey === fetchedConfigKeyRef.current && editorData) return;
    fetchedConfigKeyRef.current = configKey;

    setEditorData(null);
    setConfigError(false);

    const controller = new AbortController();

    async function buildConfig() {
      try {
        console.log("[OnlyOfficeEditor] Fetching config with key:", configKey);

        const res = await fetch("/api/onlyoffice-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileUrl,
            fileName,
            fileKey,
            documentId,
            templateId,
            storageId,
            userId,
            userName,
            userAvatar,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(
            `Token endpoint returned ${res.status}: ${errorText}`
          );
        }

        const { config, serverUrl } = await res.json();

        if (!mountedRef.current) return;

        console.log(
          "[OnlyOfficeEditor] Config received, serverUrl:",
          serverUrl
        );
        setEditorData({ config, serverUrl });
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error("[ONLYOFFICE] Failed to build config:", err);
        if (!mountedRef.current) return;
        setConfigError(true);
        onErrorRef.current?.();
      }
    }

    buildConfig();

    return () => {
      controller.abort();
      // Cleanup: destroy editor instance kalau ada
      try {
        const win = window as any;
        if (win.DocEditor?.instances?.[editorId]) {
          win.DocEditor.instances[editorId].destroyEditor();
          console.log(
            "[OnlyOfficeEditor] Destroyed editor instance:",
            editorId
          );
        }
      } catch (_) {
        // Ignore cleanup errors
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey, editorId]);

  if (configError) return null;

  if (!editorData) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-inherit">
        <LoadingSteps />
      </div>
    );
  }

  const baseConfig = editorData.config as {
    editorConfig?: {
      customization?: Record<string, unknown>;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };

  // Inject uiTheme tanpa rebuild seluruh config
  const themedConfig = {
    ...baseConfig,
    editorConfig: {
      ...(baseConfig.editorConfig ?? {}),
      customization: {
        ...(baseConfig.editorConfig?.customization ?? {}),
        uiTheme,
      },
    },
  };

  return (
    <div className="relative flex-1 w-full h-full" style={{ minHeight: 0 }}>
      <DocumentEditor
        id={editorId}
        documentServerUrl={editorData.serverUrl}
        config={themedConfig}
        events_onDocumentReady={() => {
          console.log("[OnlyOfficeEditor] Document ready");
          onReadyRef.current?.();
        }}
        onLoadComponentError={(code: number, desc: string) => {
          console.error("[ONLYOFFICE] Load error:", code, desc);
          onErrorRef.current?.();
        }}
      />
    </div>
  );
}

export const OnlyOfficeEditor = dynamic(
  () => Promise.resolve(OnlyOfficeInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center w-full">
        <div
          className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--accent-light, #7c9dff)" }}
        />
      </div>
    ),
  }
) as ComponentType<OnlyOfficeEditorProps>;
