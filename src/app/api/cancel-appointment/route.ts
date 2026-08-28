import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp } from "@/lib/whatsapp";

export async function POST(req: Request) {
  const { token } = await req.json().catch(() => ({ token: null }));

  if (!token) {
    return NextResponse.json({ error: "Token requerido" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, date, time, client_name, tenant_id, service, service_id, created_at")
    .eq("confirmation_token", token)
    .single();

  if (!appointment) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
  }

  // Token expires after 48 hours
  const createdAt = new Date(appointment.created_at).getTime();
  const nowMs = Date.now();
  const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;
  if (nowMs - createdAt > TOKEN_TTL_MS) {
    return NextResponse.json(
      { error: "El enlace expiró. Solicitá uno nuevo." },
      { status: 410 }
    );
  }

  const now = new Date();
  const apptDate = new Date(appointment.date + "T" + (appointment.time || "12:00"));
  const diffHours = (apptDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Cancel the appointment
  await supabase
    .from("appointments")
    .update({
      status: "cancelled",
      confirmed_at: null,
    })
    .eq("id", appointment.id);

  // If cancelled with 24h+ notice, notify waitlist
  if (diffHours >= 24 && appointment.tenant_id) {
    const { data: waitlistEntries } = await supabase
      .from("waitlist")
      .select("*")
      .eq("tenant_id", appointment.tenant_id)
      .eq("date", appointment.date)
      .eq("time", appointment.time)
      .eq("service_id", appointment.service_id)
      .order("created_at");

    for (const entry of waitlistEntries || []) {
      if (entry.client_phone) {
        const msg = `📢 *Turno disponible!*\n\nSe liberó un turno para el ${appointment.date} a las ${appointment.time} hs.\n\nReservalo antes de que se vuelva a ocupar.`;
        sendWhatsApp(entry.client_phone, msg).catch(() => {});
      }
    }

    // Clean up notified waitlist entries
    if (waitlistEntries?.length) {
      await supabase
        .from("waitlist")
        .delete()
        .in("id", waitlistEntries.map((e) => e.id));
    }
  }

  return NextResponse.json({
    success: true,
    message: "Turno cancelado. " + (diffHours >= 24 ? "Se notificó a la lista de espera." : "Cancelaste con poca anticipación."),
  });
}