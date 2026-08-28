import type { SupabaseClient } from "@supabase/supabase-js";
import { getDay } from "date-fns";

export interface SlotValidationResult {
  ok: boolean;
  error?: string;
  status?: number;
  serviceName?: string | null;
}

interface ValidateOptions {
  tenantId: string;
  serviceId?: string | null;
  date: string;
  time: string;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export async function validateBookingSlot(
  supabase: SupabaseClient,
  { tenantId, serviceId, date, time }: ValidateOptions
): Promise<SlotValidationResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "Fecha inválida", status: 400 };
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return { ok: false, error: "Horario inválido", status: 400 };
  }

  const dateObj = new Date(date + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (dateObj < today) {
    return {
      ok: false,
      error: "No se pueden reservar turnos en fechas pasadas",
      status: 400,
    };
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("filter_by_service, default_cleaning_time")
    .eq("id", tenantId)
    .single();

  if (!tenant) {
    return { ok: false, error: "Negocio no encontrado", status: 404 };
  }

  let duration = 30;
  let cleaning = tenant.default_cleaning_time || 0;
  let serviceName: string | null = null;

  if (serviceId) {
    const { data: service } = await supabase
      .from("services")
      .select("tenant_id, active, duration, cleaning_time, name")
      .eq("id", serviceId)
      .single();

    if (!service || service.tenant_id !== tenantId) {
      return { ok: false, error: "Servicio no válido", status: 400 };
    }
    if (!service.active) {
      return { ok: false, error: "Servicio no disponible", status: 403 };
    }
    duration = service.duration || 30;
    cleaning = service.cleaning_time ?? tenant.default_cleaning_time ?? 0;
    serviceName = service.name;
  }

  const dayOfWeek = getDay(new Date(date + "T12:00:00"));

  const { data: blocked } = await supabase
    .from("blocked_dates")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("date", date)
    .maybeSingle();

  if (blocked) {
    return { ok: false, error: "El negocio no atiende esta fecha", status: 403 };
  }

  let availabilityQuery = supabase
    .from("availability")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("day_of_week", dayOfWeek)
    .eq("enabled", true);

  if (tenant.filter_by_service && serviceId) {
    availabilityQuery = availabilityQuery.eq("service_id", serviceId);
  } else {
    availabilityQuery = availabilityQuery.is("service_id", null);
  }

  const { data: avail } = await availabilityQuery.single();

  if (!avail) {
    return {
      ok: false,
      error: "El negocio no atiende ese día",
      status: 403,
    };
  }

  const startMin = timeToMinutes(avail.start_time);
  const endMin = timeToMinutes(avail.end_time);
  const slotDur = avail.slot_duration || 30;
  const timeMin = timeToMinutes(time);

  if (timeMin < startMin) {
    return { ok: false, error: "Horario fuera de rango", status: 400 };
  }
  if ((timeMin - startMin) % slotDur !== 0) {
    return { ok: false, error: "Horario no disponible", status: 409 };
  }
  if (timeMin + duration + cleaning > endMin) {
    return {
      ok: false,
      error: "El turno excede el horario de atención",
      status: 409,
    };
  }

  const newStart = timeMin;
  const newEnd = timeMin + duration + cleaning;

  const { data: existing } = await supabase
    .from("appointments")
    .select("time, service_id")
    .eq("tenant_id", tenantId)
    .eq("date", date)
    .neq("status", "cancelled");

  if (existing && existing.length > 0) {
    const svcIds = [
      ...new Set(
        existing.map((row) => row.service_id).filter((id): id is string => Boolean(id))
      ),
    ];

    let svcMap = new Map<string, { duration: number; cleaning_time: number }>();
    if (svcIds.length > 0) {
      const { data: svcs } = await supabase
        .from("services")
        .select("id, duration, cleaning_time")
        .in("id", svcIds);
      svcMap = new Map(
        (svcs || []).map((s) => [s.id, { duration: s.duration, cleaning_time: s.cleaning_time }])
      );
    }

    for (const appt of existing) {
      const apptStart = timeToMinutes(appt.time);
      const svc = appt.service_id ? svcMap.get(appt.service_id) : undefined;
      const apptDur = svc?.duration || 30;
      const apptClean = svc?.cleaning_time ?? tenant.default_cleaning_time ?? 0;
      const apptEnd = apptStart + apptDur + apptClean;

      if (newStart < apptEnd && apptStart < newEnd) {
        return { ok: false, error: "Ese horario ya fue reservado", status: 409 };
      }
    }
  }

  return { ok: true, serviceName };
}