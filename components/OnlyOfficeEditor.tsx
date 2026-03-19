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
  onReady,
  onError,
}: OnlyOfficeEditorProps) {
  const [config, setConfig] = useState<object | null>(null);
  const [editorId] = useState(() => `oo-${crypto.randomUUID().slice(0, 8)}`);

  const serverUrl = (
    process.env.NEXT_PUBLIC_ONLYOFFICE_SERVER_URL ?? ""
  ).replace(/\/$/, "");

  useEffect(() => {
    const hostname = window.location.hostname;
    const port = window.location.port || "3000";
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
    const base = isLocal
      ? `http://host.docker.internal:${port}`
      : `${window.location.protocol}//${hostname}${port ? `:${port}` : ""}`;

    const proxiedUrl = `${base}/api/onlyoffice-file?url=${encodeURIComponent(fileUrl)}`;

    const params = new URLSearchParams();
    if (documentId) params.set("documentId", documentId);
    if (templateId) params.set("templateId", templateId);
    if (storageId) params.set("storageId", storageId);

    const callbackUrl = `${base}/api/onlyoffice-callback?${params.toString()}`;

    setConfig({
      document: {
        fileType: "docx",
        key: storageId ? `${fileKey}-${storageId.slice(-8)}` : fileKey,
        title: fileName,
        url: proxiedUrl,
        permissions: {
          chat: false,
          comment: false,
          download: true,
          edit: true,
          fillForms: true,
          modifyContentControl: true,
          modifyFilter: false,
          print: false,
          review: false,
        },
      },
      documentType: "word",
      editorConfig: {
        callbackUrl,
        mode: "edit",
        lang: "en",
        customization: {
          autosave: true,
          forcesave: false,
          compactHeader: true,
          compactToolbar: false, // ← false: toolbar always expanded, not hidden
          hideRightMenu: true,
          integrationMode: "embed",
          toolbarHideFileName: true,
          features: { tabStyle: "line", tabBackground: "toolbar" },
          plugins: false,
          macros: false,
          spellcheck: false,
          help: false,
          feedback: false,
          logo: { visible: false },
          uiTheme: "theme-contrast-dark",
        },
      },
    });

    return () => {
      try {
        const win = window as any;
        win.DocEditor?.instances?.[editorId]?.destroyEditor();
      } catch (_) {}
    };
  }, [fileUrl, fileKey, documentId, templateId, storageId, editorId]);

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
