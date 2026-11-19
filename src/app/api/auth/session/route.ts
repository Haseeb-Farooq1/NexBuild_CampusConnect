import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  const registrations = await sql`SELECT "eventId" AS eventid FROM "Registration" WHERE "userId" = ${user.id} AND "status" = 'ACTIVE'` as unknown as { eventid: number }[];
  return NextResponse.json({ user: { name: user.name, email: user.email, role: user.role.toLowerCase(), phone: user.phone, department: user.department, semester: user.semester }, registeredIds: registrations.map((item) => item.eventid) });
}
