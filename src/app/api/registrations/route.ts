import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "STUDENT") return NextResponse.json({ error: "Sign in with a student account before registering." }, { status: 401 });
  const body = await request.json();
  const eventId = Number(body.eventId);
  const fullName = String(body.fullName ?? "").trim();
  const paymentProof = typeof body.paymentProof === "string" ? body.paymentProof : "";
  if (!Number.isInteger(eventId) || !fullName) return NextResponse.json({ error: "Your full name is required." }, { status: 400 });
  const paymentRows = await sql`SELECT "requiresPayment", "date" FROM "Event" WHERE "id" = ${eventId}` as unknown as { requiresPayment: boolean; date: string }[];
  if (!paymentRows[0]) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  if (new Date(paymentRows[0].date) <= new Date()) return NextResponse.json({ error: "Registration is closed because this event has started or finished." }, { status: 400 });
  if (paymentRows[0].requiresPayment && !paymentProof) return NextResponse.json({ error: "Payment proof is required for this event." }, { status: 400 });

  const result = await sql`WITH lock AS (
    SELECT pg_advisory_xact_lock(${eventId})
  ), event_data AS (
    SELECT e."capacity", e."requiresPayment", COUNT(r."id")::int AS activecount
    FROM "Event" e
    LEFT JOIN "Registration" r ON r."eventId" = e."id" AND r."status" = 'ACTIVE'
    CROSS JOIN lock
    WHERE e."id" = ${eventId}
    GROUP BY e."id"
  ), inserted AS (
    INSERT INTO "Registration" ("eventId", "userId", "status", "fullName", "phone", "department", "semester", "notes", "paymentProof")
    SELECT ${eventId}, ${user.id}, 'ACTIVE', ${fullName}, ${String(body.phone ?? "").trim() || null}, ${String(body.department ?? "").trim() || null}, ${String(body.semester ?? "").trim() || null}, ${String(body.notes ?? "").trim() || null}, ${paymentProof || null}
    FROM event_data
    WHERE event_data.activecount < event_data.capacity AND (event_data."requiresPayment" = false OR ${Boolean(paymentProof)})
    ON CONFLICT ("eventId", "userId") DO UPDATE SET "status" = 'ACTIVE', "fullName" = EXCLUDED."fullName", "phone" = EXCLUDED."phone", "department" = EXCLUDED."department", "semester" = EXCLUDED."semester", "notes" = EXCLUDED."notes"
      WHERE "Registration"."status" = 'CANCELLED'
    RETURNING "id"
  )
  SELECT (SELECT "capacity" FROM event_data) AS capacity,
         (SELECT "requiresPayment" FROM event_data) AS requirespayment,
         (SELECT activecount FROM event_data) AS activecount,
         (SELECT "id" FROM inserted LIMIT 1) AS registrationid` as unknown as { capacity: number | null; requirespayment: boolean; activecount: number | null; registrationid: number | null }[];
  const event = result[0];
  if (!event || event.capacity === null) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  if (event.activecount !== null && event.activecount >= event.capacity) return NextResponse.json({ error: "This event is fully booked." }, { status: 409 });
  if (!event.registrationid) return NextResponse.json({ error: "You are already registered for this event." }, { status: 409 });
  return NextResponse.json({ registrationId: event.registrationid }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const eventId = Number(new URL(request.url).searchParams.get("eventId"));
  await sql`UPDATE "Registration" SET "status" = 'CANCELLED' WHERE "eventId" = ${eventId} AND "userId" = ${user.id} AND "status" = 'ACTIVE'`;
  return NextResponse.json({ ok: true });
}
