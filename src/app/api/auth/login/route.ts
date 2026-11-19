import { NextResponse } from "next/server";
import { createSession, verifyPassword } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST(request: Request) {
  const { email, password } = await request.json();
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  const rows = await sql`SELECT "id", "name", "email", "role", "passwordHash" AS passwordhash, "phone", "department", "semester" FROM "User" WHERE "email" = ${normalizedEmail} LIMIT 1` as unknown as { id: number; name: string; email: string; role: "STUDENT" | "ORGANIZER"; passwordhash: string; phone: string | null; department: string | null; semester: string | null }[];
  const user = rows[0];
  if (!user) return NextResponse.json({ error: "No account was found with this email address." }, { status: 401 });
  if (!verifyPassword(String(password ?? ""), user.passwordhash)) return NextResponse.json({ error: "Incorrect password. Please try again." }, { status: 401 });
  await createSession(user.id);
  return NextResponse.json({ user: { name: user.name, email: user.email, role: user.role.toLowerCase(), phone: user.phone, department: user.department, semester: user.semester } });
}
