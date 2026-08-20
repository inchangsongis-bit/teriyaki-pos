"use client";

import { useEffect, useState } from "react";
import { api, type StaffAlert } from "@/lib/api";

const POLL_INTERVAL_MS = 4000;

export default function StaffAlerts({ emptyMessage }: { emptyMessage?: string }) {
  const [alerts, setAlerts] = useState<StaffAlert[]>([]);
  const [resolvingIds, setResolvingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await api.getAlerts("OPEN");
        if (!cancelled) setAlerts(res.alerts);
      } catch {
        // network hiccup - keep showing the last known alerts, next poll will retry
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  async function resolve(alertId: number) {
    setResolvingIds((prev) => new Set(prev).add(alertId));
    try {
      await api.resolveAlert(alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } finally {
      setResolvingIds((prev) => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  }

  if (alerts.length === 0) {
    return emptyMessage ? <p className="mb-6 text-zinc-500">{emptyMessage}</p> : null;
  }

  return (
    <div className="mb-6 flex flex-col gap-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950"
        >
          <div>
            <p className="font-medium text-red-700 dark:text-red-300">
              {alert.location}: {alert.message || "Customer needs assistance"}
            </p>
            <p className="text-sm text-red-600/70 dark:text-red-400/70">
              {new Date(alert.created_at).toLocaleTimeString()}
            </p>
          </div>
          <button
            onClick={() => resolve(alert.id)}
            disabled={resolvingIds.has(alert.id)}
            className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Resolve
          </button>
        </div>
      ))}
    </div>
  );
}
