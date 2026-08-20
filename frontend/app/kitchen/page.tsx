"use client";

import { useEffect, useState } from "react";
import { api, type Order } from "@/lib/api";

const POLL_INTERVAL_MS = 4000;

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [completingIds, setCompletingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await api.getOrders("PRINTED");
        if (!cancelled) setOrders(res.orders);
      } catch {
        // network hiccup - keep showing the last known queue, next poll will retry
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  async function complete(orderId: number) {
    setCompletingIds((prev) => new Set(prev).add(orderId));
    try {
      await api.updateOrderStatus(orderId, "COMPLETED");
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } finally {
      setCompletingIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  }

  return (
    <div className="flex-1 bg-zinc-50 p-6 dark:bg-black">
      <h1 className="mb-6 text-2xl font-semibold">Kitchen Queue</h1>
      {orders.length === 0 && <p className="text-zinc-500">No orders in the queue.</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {orders.map((order) => (
          <div
            key={order.id}
            className="flex flex-col rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-900"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Order #{order.id}</h2>
              <span className="text-sm text-zinc-500">
                {new Date(order.created_at).toLocaleTimeString()}
              </span>
            </div>
            <ul className="mb-4 flex-1 space-y-1">
              {order.items.map((item, i) => (
                <li key={i}>
                  <span className="font-medium">{item.qty}x</span> {item.name}
                  {item.modifiers.map((m, j) => (
                    <div key={j} className="pl-4 text-sm text-zinc-500">+ {m.name}</div>
                  ))}
                  {item.notes && <div className="text-sm text-zinc-500">note: {item.notes}</div>}
                </li>
              ))}
            </ul>
            <button
              onClick={() => complete(order.id)}
              disabled={completingIds.has(order.id)}
              className="rounded-full bg-foreground py-2 font-medium text-background disabled:opacity-40"
            >
              Complete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
