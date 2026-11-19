import { NextResponse } from "next/server";
import { createSession, hashPassword } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const phone = String(body.phone ?? "").trim();
  const department = String(body.department ?? "").trim();
  const semester = String(body.semester ?? "").trim();
  if (!name || !email || !password || !phone || !department || !semester) return NextResponse.json({ error: "Please complete every field." }, { status: 400 });
  if (!/^[^\s@]+@pu\.edu\.pk$/i.test(email)) return NextResponse.json({ error: "Sign up is limited to PU university email addresses ending in @pu.edu.pk." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  try {
    const rows = await sql`INSERT INTO "User" ("name", "email", "passwordHash", "role", "phone", "department", "semester") VALUES (${name}, ${email}, ${hashPassword(password)}, 'STUDENT', ${phone}, ${department}, ${semester}) RETURNING "id"` as unknown as { id: number }[];
    await createSession(rows[0].id);
    return NextResponse.json({ user: { name, email, role: "student", phone, department, semester } }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("unique")) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    return NextResponse.json({ error: "Could not create your account. Please try again." }, { status: 500 });
  }
}
