import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateBookingSlot } from "@/lib/booking-validation";
import crypto from "crypto";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const rateCheck = checkRateLimit(`appointments:${user.id}`, 10, 60000);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Demasiadas reservas. Esperá un minuto antes de intentar de nuevo." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const { date, time, service, service_id, notes, recurring, recurring_end_date } = body;

  if (!date || !time || !service_id) {
    return NextResponse.json(
      { error: "Faltan campos requeridos" },
      { status: 400 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;

  const datesToCreate = [date];
  if (recurring && recurring_end_date) {
    const end = new Date(recurring_end_date);
    const current = new Date(date);
    current.setDate(current.getDate() + 7);
    while (current <= end) {
      datesToCreate.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 7);
    }
  }

  if (tenantId) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("appointments_limit, features, default_cleaning_time, filter_by_service")
      .eq("id", tenantId)
      .single();

    if (tenant) {
      const features = { ...tenant.features } as Record<string, boolean>;

      // Check availability for every date (recurring included) BEFORE inserting
      for (const d of datesToCreate) {
        const validation = await validateBookingSlot(supabase, {
          tenantId,
          serviceId: service_id || null,
          date: d,
          time,
        });

        if (!validation.ok) {
          return NextResponse.json(
            { error: validation.error },
            { status: validation.status || 400 }
          );
        }
      }

      // Limit check
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      const startStr = startOfMonth.toISOString().split("T")[0];

      const { count } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .gte("date", startStr);

      if (count != null && count >= tenant.appointments_limit) {
        return NextResponse.json(
          { error: "Alcanzaste el límite de turnos de tu plan. Actualizalo en Configuración." },
          { status: 403 }
        );
      }

      // Blacklist check for authenticated users
      if (features.blacklist) {
        const { data: blocked } = await supabase
          .from("client_blacklist")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("email", user.email || "")
          .maybeSingle();

        if (blocked) {
          return NextResponse.json(
            { error: "No podés reservar turnos en este negocio." },
            { status: 403 }
          );
        }
      }
    }
  }

  const confirmationToken = crypto.randomBytes(24).toString("hex");

  const appointments = datesToCreate.map((d: string) => ({
    user_id: user.id,
    tenant_id: profile?.tenant_id || null,
    date: d,
    time,
    service: service || null,
    service_id,
    notes: notes || null,
    status: "confirmed",
    is_recurring: !!recurring,
    recurring_end_date: recurring ? recurring_end_date || null : null,
    confirmation_token: confirmationToken,
  }));

  const { error } = await supabase.from("appointments").insert(appointments);

  if (error) {
    return NextResponse.json(
      {
        error: error.message.includes("unique")
          ? "Uno o más horarios ya fueron reservados"
          : error.message,
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ success: true, count: datesToCreate.length });
}
