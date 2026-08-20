"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type MenuItem } from "@/lib/api";

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function StaffMenuPage() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [reasonDrafts, setReasonDrafts] = useState<Record<number, string>>({});
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());

  function loadMenu() {
    api.getMenu().then((res) => setMenu(res.items));
  }

  useEffect(loadMenu, []);

  const categories = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of menu) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    }
    return [...map.entries()];
  }, [menu]);

  async function setAvailability(item: MenuItem, isAvailable: boolean) {
    setSavingIds((prev) => new Set(prev).add(item.id));
    try {
      const reason = isAvailable ? undefined : reasonDrafts[item.id] || "Sold Out";
      const updated = await api.setMenuItemAvailability(item.id, isAvailable, reason);
      setMenu((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  return (
    <div className="flex-1 bg-zinc-50 p-6 dark:bg-black">
      <h1 className="mb-2 text-2xl font-semibold">Menu Availability</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Mark items sold out or out of order to stop them from being ordered on the kiosk.
      </p>

      {categories.map(([category, items]) => (
        <div key={category} className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">{category}</h2>
          <div className="overflow-hidden rounded-xl border border-black/[.08] bg-white dark:border-white/[.145] dark:bg-zinc-900">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center gap-3 border-b border-black/[.08] p-3 last:border-b-0 dark:border-white/[.145]"
              >
                <div className="min-w-40 flex-1">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-zinc-500">{formatPrice(item.price_cents)}</p>
                </div>

                {!item.is_available && (
                  <input
                    type="text"
                    placeholder="Reason (e.g. Sold Out, Out of Order)"
                    defaultValue={item.unavailable_reason ?? ""}
                    onChange={(e) =>
                      setReasonDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    onBlur={(e) => {
                      const reason = e.target.value || "Sold Out";
                      if (reason !== item.unavailable_reason) setAvailability(item, false);
                    }}
                    className="w-56 rounded-lg border border-black/[.08] p-2 text-sm dark:border-white/[.145]"
                  />
                )}

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={item.is_available}
                    disabled={savingIds.has(item.id)}
                    onChange={(e) => setAvailability(item, e.target.checked)}
                  />
                  {item.is_available ? "Available" : "Unavailable"}
                </label>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
