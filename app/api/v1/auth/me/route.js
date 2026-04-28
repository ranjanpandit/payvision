import { NextResponse } from "next/server";
import { getSessionUserFromCookies } from "@/lib/auth";
import { withApiLogging } from "@/lib/api-logger";

export const runtime = "nodejs";

const getHandler = async () => {
  const user = await getSessionUserFromCookies();
  if (!user) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ success: true, user });
};

export const GET = withApiLogging("auth/me:GET", getHandler);
