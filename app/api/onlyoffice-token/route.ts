// app/api/onlyoffice-token/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function POST(req: NextRequest) {
  try {
    const {
      fileUrl,
      fileName,
      fileKey,
      documentId,
      templateId,
      storageId,
      userId,
      userName,
      userAvatar,
    } = await req.json();

    // App URL — used for callback and file proxy (stays on Vercel/Next.js)
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL ??
      `${req.nextUrl.protocol}//${req.nextUrl.host}`
    ).replace(/\/$/, "");

    // OnlyOffice server URL — browser connects DIRECTLY here (WebSocket needs direct connection)
    const ooServerUrl = (
      process.env.NEXT_PUBLIC_ONLYOFFICE_SERVER_URL ?? ""
    ).replace(/\/$/, "");

    const proxiedUrl = `${appUrl}/api/onlyoffice-file?url=${encodeURIComponent(fileUrl)}`;

    const params = new URLSearchParams();
    if (documentId) params.set("documentId", documentId);
    if (templateId) params.set("templateId", templateId);
    if (storageId) params.set("storageId", storageId);
    const callbackUrl = `${appUrl}/api/onlyoffice-callback?${params.toString()}`;

    const config: Record<string, unknown> = {
      document: {
        fileType: "docx",
        key: storageId ? `${fileKey}-${storageId.slice(-8)}` : fileKey,
        title: fileName,
        url: proxiedUrl,
        permissions: {
          chat: false,
          comment: true,
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
        user: {
          id: userId ?? `guest-${Math.random().toString(36).slice(2, 8)}`,
          name: userName ?? "Anonymous",
          ...(userAvatar ? { image: userAvatar } : {}),
        },
        customization: {
          autosave: true,
          forcesave: false,
          compactHeader: true,
          compactToolbar: false,
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
    };

    // Sign the config with JWT if secret is set
    const jwtSecret = process.env.ONLYOFFICE_JWT_SECRET;
    if (jwtSecret) {
      config.token = jwt.sign(config, jwtSecret, { algorithm: "HS256" });
    }

    return NextResponse.json({
      config,
      // Return direct OO server URL — browser must connect directly for WebSocket
      serverUrl: ooServerUrl,
    });
  } catch (err) {
    console.error("[onlyoffice-token] error:", err);
    return NextResponse.json(
      { error: "Failed to build config" },
      { status: 500 }
    );
  }
}
