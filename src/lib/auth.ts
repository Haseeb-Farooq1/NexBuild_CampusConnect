import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "./db";

const SESSION_COOKIE = "campus_session";
const SESSION_DAYS = 7;

export type DbUser = { id: number; name: string; email: string; role: "STUDENT" | "ORGANIZER"; passwordhash: string; phone: string | null; department: string | null; semester: string | null };

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: unknown) {
  if (typeof stored !== "string") return false;
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const derived = scryptSync(password, salt, 64);
  return timingSafeEqual(derived, Buffer.from(key, "hex"));
}

function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  await sql`INSERT INTO "Session" ("tokenHash", "userId", "expiresAt") VALUES (${hashToken(token)}, ${userId}, ${new Date(Date.now() + SESSION_DAYS * 86400000).toISOString()})`;
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_DAYS * 86400 });
}

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await sql`SELECT u."id", u."name", u."email", u."role", u."passwordHash" AS passwordhash, u."phone", u."department", u."semester" FROM "Session" s JOIN "User" u ON u."id" = s."userId" WHERE s."tokenHash" = ${hashToken(token)} AND s."expiresAt" > NOW() LIMIT 1` as unknown as DbUser[];
  return rows[0] ?? null;
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await sql`DELETE FROM "Session" WHERE "tokenHash" = ${hashToken(token)}`;
  cookieStore.delete(SESSION_COOKIE);
}
