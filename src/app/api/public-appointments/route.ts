import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendWhatsApp } from "@/lib/whatsapp";
import { validateBookingSlot } from "@/lib/booking-validation";
import crypto from "crypto";

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

async function verifyStripePayment(paymentIntentId: string): Promise<boolean> {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey || !paymentIntentId) return false;

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeSecretKey);
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return intent.status === "succeeded";
  } catch {
    return false;
  }
}

async function verifyMercadoPagoPayment(preferenceId: string): Promise<boolean> {
  const mpAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!mpAccessToken || !preferenceId) return false;

  try {
    const res = await fetch(
      `https://api.mercadopago.com/v1/payments/search?external_reference=${preferenceId}`,
      { headers: { Authorization: `Bearer ${mpAccessToken}` } }
    );
    const data = await res.json();
    return data.results?.some((p: { status: string }) => p.status === "approved");
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const rateCheck = checkRateLimit(`public-booking:${ip}`, 5, 60000);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        error: "Demasiadas reservas. Esperá un minuto antes de intentar de nuevo.",
      },
      { status: 429 }
    );
  }

  const body = await request.json();
  const {
    date,
    time,
    service_id,
    client_name,
    client_email,
    client_phone,
    payment_intent_id,
    payment_method,
    tenant_id,
  } = body;

  if (!date || !time || !client_name || !client_email || !tenant_id) {
    return NextResponse.json(
      { error: "Faltan campos requeridos" },
      { status: 400 }
    );
  }

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client_email)) {
    return NextResponse.json(
      { error: "Email inválido" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("appointments_limit, features, deposit_percent, default_cleaning_time, filter_by_service")
    .eq("id", tenant_id)
    .single();

  if (!tenant) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  // --- Server-side slot validation (availability, blocked dates, past, overlap) ---
  const validation = await validateBookingSlot(supabase, {
    tenantId: tenant_id,
    serviceId: service_id || null,
    date,
    time,
  });

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status || 400 });
  }

  const { data: service } = await supabase
    .from("services")
    .select("name")
    .eq("id", service_id)
    .single();

  if (service_id && !service) {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  }

  const features = { ...tenant.features } as Record<string, boolean>;

  // --- Blacklist check (Plan Inicial+) ---
  if (features.blacklist && client_phone) {
    const { data: blocked } = await supabase
      .from("client_blacklist")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("phone", client_phone)
      .maybeSingle();

    if (blocked) {
      return NextResponse.json(
        { error: "No podés reservar turnos en este negocio." },
        { status: 403 }
      );
    }
  }

  // --- Limit check ---
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  const startStr = startOfMonth.toISOString().split("T")[0];

  const { count } = await supabase
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenant_id)
    .gte("date", startStr);

  if (count != null && count >= tenant.appointments_limit) {
    return NextResponse.json(
      { error: "El negocio alcanzó su límite mensual de turnos." },
      { status: 403 }
    );
  }

  // --- Verify payment actually succeeded ---
  let paymentVerified = false;
  if (payment_method === "stripe" && payment_intent_id) {
    paymentVerified = await verifyStripePayment(payment_intent_id);
  } else if (payment_method === "mercadopago" && payment_intent_id) {
    paymentVerified = await verifyMercadoPagoPayment(payment_intent_id);
  } else if (!payment_method) {
    paymentVerified = true; // Free booking
  }

  if (!paymentVerified) {
    return NextResponse.json(
      { error: "El pago no fue verificado. Intentá de nuevo." },
      { status: 402 }
    );
  }

  // --- Confirmation token (Plan Premium) ---
  const confirmationToken = features.confirmation_button
    ? crypto.randomBytes(24).toString("hex")
    : null;

  const appointment: Record<string, unknown> = {
    date,
    time,
    service_id: service_id || null,
    service: service?.name || "",
    status: "confirmed",
    client_name,
    client_email,
    client_phone: client_phone || null,
    payment_id: payment_intent_id || null,
    payment_method: payment_method || null,
    payment_status: payment_method ? "paid" : "unpaid",
    tenant_id: tenant_id || null,
    user_id: null,
    is_recurring: false,
    confirmation_token: confirmationToken,
  };

  // Insert via service role: la policy RLS de INSERT anónimo está cerrada,
  // y este endpoint ya validó (slot, rate limit, pago, blacklist, límite).
  const { error } = await createAdminClient().from("appointments").insert(appointment);

  if (error) {
    return NextResponse.json(
      {
        error: error.message.includes("unique")
          ? "Ese horario ya fue reservado"
          : error.message,
      },
      { status: 409 }
    );
  }

  // --- WhatsApp with confirmation button (Plan Premium) ---
  if (client_phone) {
    const serviceName = service?.name || "Turno";
    const dateFormatted = formatDate(date);
    let msg = `✅ *Turno Confirmado* 🎉\n\nHola ${client_name}, tu turno fue reservado con éxito.\n\n📅 *Fecha:* ${dateFormatted}\n⏰ *Horario:* ${time} hs\n💇 *Servicio:* ${serviceName}`;

    if (confirmationToken) {
      const confirmUrl = `${process.env.NEXT_PUBLIC_ORIGIN || "http://localhost:3000"}/api/confirm-appointment?token=${confirmationToken}`;
      const cancelUrl = `${process.env.NEXT_PUBLIC_ORIGIN || "http://localhost:3000"}/cancelar?token=${confirmationToken}`;
      msg += `\n\n👉 *Confirmá tu turno:* ${confirmUrl}\n❌ *Cancelar:* ${cancelUrl}`;
    } else {
      msg += `\n\nTe esperamos!`;
    }

    sendWhatsApp(client_phone, msg).catch(() => {});
  }

  return NextResponse.json({ success: true });
}
