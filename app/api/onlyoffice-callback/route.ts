// app/api/onlyoffice-callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { status, url, token } = body;

    const jwtSecret = process.env.ONLYOFFICE_JWT_SECRET;
    if (jwtSecret) {
      try {
        const payload = token || body.token;
        if (!payload) {
          console.error("[onlyoffice-callback] missing token");
          return NextResponse.json(
            { error: 1, message: "Unauthorized" },
            { status: 401 }
          );
        }
        jwt.verify(payload, jwtSecret, { algorithms: ["HS256"] });
      } catch (jwtErr) {
        console.error("[onlyoffice-callback] invalid token:", jwtErr);
        return NextResponse.json(
          { error: 1, message: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    if ((status === 2 || status === 6) && url) {
      const documentId = req.nextUrl.searchParams.get("documentId");
      const templateId = req.nextUrl.searchParams.get("templateId");
      const storageId = req.nextUrl.searchParams.get("storageId");

      try {
        const fileRes = await fetch(url, { redirect: "follow" });
        if (!fileRes.ok) {
          console.error(
            "[onlyoffice-callback] download failed:",
            fileRes.status
          );
          return NextResponse.json({ error: 0 });
        }
        const fileBuffer = await fileRes.arrayBuffer();

        const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "";
        if (!convexSiteUrl) {
          console.error(
            "[onlyoffice-callback] NEXT_PUBLIC_CONVEX_SITE_URL not set"
          );
          return NextResponse.json({ error: 0 });
        }

        const internalSecret = process.env.INTERNAL_SECRET;

        const uploadUrlRes = await fetch(`${convexSiteUrl}/getUploadUrl`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(internalSecret ? { "x-internal-secret": internalSecret } : {}),
          },
        });
        if (!uploadUrlRes.ok) {
          console.error(
            "[onlyoffice-callback] getUploadUrl failed:",
            uploadUrlRes.status
          );
          return NextResponse.json({ error: 0 });
        }
        const { uploadUrl } = await uploadUrlRes.json();

        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          },
          body: fileBuffer,
        });
        if (!uploadRes.ok) {
          console.error(
            "[onlyoffice-callback] upload failed:",
            uploadRes.status
          );
          return NextResponse.json({ error: 0 });
        }

        const uploadResult = await uploadRes.json();
        const savedStorageId = uploadResult.storageId;

        if (!savedStorageId) {
          console.error(
            "[onlyoffice-callback] no storageId in upload response",
            uploadResult
          );
          return NextResponse.json({ error: 0 });
        }

        const newFileUrl = `${convexSiteUrl}/getFile?storageId=${savedStorageId}`;
        const updateRes = await fetch(`${convexSiteUrl}/updateFileStorage`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(internalSecret ? { "x-internal-secret": internalSecret } : {}),
          },
          body: JSON.stringify({
            documentId,
            templateId,
            storageId: savedStorageId,
            fileUrl: newFileUrl,
          }),
        });

        if (!updateRes.ok) {
          const errText = await updateRes.text();
          console.error(
            "[onlyoffice-callback] updateFileStorage failed:",
            errText
          );
        }
      } catch (saveErr) {
        console.error("[onlyoffice-callback] save error:", saveErr);
      }
    }

    return NextResponse.json({ error: 0 });
  } catch (err) {
    console.error("[onlyoffice-callback] parse error:", err);
    return NextResponse.json({ error: 0 });
  }
}