import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Params) {
  const { id } = await context.params;
  const rows = await sql`SELECT e."id", e."title", e."category", e."description", e."date", e."location", e."capacity", e."requiresPayment", e."paymentAmount", e."bannerImage", COUNT(r."id")::int AS registered FROM "Event" e LEFT JOIN "Registration" r ON r."eventId" = e."id" AND r."status" = 'ACTIVE' WHERE e."id" = ${Number(id)} AND e."date" > NOW() GROUP BY e."id"`;
  if (!rows[0]) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  return NextResponse.json({ event: { ...rows[0], seats: rows[0].capacity } });
}

export async function PUT(request: Request, context: Params) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ORGANIZER") return NextResponse.json({ error: "Organizer access required." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json();
  const capacity = Number(body.capacity);
  const paymentAmount = body.requiresPayment ? Number(body.paymentAmount) : null;
  const bannerImage = typeof body.bannerImage === 'string' && body.bannerImage.startsWith('data:image/') ? body.bannerImage : undefined;
  if (!body.title || !body.date || !body.location || !body.description || !Number.isInteger(capacity) || capacity < 1) return NextResponse.json({ error: "Complete every field with a valid seat count." }, { status: 400 });
  if (body.requiresPayment && (paymentAmount === null || !Number.isFinite(paymentAmount) || paymentAmount <= 0)) return NextResponse.json({ error: "Enter a valid payment amount for this event." }, { status: 400 });
  const rows = await sql`UPDATE "Event" SET "title" = ${String(body.title).trim()}, "category" = ${String(body.category)}, "description" = ${String(body.description)}, "date" = ${new Date(body.date).toISOString()}, "location" = ${String(body.location)}, "capacity" = ${capacity}, "requiresPayment" = ${Boolean(body.requiresPayment)}, "paymentAmount" = ${paymentAmount}, "bannerImage" = COALESCE(${bannerImage ?? null}, "bannerImage") WHERE "id" = ${Number(id)} AND "organizerId" = ${user.id} AND "date" > NOW() RETURNING "id", "title", "category", "description", "date", "location", "capacity", "requiresPayment", "paymentAmount", "bannerImage"`;
  if (!rows[0]) return NextResponse.json({ error: "Event not found or cannot be edited." }, { status: 404 });
  return NextResponse.json({ event: { ...rows[0], seats: rows[0].capacity, registered: 0 } });
}

export async function DELETE(_request: Request, context: Params) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ORGANIZER") return NextResponse.json({ error: "Organizer access required." }, { status: 403 });
  const { id } = await context.params;
  const eventId = Number(id);
  await sql.transaction([
    sql`DELETE FROM "Registration" WHERE "eventId" = ${eventId}`,
    sql`DELETE FROM "Event" WHERE "id" = ${eventId} AND "organizerId" = ${user.id}`,
  ]);
  return NextResponse.json({ ok: true });
}
