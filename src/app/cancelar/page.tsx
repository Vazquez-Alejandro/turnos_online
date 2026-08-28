"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { XCircle, CalendarCheck2 } from "lucide-react";
import BackButton from "@/components/BackButton";
import { useLang } from "@/contexts/LangContext";

function CancelContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { t } = useLang();
  const [appointment, setAppointment] = useState<{
    date: string;
    time: string;
    service: string | null;
  } | null>(null);
  const [status, setStatus] = useState<
    "loading" | "notfound" | "expired" | "ready" | "error" | "done"
  >("loading");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("notfound");
      return;
    }

    fetch(`/api/appointment-summary?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.status === 410) {
          setStatus("expired");
          return;
        }
        if (!res.ok) {
          setStatus("notfound");
          return;
        }
        const data = await res.json();
        setAppointment({ date: data.date, time: data.time, service: data.service });
        setStatus("ready");
      })
      .catch(() => setStatus("notfound"));
  }, [token]);

  const handleCancel = async () => {
    if (!token) return;
    setCancelling(true);
    const res = await fetch("/api/cancel-appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (res.ok) {
      setStatus("done");
    } else {
      const r = await res.json().catch(() => ({}));
      setStatus(r.status === 410 ? "expired" : "error");
    }
    setCancelling(false);
  };

  if (status === "loading") {
    return <p className="text-white/50 text-center py-16">{t.common.loading}</p>;
  }

  if (status === "notfound") {
    return (
      <div className="text-center py-16">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-white/70">{t.cancelPage.notFound}</p>
        <BackButton href="/" />
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="text-center py-16">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-white/70">{t.cancelPage.expired}</p>
        <BackButton href="/" />
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="text-center py-16">
        <CalendarCheck2 className="w-12 h-12 text-amber-400 mx-auto mb-4" />
        <p className="text-xl font-bold text-white mb-2">{t.cancelPage.success}</p>
        <Link
          href="/"
          className="mt-4 inline-block px-4 py-2 bg-white/10 text-white/80 rounded-lg hover:bg-white/15 transition-all"
        >
          {t.cancelPage.goHome}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto text-center py-16">
      <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
      <h1 className="text-2xl font-bold text-white mb-2">{t.cancelPage.title}</h1>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 my-6">
        <p className="text-white/50">
          {t.cancelPage.details}{" "}
          <span className="text-white font-medium">
            {appointment?.date} {t.cancelPage.at} {appointment?.time}
          </span>
        </p>
        {appointment?.service && (
          <p className="text-white/40 mt-2">{appointment.service}</p>
        )}
      </div>

      {status === "error" && (
        <p className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
          {t.cancelPage.error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="px-4 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-400 transition-all disabled:opacity-50"
        >
          {cancelling ? t.common.loading : t.cancelPage.confirm}
        </button>
        <Link
          href="/"
          className="px-4 py-3 bg-white/5 text-white/70 rounded-xl font-medium hover:bg-white/10 transition-all"
        >
          {t.cancelPage.back}
        </Link>
      </div>
    </div>
  );
}

export default function CancelPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <Suspense
        fallback={<p className="text-white/50 text-center py-16">{""}</p>}
      >
        <CancelContent />
      </Suspense>
    </div>
  );
}