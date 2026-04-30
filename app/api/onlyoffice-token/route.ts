// app/api/onlyoffice-token/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { auth } from "@clerk/nextjs/server";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (entry.count >= 30) return true;
  entry.count++;
  return false;
}

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  try {
    const {
      fileUrl,
      fileName,
      fileKey,
      documentId,
      templateId,
      storageId,
      userId: editorUserId,
      userName,
      userAvatar,
    } = await req.json();

    // console.log("[onlyoffice-token] Building config for:", {
    //   documentId,
    //   templateId,
    //   fileName,
    // });

    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL ??
      `${req.nextUrl.protocol}//${req.nextUrl.host}`
    ).replace(/\/$/, "");

    const ooServerUrl = (
      process.env.NEXT_PUBLIC_ONLYOFFICE_SERVER_URL ?? ""
    ).replace(/\/$/, "");

    if (!ooServerUrl) {
      // console.error(
      //   "[onlyoffice-token] NEXT_PUBLIC_ONLYOFFICE_SERVER_URL not set"
      // );
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Build callback URL dengan documentId/templateId
    const params = new URLSearchParams();
    if (documentId) params.set("documentId", documentId);
    if (templateId) params.set("templateId", templateId);

    const callbackUrl = `${appUrl}/api/onlyoffice-callback?${params.toString()}`;
    //console.log("[onlyoffice-token] Callback URL:", callbackUrl);

    // ── FIX: Gunakan fileKey yang stabil, TIDAK include storageId ────────────
    // fileKey sudah unik per dokumen (doc-${documentId}-${creationTime})
    // storageId berubah setiap save, kalau dimasukkan ke key akan trigger
    // re-initialize editor setiap kali file di-save.
    const documentKey = fileKey;

    const config: Record<string, unknown> = {
      document: {
        fileType: "docx",
        key: documentKey,
        title: fileName,
        url: fileUrl,
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
          id: editorUserId ?? `guest-${Math.random().toString(36).slice(2, 8)}`,
          name: userName ?? "Anonymous",
          ...(userAvatar ? { image: userAvatar } : {}),
        },
        customization: {
          // ── FIX BUG 1: Aktifkan force save ───────────────────────────────
          autosave: true,
          forcesave: true, // ← WAS: false
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

    const jwtSecret = process.env.ONLYOFFICE_JWT_SECRET;
    if (jwtSecret) {
      config.token = jwt.sign(config, jwtSecret, { algorithm: "HS256" });
      //console.log("[onlyoffice-token] JWT token generated");
    }

    // console.log(
    //   "[onlyoffice-token] Config built successfully, key:",
    //   documentKey
    // );

    return NextResponse.json({
      config,
      serverUrl: ooServerUrl,
    });
  } catch (err) {
    //console.error("[onlyoffice-token] error:", err);
    return NextResponse.json(
      { error: "Failed to build config" },
      { status: 500 }
    );
  }
}
