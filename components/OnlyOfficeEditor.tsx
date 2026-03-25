"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { DocumentEditor } from "@onlyoffice/document-editor-react";

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
  const [config, setConfig] = useState<object | null>(null);
  const [editorId] = useState(() => `oo-${crypto.randomUUID().slice(0, 8)}`);

  const serverUrl = (
    process.env.NEXT_PUBLIC_ONLYOFFICE_SERVER_URL ?? ""
  ).replace(/\/$/, "");

  useEffect(() => {
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
        const { config } = await res.json();
        setConfig(config);
      } catch (err) {
        console.error("[ONLYOFFICE] Failed to build config:", err);
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

  if (!config) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p className="text-xs text-muted-foreground">Loading editor…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full h-full">
      <DocumentEditor
        id={editorId}
        documentServerUrl={serverUrl}
        config={config}
        events_onDocumentReady={onReady}
        onLoadComponentError={(code: number, desc: string) => {
          console.error("[ONLYOFFICE]", code, desc);
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
      <div className="flex-1 flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    ),
  }
) as React.ComponentType<OnlyOfficeEditorProps>;
