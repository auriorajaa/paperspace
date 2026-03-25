import { NextRequest, NextResponse } from "next/server";

const OO_SERVER = (process.env.NEXT_PUBLIC_ONLYOFFICE_SERVER_URL ?? "").replace(
  /\/$/,
  ""
);

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const upstreamPath = params.path.join("/");
  const search = req.nextUrl.search ?? "";
  const upstreamUrl = `${OO_SERVER}/${upstreamPath}${search}`;

  const upstream = await fetch(upstreamUrl, {
    headers: {
      "ngrok-skip-browser-warning": "true",
      "User-Agent": "NextJS-Proxy/1.0",
    },
    redirect: "follow",
  });

  const contentType =
    upstream.headers.get("content-type") ?? "application/octet-stream";
  const body = await upstream.arrayBuffer();

  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
