"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Save,
  Loader2,
  Upload,
  Building2,
  Globe,
  Palette,
  Crown,
  Check,
  ArrowUp,
  ToggleLeft,
  ToggleRight,
  Ban,
  Clock,
  Users,
  CalendarPlus,
  CreditCard,
  BarChart3,
  MessageSquare,
} from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { useTenant } from "@/contexts/TenantContext";
import { useLang } from "@/contexts/LangContext";
import type { PlanDefinition, CustomField } from "@/types";
import { FEATURES, DEFAULT_FEATURES } from "@/types";

const PLAN_COLORS: Record<string, string> = {
  free: "#6b7280",
  pro: "#f59e0b",
  premium: "#f59e0b",
};

function planDisplayName(name: string): string {
  const names: Record<string, string> = {
    free: "Gratuito",
    pro: "Pro",
    premium: "Premium",
  };
  return names[name] || name;
}

import { formatPrice } from "@/lib/utils";

const FEATURE_ICONS: Record<string, React.ReactNode> = {
  blacklist: <Ban className="w-4 h-4" />,
  cleaning_time: <Clock className="w-4 h-4" />,
  smart_assignment: <Users className="w-4 h-4" />,
  double_booking: <CalendarPlus className="w-4 h-4" />,
  mandatory_deposit: <CreditCard className="w-4 h-4" />,
  no_show_tracking: <BarChart3 className="w-4 h-4" />,
  confirmation_button: <MessageSquare className="w-4 h-4" />,
};

export default function SettingsContent() {
  const { tenant, loading: tenantLoading } = useTenant();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#f59e0b");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [saved, setSaved] = useState(false);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [features, setFeatures] = useState<Record<string, boolean>>(DEFAULT_FEATURES);
  const [depositPercent, setDepositPercent] = useState(0);
  const [defaultCleaningTime, setDefaultCleaningTime] = useState(0);
  const [savingFeatures, setSavingFeatures] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<CustomField["type"]>("text");
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [savingFields, setSavingFields] = useState(false);
  const supabase = useRef(createClient()).current;
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLang();

  useEffect(() => {
    if (tenant) {
      setName(tenant.name);
      setSlug(tenant.slug);
      setPrimaryColor(tenant.primary_color || "#f59e0b");
      setLogoUrl(tenant.logo_url);
      setFeatures({ ...DEFAULT_FEATURES, ...(tenant.features || {}) });
      setDepositPercent(tenant.deposit_percent || 0);
      setDefaultCleaningTime(tenant.default_cleaning_time || 0);
      setCustomFields(tenant.custom_fields || []);
    }
    fetchPlans();
  }, [tenant]);

  const fetchPlans = async () => {
    const { data } = await supabase
      .from("plan_definitions")
      .select("*")
      .order("price_monthly_cents");
    if (data) setPlans(data as PlanDefinition[]);
  };

  const handleChangePlan = async (planName: string) => {
    setUpgrading(planName);
    const res = await fetch("/api/change-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planName }),
    });
    const data = await res.json();
    setUpgrading(null);
    if (!res.ok) {
      toast(data.error || "Error al cambiar de plan", "error");
      return;
    }
    toast(`Plan actualizado a ${planDisplayName(planName)}`, "success");
    window.location.reload();
  };

  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenant) return;

    setUploading(true);
    const ext = file.name.split(".").pop();
    const fileName = `${tenant.id}/logo-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("tenant-logos")
      .upload(fileName, file);

    if (uploadError) {
      toast("Error al subir el logo", "error");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("tenant-logos")
      .getPublicUrl(fileName);

    setLogoUrl(urlData.publicUrl);
    setUploading(false);
  };

  const handleSave = async () => {
    if (!tenant || !name.trim()) return;
    setSaving(true);
    setSaved(false);

    const updates: Record<string, unknown> = {
      name: name.trim(),
      primary_color: primaryColor,
    };
    if (logoUrl) updates.logo_url = logoUrl;

    const { error } = await supabase
      .from("tenants")
      .update(updates)
      .eq("id", tenant.id);

    if (error) {
      toast("Error al guardar", "error");
    } else {
      setSaved(true);
      toast("Configuración guardada", "success");
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  const handleToggleFeature = async (key: string) => {
    if (!tenant) return;
    const next = !features[key];
    setFeatures((prev) => ({ ...prev, [key]: next }));
    setSavingFeatures(true);
    await supabase
      .from("tenants")
      .update({ features: { ...features, [key]: next } })
      .eq("id", tenant.id);
    setSavingFeatures(false);
  };

  const saveCustomFields = async (fields: CustomField[]) => {
    if (!tenant) return;
    setSavingFields(true);
    const ordered = fields.map((f, i) => ({ ...f, order: i }));
    await supabase.from("tenants").update({ custom_fields: ordered }).eq("id", tenant.id);
    setCustomFields(ordered);
    setSavingFields(false);
  };

  const addCustomField = () => {
    if (!newFieldName.trim()) return;
    const field: CustomField = {
      name: newFieldName.trim(),
      type: newFieldType,
      required: newFieldRequired,
      order: customFields.length,
    };
    const next = [...customFields, field];
    setNewFieldName("");
    setNewFieldType("text");
    setNewFieldRequired(false);
    saveCustomFields(next);
  };

  const removeCustomField = (index: number) => {
    const next = customFields.filter((_, i) => i !== index);
    saveCustomFields(next);
  };

  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (!tenant) {
    return <p className="text-white/50 text-center py-16">No se encontró el negocio</p>;
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white">{t.admin.settingsPage.title}</h1>

      {/* Logo */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">
          Logo
        </h2>
        <div className="flex items-center gap-6">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold text-white overflow-hidden border border-white/10"
            style={{ backgroundColor: primaryColor }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              tenant.name.charAt(0)
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={uploadLogo}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white/70 rounded-xl text-sm hover:bg-white/10 transition-all"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {logoUrl ? t.admin.settingsPage.changeLogo : t.admin.settingsPage.uploadLogo}
            </button>
            <p className="text-xs text-white/30 mt-2">
              {t.admin.settingsPage.logoFormat}
            </p>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">
          {t.admin.settingsPage.info}
        </h2>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            {t.admin.settingsPage.businessName}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" />
            {t.admin.settingsPage.publicUrl}
          </label>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
            <span className="text-white/30 text-sm">tudominio.com/</span>
            <span className="text-white font-medium">{slug}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5" />
            {t.admin.settingsPage.primaryColor}
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-10 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer"
            />
            <span className="text-sm text-white/50 font-mono">{primaryColor}</span>
            <div className="flex gap-1">
              {["#f59e0b", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"].map(
                (c) => (
                  <button
                    key={c}
                    onClick={() => setPrimaryColor(c)}
                    className="w-6 h-6 rounded-full border border-white/10 transition-transform hover:scale-110"
                    style={{ backgroundColor: c }}
                  />
                )
              )}
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-400 transition-all disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? t.admin.settingsPage.saved : t.admin.settingsPage.save}
        </button>
      </div>

      {/* Custom Fields */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-400" />
          {t.admin.settingsPage.customFields}
        </h2>
        <p className="text-xs text-white/30 mb-4">
          {t.admin.settingsPage.customFieldsDesc}
        </p>

        {customFields.length > 0 && (
          <div className="space-y-2 mb-4">
            {customFields.map((field, i) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-xl px-4 py-2.5"
              >
                <span className="text-sm text-white font-medium flex-1">{field.name}</span>
                <span className="text-[10px] text-white/30 uppercase tracking-wider">{field.type}</span>
                {field.required && (
                  <span className="text-[10px] text-red-400 font-medium">{t.admin.settingsPage.required}</span>
                )}
                <button
                  onClick={() => removeCustomField(i)}
                  className="text-white/20 hover:text-red-400 transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-white/50 mb-1">{t.admin.settingsPage.fieldName}</label>
            <input
              type="text"
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              placeholder="Ej: DNI"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1">{t.admin.settingsPage.fieldType}</label>
            <select
              value={newFieldType}
              onChange={(e) => setNewFieldType(e.target.value as CustomField["type"])}
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
            >
              <option value="text">{t.admin.settingsPage.types.text}</option>
              <option value="number">{t.admin.settingsPage.types.number}</option>
              <option value="date">{t.admin.settingsPage.types.date}</option>
              <option value="tel">{t.admin.settingsPage.types.tel}</option>
            </select>
          </div>
          <label className="flex items-center gap-1.5 pb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={newFieldRequired}
              onChange={(e) => setNewFieldRequired(e.target.checked)}
              className="accent-amber-500"
            />
            <span className="text-xs text-white/50">{t.admin.settingsPage.fieldRequired}</span>
          </label>
          <button
            onClick={addCustomField}
            disabled={savingFields || !newFieldName.trim()}
            className="px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-400 transition-all disabled:opacity-50"
          >
            {savingFields ? <Loader2 className="w-4 h-4 animate-spin" /> : "+"}
          </button>
        </div>
      </div>

      {/* Plan */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-400" />
          {t.admin.settingsPage.plan}
        </h2>

        <div className="flex items-center gap-3 mb-4">
          <div
            className="px-3 py-1 rounded-full text-sm font-medium"
            style={{
              backgroundColor: `${PLAN_COLORS[tenant.subscription_status] || "#6b7280"}20`,
              color: PLAN_COLORS[tenant.subscription_status] || "#6b7280",
            }}
          >
            {planDisplayName(tenant.subscription_status)}
          </div>
          <span className="text-sm text-white/40">
            {tenant.appointments_limit >= 999999
              ? "Turnos ilimitados"
              : `Hasta ${tenant.appointments_limit} turnos/mes`}
            &nbsp;&middot;&nbsp;
            {tenant.staff_limit >= 999
              ? "Staff ilimitado"
              : `Hasta ${tenant.staff_limit} miembros`}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {plans.map((plan) => {
            const isCurrent = tenant.subscription_status === plan.name;
            const isLoading = upgrading === plan.name;
            return (
              <div
                key={plan.name}
                className={`p-4 rounded-xl border transition-all flex flex-col ${
                  isCurrent
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
                }`}
              >
                <p className="text-sm font-semibold text-white">{planDisplayName(plan.name)}</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {plan.price_monthly_cents === 0
                    ? "Gratis"
                    : formatPrice(plan.price_monthly_cents)}
                  {plan.price_monthly_cents > 0 && (
                    <span className="text-xs text-white/40 font-normal">/mes</span>
                  )}
                </p>
                <p className="mt-3 text-xs text-white/50 flex-1">{plan.features.join(" · ")}</p>
                {isCurrent ? (
                  <p className="text-xs text-amber-400 mt-3 font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" /> Plan actual
                  </p>
                ) : (
                  <button
                    onClick={() => handleChangePlan(plan.name)}
                    disabled={isLoading}
                    className={`mt-3 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      plan.price_monthly_cents === 0
                        ? "bg-white/5 text-white/60 hover:bg-white/10"
                        : "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                    } disabled:opacity-50`}
                  >
                    {isLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <ArrowUp className="w-3 h-3" />
                    )}
                    {plan.price_monthly_cents === 0 ? t.admin.settingsPage.downgrade : t.admin.settingsPage.selectPlan}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Features */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
          <ToggleRight className="w-4 h-4 text-amber-400" />
          {t.admin.settingsPage.features}
        </h2>
        <p className="text-xs text-white/30 mb-4">
          Activá features según las necesidades de tu negocio. Todo viene apagado por defecto.
        </p>

        {/* Deposit percent (Premium) */}
        {features.mandatory_deposit && (
          <div className="mb-4 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              % de seña obligatoria
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={10}
                max={80}
                step={5}
                value={depositPercent}
                onChange={async (e) => {
                  const v = parseInt(e.target.value);
                  setDepositPercent(v);
                  await supabase
                    .from("tenants")
                    .update({ deposit_percent: v })
                    .eq("id", tenant!.id);
                }}
                className="flex-1 accent-amber-500"
              />
              <span className="text-sm text-white font-medium w-12 text-right">{depositPercent}%</span>
            </div>
          </div>
        )}

        {/* Default cleaning time (Profesional) */}
        {features.cleaning_time && (
          <div className="mb-4 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              Margen de limpieza por defecto (minutos)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={30}
                step={5}
                value={defaultCleaningTime}
                onChange={async (e) => {
                  const v = parseInt(e.target.value);
                  setDefaultCleaningTime(v);
                  await supabase
                    .from("tenants")
                    .update({ default_cleaning_time: v })
                    .eq("id", tenant!.id);
                }}
                className="flex-1 accent-amber-500"
              />
              <span className="text-sm text-white font-medium w-12 text-right">{defaultCleaningTime}min</span>
            </div>
            <p className="text-[10px] text-white/30 mt-1">
              También podés ajustarlo por servicio desde la sección Servicios.
            </p>
          </div>
        )}

        <div className="space-y-2">
          {Object.entries(FEATURES).map(([key, meta]) => {
            const isOn = features[key];
            const isAvailable =
              tenant.subscription_status === "premium" ||
              tenant.subscription_status === "pro" ||
              (meta.plan === "pro" && ["pro", "premium"].includes(tenant.subscription_status));

            return (
              <div
                key={key}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                  isOn
                    ? "border-amber-500/20 bg-amber-500/5"
                    : "border-white/5 bg-white/[0.02]"
                } ${!isAvailable ? "opacity-40" : ""}`}
              >
                <div className="mt-0.5 text-white/40">
                  {FEATURE_ICONS[key]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">{meta.label}</p>
                    <button
                      onClick={() => {
                        if (!isAvailable) {
                          toast(
                            `Disponible desde plan ${planDisplayName(meta.plan)}`,
                            "error"
                          );
                          return;
                        }
                        handleToggleFeature(key);
                      }}
                      disabled={!isAvailable || savingFeatures}
                      className={`shrink-0 transition-all ${
                        isOn ? "text-amber-400" : "text-white/20 hover:text-white/40"
                      }`}
                    >
                      {isOn ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">{meta.desc}</p>
                  <p className="text-[10px] text-white/20 mt-1">
                    Plan {planDisplayName(meta.plan)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
