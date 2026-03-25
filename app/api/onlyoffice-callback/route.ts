// app/api/onlyoffice-callback/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { status, url, key } = body;

    console.log("[onlyoffice-callback] status:", status, "key:", key);

    if ((status === 2 || status === 6) && url) {
      const documentId = req.nextUrl.searchParams.get("documentId");
      const templateId = req.nextUrl.searchParams.get("templateId");
      const storageId = req.nextUrl.searchParams.get("storageId");

      console.log("[onlyoffice-callback] saving for", {
        documentId,
        templateId,
        storageId,
      });

      try {
        // 1. Download edited file from ONLYOFFICE
        const fileRes = await fetch(url, { redirect: "follow" });
        if (!fileRes.ok) {
          console.error(
            "[onlyoffice-callback] download failed:",
            fileRes.status
          );
          return NextResponse.json({ error: 0 });
        }
        const fileBuffer = await fileRes.arrayBuffer();
        console.log(
          "[onlyoffice-callback] downloaded",
          fileBuffer.byteLength,
          "bytes"
        );

        const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "";
        if (!convexSiteUrl) {
          console.error(
            "[onlyoffice-callback] NEXT_PUBLIC_CONVEX_SITE_URL not set"
          );
          return NextResponse.json({ error: 0 });
        }

        // 2. Get upload URL from Convex
        const uploadUrlRes = await fetch(`${convexSiteUrl}/getUploadUrl`, {
          method: "POST",
        });
        if (!uploadUrlRes.ok) {
          console.error(
            "[onlyoffice-callback] getUploadUrl failed:",
            uploadUrlRes.status
          );
          return NextResponse.json({ error: 0 });
        }
        const { uploadUrl } = await uploadUrlRes.json();
        console.log("[onlyoffice-callback] got upload URL");

        // 3. Upload file to Convex storage
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
        console.log(
          "[onlyoffice-callback] uploaded storageId:",
          savedStorageId
        );

        if (!savedStorageId) {
          console.error(
            "[onlyoffice-callback] no storageId in upload response",
            uploadResult
          );
          return NextResponse.json({ error: 0 });
        }

        // 4. Update DB record
        const newFileUrl = `${convexSiteUrl}/getFile?storageId=${savedStorageId}`;
        const updateRes = await fetch(`${convexSiteUrl}/updateFileStorage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
        } else {
          console.log(
            "[onlyoffice-callback] ✓ saved successfully:",
            savedStorageId
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
