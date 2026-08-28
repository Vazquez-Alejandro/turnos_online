import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token requerido" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, confirmed_at, created_at")
    .eq("confirmation_token", token)
    .single();

  if (!appointment) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
  }

  // Token expires after 48 hours
  const createdAt = new Date(appointment.created_at).getTime();
  const now = Date.now();
  const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;
  if (now - createdAt > TOKEN_TTL_MS) {
    return NextResponse.json(
      { error: "El enlace expiró. Solicitá uno nuevo." },
      { status: 410 }
    );
  }

  if (appointment.confirmed_at) {
    return NextResponse.json({ message: "Turno ya confirmado previamente" });
  }

  await supabase
    .from("appointments")
    .update({ confirmed_at: new Date().toISOString() })
    .eq("id", appointment.id);

  return NextResponse.json({ success: true, message: "Turno confirmado" });
}
