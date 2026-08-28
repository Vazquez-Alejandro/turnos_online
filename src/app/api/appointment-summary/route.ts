import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token requerido" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("appointments")
    .select("date, time, service, created_at")
    .eq("confirmation_token", token)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
  }

  const createdAt = new Date(data.created_at).getTime();
  const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;
  if (Date.now() - createdAt > TOKEN_TTL_MS) {
    return NextResponse.json({ error: "Enlace expirado" }, { status: 410 });
  }

  return NextResponse.json({
    date: data.date,
    time: data.time,
    service: data.service,
  });
}