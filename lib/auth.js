import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "payvision_session";
const TOKEN_AGE_SECONDS = 60 * 60 * 24 * 7;

function getSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "change-this-secret-in-env";
  return new TextEncoder().encode(secret);
}

export async function hashPassword(plain) {
  return hash(String(plain), 12);
}

export async function verifyPassword(plain, passwordHash) {
  return compare(String(plain), String(passwordHash));
}

export async function signAuthToken(payload, maxAge = TOKEN_AGE_SECONDS) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(getSecret());
}

export async function verifyAuthToken(token) {
  const { payload } = await jwtVerify(token, getSecret());
  return payload;
}

export async function setSessionCookie(payload, maxAge = TOKEN_AGE_SECONDS) {
  const token = await signAuthToken(payload, maxAge);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionUserFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const payload = await verifyAuthToken(token);
    const userId = Number(payload?.userId || 0);
    if (!userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, merchantId: true, isActive: true },
    });

    if (!user || !user.isActive) return null;
    return user;
  } catch {
    return null;
  }
}

export function sanitizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}
