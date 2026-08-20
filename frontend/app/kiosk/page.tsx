"use client";

import { useEffect, useMemo, useState } from "react";
import { loadStripeTerminal } from "@stripe/terminal-js/pure";
import { api, type MenuItem, type Modifier, type Order } from "@/lib/api";

type CartEntry = {
  lineId: string;
  item: MenuItem;
  qty: number;
  selectedModifiers: Modifier[];
  notes?: string;
};
type Phase = "menu" | "connecting" | "processing" | "success" | "error";

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function unitPrice(item: MenuItem, modifiers: Modifier[]) {
  return item.price_cents + modifiers.reduce((sum, m) => sum + m.price_cents, 0);
}

export default function KioskPage() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [phase, setPhase] = useState<Phase>("menu");
  const [errorMessage, setErrorMessage] = useState("");
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);
  const [modalSelectedIds, setModalSelectedIds] = useState<Set<number>>(new Set());
  const [modalQty, setModalQty] = useState(1);
  const [modalNotes, setModalNotes] = useState("");
  const [callStaffState, setCallStaffState] = useState<"idle" | "sending" | "sent">("idle");

  async function callStaff() {
    if (callStaffState !== "idle") return;
    setCallStaffState("sending");
    try {
      await api.callStaff("Kiosk");
      setCallStaffState("sent");
      setTimeout(() => setCallStaffState("idle"), 15000);
    } catch {
      setCallStaffState("idle");
    }
  }

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

  const total = cart.reduce(
    (sum, entry) => sum + unitPrice(entry.item, entry.selectedModifiers) * entry.qty,
    0
  );

  function openItem(item: MenuItem) {
    setModalItem(item);
    setModalSelectedIds(new Set());
    setModalQty(1);
    setModalNotes("");
  }

  function toggleModifier(modifier: Modifier, groupMax: number | null, groupModifierIds: number[]) {
    setModalSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(modifier.id)) {
        next.delete(modifier.id);
        return next;
      }
      if (groupMax !== null) {
        const selectedInGroup = groupModifierIds.filter((id) => next.has(id)).length;
        if (selectedInGroup >= groupMax) return prev; // at cap, ignore
      }
      next.add(modifier.id);
      return next;
    });
  }

  function addModalItemToCart() {
    if (!modalItem) return;
    const selectedModifiers = modalItem.modifier_groups
      .flatMap((g) => g.modifiers)
      .filter((m) => modalSelectedIds.has(m.id));

    setCart((prev) => [
      ...prev,
      {
        lineId: crypto.randomUUID(),
        item: modalItem,
        qty: modalQty,
        selectedModifiers,
        notes: modalNotes.trim() || undefined,
      },
    ]);
    setModalItem(null);
  }

  function changeLineQty(lineId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((e) => (e.lineId === lineId ? { ...e, qty: e.qty + delta } : e))
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
        cart.map((e) => ({
          menu_item_id: e.item.id,
          qty: e.qty,
          modifier_ids: e.selectedModifiers.map((m) => m.id),
          notes: e.notes,
        }))
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

  const modalUnitPrice = modalItem
    ? unitPrice(
        modalItem,
        modalItem.modifier_groups.flatMap((g) => g.modifiers).filter((m) => modalSelectedIds.has(m.id))
      )
    : 0;

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <button
        onClick={callStaff}
        disabled={callStaffState !== "idle"}
        className="fixed bottom-4 right-4 z-40 rounded-full bg-red-600 px-5 py-3 text-sm font-medium text-white shadow-lg disabled:opacity-70"
      >
        {callStaffState === "sent" ? "Staff notified ✓" : callStaffState === "sending" ? "Calling…" : "Call staff"}
      </button>
      <div className="flex-1 overflow-y-auto p-6">
        {categories.map(([category, items]) => (
          <div key={category} className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">{category}</h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => item.is_available && openItem(item)}
                  disabled={!item.is_available}
                  className="flex flex-col items-start rounded-xl border border-black/[.08] p-4 text-left hover:bg-black/[.03] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:border-white/[.145] dark:hover:bg-white/[.05]"
                >
                  <span className="font-medium">{item.name}</span>
                  {item.description && (
                    <span className="mt-1 text-sm text-zinc-500">{item.description}</span>
                  )}
                  <span className="mt-2 font-semibold">{formatPrice(item.price_cents)}</span>
                  {!item.is_available && (
                    <span className="mt-1 text-sm font-medium text-red-600">
                      {item.unavailable_reason || "Sold Out"}
                    </span>
                  )}
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
            <div key={entry.lineId} className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-medium">{entry.item.name}</p>
                {entry.selectedModifiers.map((m) => (
                  <p key={m.id} className="text-sm text-zinc-500">
                    + {m.name}
                    {m.price_cents > 0 ? ` (${formatPrice(m.price_cents)})` : ""}
                  </p>
                ))}
                <p className="text-sm text-zinc-500">
                  {formatPrice(unitPrice(entry.item, entry.selectedModifiers))} each
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeLineQty(entry.lineId, -1)}
                  className="h-8 w-8 rounded-full border border-black/[.08] dark:border-white/[.145]"
                >
                  −
                </button>
                <span className="w-6 text-center">{entry.qty}</span>
                <button
                  onClick={() => changeLineQty(entry.lineId, 1)}
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

      {modalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-background p-6">
            <h2 className="text-xl font-semibold">{modalItem.name}</h2>
            {modalItem.description && (
              <p className="mt-1 text-sm text-zinc-500">{modalItem.description}</p>
            )}

            {modalItem.modifier_groups.map((group) => {
              const groupModifierIds = group.modifiers.map((m) => m.id);
              return (
                <div key={group.id} className="mt-4">
                  <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                    {group.name}
                  </p>
                  {group.modifiers.map((m) => (
                    <label key={m.id} className="mb-1 flex items-center justify-between py-1">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={modalSelectedIds.has(m.id)}
                          onChange={() => toggleModifier(m, group.max_select, groupModifierIds)}
                        />
                        {m.name}
                      </span>
                      <span className="text-sm text-zinc-500">
                        {m.price_cents > 0 ? `+${formatPrice(m.price_cents)}` : "+$0.00"}
                      </span>
                    </label>
                  ))}
                </div>
              );
            })}

            <div className="mt-4">
              <label className="mb-1 block text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Special instructions
              </label>
              <textarea
                value={modalNotes}
                onChange={(e) => setModalNotes(e.target.value)}
                className="w-full rounded-lg border border-black/[.08] p-2 text-sm dark:border-white/[.145]"
                rows={2}
              />
            </div>

            <div className="mt-4 flex items-center justify-center gap-4">
              <button
                onClick={() => setModalQty((q) => Math.max(1, q - 1))}
                className="h-9 w-9 rounded-full border border-black/[.08] dark:border-white/[.145]"
              >
                −
              </button>
              <span className="w-6 text-center">{modalQty}</span>
              <button
                onClick={() => setModalQty((q) => q + 1)}
                className="h-9 w-9 rounded-full border border-black/[.08] dark:border-white/[.145]"
              >
                +
              </button>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setModalItem(null)}
                className="rounded-full border border-black/[.08] px-6 py-3 font-medium dark:border-white/[.145]"
              >
                Cancel
              </button>
              <button
                onClick={addModalItemToCart}
                className="flex-1 rounded-full bg-foreground py-3 font-medium text-background"
              >
                Add to order — {formatPrice(modalUnitPrice * modalQty)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
