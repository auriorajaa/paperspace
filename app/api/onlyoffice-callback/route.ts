// app/api/onlyoffice-callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

// ── Upload file ke Convex storage ─────────────────────────────────────────────
// Menggunakan x-internal-secret untuk auth (shared secret)

async function uploadFileToConvex(fileBuffer: ArrayBuffer): Promise<string> {
  const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  const internalSecret = process.env.INTERNAL_API_SECRET;

  if (!convexSiteUrl || !internalSecret) {
    throw new Error(
      "NEXT_PUBLIC_CONVEX_SITE_URL or INTERNAL_API_SECRET is not set"
    );
  }

  const uploadUrlEndpoint = `${convexSiteUrl.replace(/\/$/, "")}/getUploadUrl`;

  //console.log("[uploadFileToConvex] Requesting upload URL...");

  const uploadUrlRes = await fetch(uploadUrlEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": internalSecret,
    },
    body: JSON.stringify({}), // body kosong, auth via header
  });

  if (!uploadUrlRes.ok) {
    const text = await uploadUrlRes.text();
    throw new Error(
      `Could not get upload URL: ${uploadUrlRes.status} - ${text}`
    );
  }

  const { uploadUrl } = await uploadUrlRes.json();
  if (!uploadUrl || typeof uploadUrl !== "string") {
    throw new Error("Invalid upload URL response from Convex");
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
    const text = await uploadRes.text();
    throw new Error(`File upload failed: ${uploadRes.status} - ${text}`);
  }

  const { storageId } = await uploadRes.json();
  if (!storageId) throw new Error("No storageId returned from upload");

  return storageId;
}

// ── Convex callback helper ────────────────────────────────────────────────────

async function runConvexCallbackMutation(
  type: "document" | "template",
  id: string,
  storageId: string,
  fileUrl: string
): Promise<void> {
  const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  const internalSecret = process.env.INTERNAL_API_SECRET;

  if (!convexSiteUrl || !internalSecret) {
    throw new Error(
      "NEXT_PUBLIC_CONVEX_SITE_URL or INTERNAL_API_SECRET is not set"
    );
  }

  const res = await fetch(
    `${convexSiteUrl.replace(/\/$/, "")}/onlyofficeCallback`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": internalSecret,
      },
      body: JSON.stringify({ type, id, storageId, fileUrl }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Convex callback failed (${res.status}): ${text}`);
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { status, url, token } = body;

    // console.log("[onlyoffice-callback] Received callback:", {
    //   status,
    //   hasUrl: !!url,
    //   hasToken: !!token,
    //   query: req.nextUrl.searchParams.toString(),
    // });

    // ── Verifikasi JWT dari OnlyOffice ────────────────────────────────────────
    const jwtSecret = process.env.ONLYOFFICE_JWT_SECRET;
    if (jwtSecret) {
      try {
        const payload = token || body.token;
        if (!payload) {
          return NextResponse.json(
            { error: 1, message: "Unauthorized" },
            { status: 401 }
          );
        }
        jwt.verify(payload, jwtSecret, { algorithms: ["HS256"] });
        // console.log("[onlyoffice-callback] JWT verified");
      } catch {
        return NextResponse.json(
          { error: 1, message: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    if (status === 3) {
      // console.error("[onlyoffice-callback] OO reported save error");
      return NextResponse.json(
        { error: 1, message: "Save error" },
        { status: 500 }
      );
    }

    if ((status === 2 || status === 6) && url) {
      const documentId = req.nextUrl.searchParams.get("documentId");
      const templateId = req.nextUrl.searchParams.get("templateId");

      if (!documentId && !templateId) {
        return NextResponse.json(
          { error: 1, message: "Missing documentId or templateId" },
          { status: 400 }
        );
      }

      // console.log("[onlyoffice-callback] Processing save for:", {
      //   documentId,
      //   templateId,
      // });

      try {
        // 1. Download file dari OO server
        //console.log("[onlyoffice-callback] Downloading from OO server:", url);
        const fileRes = await fetch(url, { redirect: "follow" });
        if (!fileRes.ok) {
          const errorText = await fileRes.text().catch(() => "");
          // console.error(
          //   "[onlyoffice-callback] Download failed:",
          //   fileRes.status,
          //   errorText
          // );
          return NextResponse.json(
            { error: 1, message: `Download failed: ${fileRes.status}` },
            { status: 502 }
          );
        }
        const fileBuffer = await fileRes.arrayBuffer();
        // console.log(
        //   "[onlyoffice-callback] Downloaded file size:",
        //   fileBuffer.byteLength
        // );

        // 2. Upload ke Convex storage
        //console.log("[onlyoffice-callback] Uploading to Convex...");
        const savedStorageId = await uploadFileToConvex(fileBuffer);
        const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "";
        const newFileUrl = `${convexSiteUrl}/getFile?storageId=${savedStorageId}`;
        // console.log(
        //   "[onlyoffice-callback] Uploaded to Convex, new storageId:",
        //   savedStorageId
        // );

        // 3. Update record di database
        if (documentId) {
          await runConvexCallbackMutation(
            "document",
            documentId,
            savedStorageId,
            newFileUrl
          );
          // console.log(
          //   `[onlyoffice-callback] document saved OK: ${documentId} → ${savedStorageId}`
          // );
        } else if (templateId) {
          await runConvexCallbackMutation(
            "template",
            templateId,
            savedStorageId,
            newFileUrl
          );
          // console.log(
          //   `[onlyoffice-callback] template saved OK: ${templateId} → ${savedStorageId}`
          // );
        }

        return NextResponse.json({ error: 0 });
      } catch (saveErr: any) {
        // console.error("[onlyoffice-callback] SAVE FAILED:", saveErr);
        return NextResponse.json(
          { error: 1, message: saveErr.message || "Save failed" },
          { status: 500 }
        );
      }
    }

    //console.log("[onlyoffice-callback] Status", status, "- no save needed");
    return NextResponse.json({ error: 0 });
  } catch (err) {
    //console.error("[onlyoffice-callback] parse error:", err);
    return NextResponse.json(
      { error: 1, message: "Bad request" },
      { status: 400 }
    );
  }
}
