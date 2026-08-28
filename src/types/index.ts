export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  subscription_status: string;
  appointments_limit: number;
  staff_limit: number;
  features: Record<string, boolean>;
  filter_by_service: boolean;
  deposit_percent: number;
  default_cleaning_time: number;
  custom_fields: CustomField[];
  created_at: string;
}

export interface Profile {
  id: string;
  tenant_id: string | null;
  role: "owner" | "admin" | "staff" | "client";
  full_name: string | null;
  is_admin: boolean;
  dni: string | null;
  custom_data: Record<string, string>;
  created_at: string;
}

export interface CustomField {
  name: string;
  type: "text" | "number" | "date" | "tel";
  required: boolean;
  order: number;
}

export interface Appointment {
  id: string;
  tenant_id: string | null;
  user_id: string | null;
  service_id: string | null;
  service: string | null;
  notes: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  date: string;
  time: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  payment_status: "unpaid" | "paid" | "refunded";
  payment_method: string | null;
  payment_id: string | null;
  amount_paid: number;
  is_recurring: boolean;
  recurring_end_date: string | null;
  reminder_24h_sent: boolean;
  reminder_1h_sent: boolean;
  confirmation_token: string | null;
  confirmed_at: string | null;
  no_show: boolean;
  waitlist_notified: boolean;
  created_at: string;
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

export interface Availability {
  id: string;
  tenant_id: string | null;
  service_id: string | null;
  day_of_week: number;
  enabled: boolean;
  start_time: string;
  end_time: string;
  slot_duration: number;
}

export interface BlockedDate {
  id: string;
  tenant_id: string | null;
  date: string;
  reason: string | null;
}

export interface Service {
  id: string;
  tenant_id: string | null;
  name: string;
  duration: number;
  price: number;
  active: boolean;
  cleaning_time: number;
}

export interface BlacklistEntry {
  id: string;
  tenant_id: string;
  phone: string | null;
  email: string | null;
  reason: string | null;
  blocked_at: string;
}

export interface WaitlistEntry {
  id: string;
  tenant_id: string;
  service_id: string | null;
  date: string;
  time: string;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  created_at: string;
}

export interface PlanDefinition {
  key: string;
  name: string;
  price_monthly_cents: number;
  appointments_limit: number;
  staff_limit: number;
  features: string[];
}

export const PLAN_LIMITS: Record<string, { appointments: number; staff: number }> = {
  free: { appointments: 30, staff: 1 },
  pro: { appointments: 200, staff: 3 },
  premium: { appointments: 999999, staff: 999 },
};

export const FEATURES: Record<string, { label: string; desc: string; plan: string }> = {
  blacklist: {
    label: "Bloqueo de Clientes",
    desc: "Bloqueá números de teléfono o emails para que no puedan reservar.",
    plan: "pro",
  },
  cleaning_time: {
    label: "Margen de Limpieza",
    desc: "Tiempo muerto automático entre turnos para desinfección o alistamiento.",
    plan: "pro",
  },
  mandatory_deposit: {
    label: "Seña Obligatoria",
    desc: "El cliente paga un % del servicio para confirmar el turno. Reduce ausentismo.",
    plan: "premium",
  },
  no_show_tracking: {
    label: "Historial de No-Show",
    desc: "Estadísticas de clientes que faltan, días rentables y rendimiento por empleado.",
    plan: "premium",
  },
  confirmation_button: {
    label: "Confirmación por WhatsApp",
    desc: "El cliente confirma o cancela desde el link del mensaje. Cancela con 24hs → avisa a lista de espera.",
    plan: "premium",
  },
};

export const DEFAULT_FEATURES: Record<string, boolean> = {
  blacklist: false,
  cleaning_time: false,
  mandatory_deposit: false,
  no_show_tracking: false,
  confirmation_button: false,
};

export const DAY_NAMES = [
  "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado",
];
