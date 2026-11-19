import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ORGANIZER") return NextResponse.json({ error: "Organizer access required." }, { status: 403 });
  const { id } = await context.params;
  const rows = await sql`SELECT "paymentProof" FROM "Registration" WHERE "id" = ${Number(id)} LIMIT 1` as unknown as { paymentProof: string | null }[];
  const proof = rows[0]?.paymentProof;
  if (!proof || !proof.startsWith("data:image/")) return NextResponse.json({ error: "Payment proof not found." }, { status: 404 });
  const match = proof.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return NextResponse.json({ error: "Invalid payment proof." }, { status: 415 });
  return new NextResponse(Buffer.from(match[2], "base64"), { headers: { "Content-Type": match[1], "Cache-Control": "private, max-age=300" } });
}
