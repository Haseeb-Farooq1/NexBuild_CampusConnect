import { NextResponse } from "next/server";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = await request.json();
  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");
  if (!verifyPassword(currentPassword, user.passwordhash)) return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  if (newPassword.length < 8) return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  await sql`UPDATE "User" SET "passwordHash" = ${hashPassword(newPassword)} WHERE "id" = ${user.id}`;
  return NextResponse.json({ ok: true });
}
