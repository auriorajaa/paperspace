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

  const uiTheme = theme === "light" ? "default-light" : "default-dark";

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setEditorData(null);
    setConfigError(false);

    async function buildConfig() {
      try {
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
        });

        if (!res.ok) throw new Error(`Token endpoint returned ${res.status}`);

        const { config, serverUrl } = await res.json();
        if (!mountedRef.current) return;
        setEditorData({ config, serverUrl });
      } catch (err) {
        console.error("[ONLYOFFICE] Failed to build config:", err);
        if (!mountedRef.current) return;
        setConfigError(true);
        onError?.();
      }
    }

    buildConfig();

    return () => {
      try {
        const win = window as any;
        win.DocEditor?.instances?.[editorId]?.destroyEditor();
      } catch (_) {}
    };
  }, [
    fileUrl,
    fileKey,
    documentId,
    templateId,
    storageId,
    userId,
    userName,
    userAvatar,
    editorId,
  ]);

  if (configError) {
    return null;
  }

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
          onReady?.();
        }}
        onLoadComponentError={(code: number, desc: string) => {
          console.error("[ONLYOFFICE] Load error:", code, desc);
          onError?.();
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


