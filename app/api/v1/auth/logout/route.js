import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";
import { withApiLogging } from "@/lib/api-logger";

export const runtime = "nodejs";

const postHandler = async () => {
  await clearSessionCookie();
  return NextResponse.json({ success: true });
};

export const POST = withApiLogging("auth/logout:POST", postHandler);
