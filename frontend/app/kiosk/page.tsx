"use client";

import { useEffect, useMemo, useState } from "react";
import { loadStripeTerminal } from "@stripe/terminal-js/pure";
import { api, type MenuItem, type Order } from "@/lib/api";

type CartEntry = { item: MenuItem; qty: number };
type Phase = "menu" | "connecting" | "processing" | "success" | "error";

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function KioskPage() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [phase, setPhase] = useState<Phase>("menu");
  const [errorMessage, setErrorMessage] = useState("");
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  useEffect(() => {
    api.getMenu().then((res) => setMenu(res.items));
  }, []);

  const categories = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of menu) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    }
    return [...map.entries()];
  }, [menu]);

  const total = cart.reduce((sum, entry) => sum + entry.item.price_cents * entry.qty, 0);

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((e) => e.item.id === item.id);
      if (existing) {
        return prev.map((e) => (e.item.id === item.id ? { ...e, qty: e.qty + 1 } : e));
      }
      return [...prev, { item, qty: 1 }];
    });
  }

  function changeQty(itemId: number, delta: number) {
    setCart((prev) =>
      prev
        .map((e) => (e.item.id === itemId ? { ...e, qty: e.qty + delta } : e))
        .filter((e) => e.qty > 0)
    );
  }

  function startOver() {
    setCart([]);
    setPhase("menu");
    setErrorMessage("");
    setCompletedOrder(null);
  }

  async function checkout() {
    setPhase("connecting");
    setErrorMessage("");
    try {
      const order = await api.createOrder(
        cart.map((e) => ({ menu_item_id: e.item.id, qty: e.qty }))
      );

      const StripeTerminal = await loadStripeTerminal();
      if (!StripeTerminal) throw new Error("Stripe Terminal SDK failed to load");

      const terminal = StripeTerminal.create({
        onFetchConnectionToken: async () => (await api.getConnectionToken()).secret,
        onUnexpectedReaderDisconnect: () => setErrorMessage("Reader disconnected unexpectedly"),
      });

      const discovered = await terminal.discoverReaders({ simulated: true });
      if ("error" in discovered) throw new Error(discovered.error.message);
      if (discovered.discoveredReaders.length === 0) throw new Error("No reader found");

      const connected = await terminal.connectReader(discovered.discoveredReaders[0]);
      if ("error" in connected) throw new Error(connected.error.message);

      setPhase("processing");
      const { client_secret } = await api.createPaymentIntent(order.id);

      const collected = await terminal.collectPaymentMethod(client_secret);
      if ("error" in collected) throw new Error(collected.error.message);

      const processed = await terminal.processPayment(collected.paymentIntent);
      if ("error" in processed) throw new Error(processed.error.message);

      setCompletedOrder(order);
      setPhase("success");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Payment failed");
      setPhase("error");
    }
  }

  if (phase === "success" && completedOrder) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 dark:bg-black">
        <h1 className="text-4xl font-semibold">Order #{completedOrder.id}</h1>
        <p className="text-xl text-zinc-600 dark:text-zinc-400">
          {formatPrice(completedOrder.total_cents)} — thank you!
        </p>
        <button
          onClick={startOver}
          className="mt-4 rounded-full bg-foreground px-8 py-3 text-lg font-medium text-background"
        >
          New order
        </button>
      </div>
    );
  }

  if (phase === "connecting" || phase === "processing") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 dark:bg-black">
        <p className="text-2xl">
          {phase === "connecting" ? "Connecting to card reader…" : "Present card on reader…"}
        </p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 dark:bg-black">
        <p className="text-xl text-red-600">Payment failed: {errorMessage}</p>
        <div className="flex gap-4">
          <button
            onClick={() => setPhase("menu")}
            className="rounded-full bg-foreground px-6 py-3 font-medium text-background"
          >
            Try again
          </button>
          <button onClick={startOver} className="rounded-full border border-black/[.08] px-6 py-3 font-medium dark:border-white/[.145]">
            Cancel order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <div className="flex-1 overflow-y-auto p-6">
        {categories.map(([category, items]) => (
          <div key={category} className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">{category}</h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="flex flex-col items-start rounded-xl border border-black/[.08] p-4 text-left hover:bg-black/[.03] dark:border-white/[.145] dark:hover:bg-white/[.05]"
                >
                  <span className="font-medium">{item.name}</span>
                  {item.description && (
                    <span className="mt-1 text-sm text-zinc-500">{item.description}</span>
                  )}
                  <span className="mt-2 font-semibold">{formatPrice(item.price_cents)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex w-full flex-col border-t border-black/[.08] p-6 md:w-96 md:border-l md:border-t-0 dark:border-white/[.145]">
        <h2 className="mb-4 text-xl font-semibold">Your order</h2>
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 && <p className="text-zinc-500">Tap items to add them</p>}
          {cart.map((entry) => (
            <div key={entry.item.id} className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-medium">{entry.item.name}</p>
                <p className="text-sm text-zinc-500">{formatPrice(entry.item.price_cents)} each</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeQty(entry.item.id, -1)}
                  className="h-8 w-8 rounded-full border border-black/[.08] dark:border-white/[.145]"
                >
                  −
                </button>
                <span className="w-6 text-center">{entry.qty}</span>
                <button
                  onClick={() => changeQty(entry.item.id, 1)}
                  className="h-8 w-8 rounded-full border border-black/[.08] dark:border-white/[.145]"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-black/[.08] pt-4 dark:border-white/[.145]">
          <div className="mb-4 flex justify-between text-lg font-semibold">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
          <button
            disabled={cart.length === 0}
            onClick={checkout}
            className="w-full rounded-full bg-foreground py-3 text-lg font-medium text-background disabled:opacity-40"
          >
            Checkout
          </button>
        </div>
      </div>
    </div>
  );
}
