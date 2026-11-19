import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

type DbEvent = { id: number; title: string; category: string; description: string; date: string; location: string; capacity: number; registered: number; requiresPayment: boolean; paymentAmount: number | null; bannerImage: string | null };

export async function GET() {
  await sql.transaction([
    sql`DELETE FROM "Registration" WHERE "eventId" IN (SELECT "id" FROM "Event" WHERE "date" <= NOW())`,
    sql`DELETE FROM "Event" WHERE "date" <= NOW()`,
  ]);
  const events = await sql`SELECT e."id", e."title", e."category", e."description", e."date", e."location", e."capacity", e."requiresPayment", e."paymentAmount", e."bannerImage", COUNT(r."id")::int AS registered FROM "Event" e LEFT JOIN "Registration" r ON r."eventId" = e."id" AND r."status" = 'ACTIVE' WHERE e."published" = true AND e."date" > NOW() GROUP BY e."id" ORDER BY e."date" ASC` as unknown as DbEvent[];
  return NextResponse.json({ events: events.map((event) => ({ ...event, seats: event.capacity })) });
}

export async function POST(request: Request) {
  const organizer = await getCurrentUser();
  if (!organizer || organizer.role !== "ORGANIZER") return NextResponse.json({ error: "Organizer access required." }, { status: 403 });
  const body = await request.json();
  const title = String(body.title ?? "").trim();
  const capacity = Number(body.capacity);
  const paymentAmount = body.requiresPayment ? Number(body.paymentAmount) : null;
  const bannerImage = typeof body.bannerImage === "string" && body.bannerImage.startsWith("data:image/") ? body.bannerImage : null;
  if (!title || !body.date || !body.location || !body.description || !Number.isInteger(capacity) || capacity < 1) return NextResponse.json({ error: "Complete every field with a valid seat count." }, { status: 400 });
  if (body.requiresPayment && (paymentAmount === null || !Number.isFinite(paymentAmount) || paymentAmount <= 0)) return NextResponse.json({ error: "Enter a valid payment amount for this event." }, { status: 400 });
  const rows = await sql`INSERT INTO "Event" ("title", "category", "description", "date", "location", "capacity", "requiresPayment", "paymentAmount", "bannerImage", "published", "organizerId") VALUES (${title}, ${String(body.category)}, ${String(body.description)}, ${new Date(body.date).toISOString()}, ${String(body.location)}, ${capacity}, ${Boolean(body.requiresPayment)}, ${paymentAmount}, ${bannerImage}, true, ${organizer.id}) RETURNING "id", "title", "category", "description", "date", "location", "capacity", "requiresPayment", "paymentAmount", "bannerImage", 0::int AS registered` as unknown as DbEvent[];
  return NextResponse.json({ event: { ...rows[0], seats: rows[0].capacity } }, { status: 201 });
}
