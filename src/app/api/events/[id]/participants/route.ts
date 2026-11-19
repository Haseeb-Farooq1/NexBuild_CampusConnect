import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ORGANIZER") return NextResponse.json({ error: "Organizer access required." }, { status: 403 });
  const { id } = await context.params;
  const participants = await sql`SELECT r."id", r."fullName", r."phone", r."department", r."semester", r."notes", CASE WHEN r."paymentProof" IS NOT NULL THEN '/api/registrations/' || r."id" || '/proof' ELSE NULL END AS "paymentProof", r."createdAt", u."email" FROM "Registration" r JOIN "User" u ON u."id" = r."userId" JOIN "Event" e ON e."id" = r."eventId" WHERE r."eventId" = ${Number(id)} AND r."status" = 'ACTIVE' ORDER BY r."createdAt" DESC`;
  return NextResponse.json({ participants });
}
