// app/api/onlyoffice-callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

// ── Convex admin helper ───────────────────────────────────────────────────────
// Memanggil internal Convex mutation menggunakan CONVEX_DEPLOY_KEY.
// Tidak butuh HTTP secret apapun — ini adalah pola resmi Convex server-to-server.

async function runConvexMutation(
  path: string,
  args: Record<string, unknown>
): Promise<void> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const deployKey = process.env.CONVEX_DEPLOY_KEY;

  if (!convexUrl || !deployKey) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL or CONVEX_DEPLOY_KEY is not set");
  }

  const res = await fetch(`${convexUrl}/api/mutation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Convex ${deployKey}`,
    },
    body: JSON.stringify({ path, args }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Convex mutation "${path}" failed (${res.status}): ${text}`
    );
  }
}

// ── Upload file ke Convex storage ─────────────────────────────────────────────
// Menggunakan CONVEX_DEPLOY_KEY untuk generate upload URL, lalu upload langsung.

async function uploadFileToConvex(fileBuffer: ArrayBuffer): Promise<string> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const deployKey = process.env.CONVEX_DEPLOY_KEY;

  if (!convexUrl || !deployKey) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL or CONVEX_DEPLOY_KEY is not set");
  }

  // Generate upload URL via Convex admin API
  const uploadUrlRes = await fetch(`${convexUrl}/api/action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Convex ${deployKey}`,
    },
    body: JSON.stringify({
      path: "storage:generateUploadUrl",
      args: {},
    }),
  });

  // Fallback: beberapa Convex setup tidak expose storage action langsung.
  // Kalau gagal, kita gunakan Convex HTTP endpoint site URL yang sudah ada (/getUploadUrl)
  // tapi dengan Authorization header deploy key.
  let uploadUrl: string;

  if (!uploadUrlRes.ok) {
    // Fallback ke convex site URL
    const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "";
    const fallbackRes = await fetch(`${convexSiteUrl}/getUploadUrl`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Pass deploy key sebagai internal auth — update http.ts untuk support ini
        "x-deploy-key": deployKey,
      },
    });
    if (!fallbackRes.ok) {
      throw new Error(`Could not get upload URL: ${fallbackRes.status}`);
    }
    const data = await fallbackRes.json();
    uploadUrl = data.uploadUrl;
  } else {
    const data = await uploadUrlRes.json();
    // Convex action response wraps value
    uploadUrl = data?.value ?? data?.uploadUrl ?? data;
    if (typeof uploadUrl !== "string") {
      throw new Error("Unexpected upload URL response from Convex");
    }
  }

  // Upload file ke Convex storage
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
    body: fileBuffer,
  });

  if (!uploadRes.ok) {
    throw new Error(`File upload failed: ${uploadRes.status}`);
  }

  const { storageId } = await uploadRes.json();
  if (!storageId) throw new Error("No storageId returned from upload");

  return storageId;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { status, url, token } = body;

    // ── Verifikasi JWT dari OnlyOffice ────────────────────────────────────────
    const jwtSecret = process.env.ONLYOFFICE_JWT_SECRET;
    if (jwtSecret) {
      try {
        const payload = token || body.token;
        if (!payload) {
          console.error("[onlyoffice-callback] missing JWT token");
          return NextResponse.json(
            { error: 1, message: "Unauthorized" },
            { status: 401 }
          );
        }
        jwt.verify(payload, jwtSecret, { algorithms: ["HS256"] });
      } catch (jwtErr) {
        console.error("[onlyoffice-callback] invalid JWT:", jwtErr);
        return NextResponse.json(
          { error: 1, message: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    // ── Handle save ───────────────────────────────────────────────────────────
    // status 2 = dokumen ditutup setelah diedit
    // status 6 = force save (dipicu oleh forcesave: true di config)
    // Referensi: https://api.onlyoffice.com/editors/callback#status
    if ((status === 2 || status === 6) && url) {
      const documentId = req.nextUrl.searchParams.get("documentId");
      const templateId = req.nextUrl.searchParams.get("templateId");

      const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "";
      if (!convexSiteUrl) {
        console.error(
          "[onlyoffice-callback] NEXT_PUBLIC_CONVEX_SITE_URL not set"
        );
        return NextResponse.json({ error: 0 });
      }

      try {
        // 1. Download file yang sudah di-save dari server OnlyOffice
        const fileRes = await fetch(url, { redirect: "follow" });
        if (!fileRes.ok) {
          console.error(
            "[onlyoffice-callback] download from OO server failed:",
            fileRes.status
          );
          return NextResponse.json({ error: 0 });
        }
        const fileBuffer = await fileRes.arrayBuffer();

        // 2. Upload ke Convex storage menggunakan deploy key
        const savedStorageId = await uploadFileToConvex(fileBuffer);
        const newFileUrl = `${convexSiteUrl}/getFile?storageId=${savedStorageId}`;

        // 3. Update record di database via Convex admin mutation
        if (documentId) {
          await runConvexMutation("documents:updateFileStorageInternal", {
            id: documentId,
            storageId: savedStorageId,
            fileUrl: newFileUrl,
          });
          console.log(
            `[onlyoffice-callback] document saved OK: ${documentId} → ${savedStorageId}`
          );
        } else if (templateId) {
          await runConvexMutation("templates:updateFileStorageInternal", {
            id: templateId,
            storageId: savedStorageId,
            fileUrl: newFileUrl,
          });
          console.log(
            `[onlyoffice-callback] template saved OK: ${templateId} → ${savedStorageId}`
          );
        } else {
          console.warn(
            "[onlyoffice-callback] no documentId or templateId in query — skipping DB update"
          );
        }
      } catch (saveErr) {
        // Log error secara eksplisit — jangan silent fail
        // (sebelumnya ini menyebabkan "all changes saved" padahal file tidak tersimpan)
        console.error("[onlyoffice-callback] SAVE FAILED:", saveErr);
      }
    }

    // Selalu return { error: 0 } ke OnlyOffice agar tidak retry agresif
    return NextResponse.json({ error: 0 });
  } catch (err) {
    console.error("[onlyoffice-callback] parse error:", err);
    return NextResponse.json({ error: 0 });
  }
}
