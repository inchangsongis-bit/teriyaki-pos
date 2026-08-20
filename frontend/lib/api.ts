const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8001";

export type Modifier = {
  id: number;
  name: string;
  price_cents: number;
};

export type ModifierGroup = {
  id: number;
  name: string;
  min_select: number;
  max_select: number | null;
  modifiers: Modifier[];
};

export type MenuItem = {
  id: number;
  name: string;
  description: string | null;
  price_cents: number;
  category: string;
  image_url: string | null;
  is_available: boolean;
  unavailable_reason: string | null;
  modifier_groups: ModifierGroup[];
};

export type OrderItem = {
  name: string;
  qty: number;
  price_cents: number;
  notes: string | null;
  modifiers: { name: string; price_cents: number }[];
};

export type Order = {
  id: number;
  status: "PENDING" | "PAID" | "PRINTED" | "COMPLETED" | "CANCELLED";
  total_cents: number;
  created_at: string;
  items: OrderItem[];
};

export type CartLine = { menu_item_id: number; qty: number; notes?: string; modifier_ids?: number[] };

export type StaffAlert = {
  id: number;
  location: string;
  message: string | null;
  status: "OPEN" | "RESOLVED";
  created_at: string;
  resolved_at: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${init?.method ?? "GET"} ${path} failed: ${res.status} ${body}`);
  }
  return res.json();
}

export const api = {
  getMenu: () => request<{ items: MenuItem[] }>("/api/menu/"),

  createOrder: (items: CartLine[]) =>
    request<Order>("/api/orders/", { method: "POST", body: JSON.stringify({ items }) }),

  getOrders: (status?: string) =>
    request<{ orders: Order[] }>(`/api/orders/${status ? `?status=${status}` : ""}`),

  updateOrderStatus: (orderId: number, status: Order["status"]) =>
    request<Order>(`/api/orders/${orderId}`, { method: "PATCH", body: JSON.stringify({ status }) }),

  getConnectionToken: () =>
    request<{ secret: string }>("/api/payments/connection-token", { method: "POST" }),

  createPaymentIntent: (orderId: number) =>
    request<{ client_secret: string }>(`/api/orders/${orderId}/payment-intent`, { method: "POST" }),

  setMenuItemAvailability: (itemId: number, is_available: boolean, reason?: string) =>
    request<MenuItem>(`/api/menu/${itemId}/availability`, {
      method: "PATCH",
      body: JSON.stringify({ is_available, reason }),
    }),

  callStaff: (location: string, message?: string) =>
    request<StaffAlert>("/api/alerts/", { method: "POST", body: JSON.stringify({ location, message }) }),

  getAlerts: (status?: string) =>
    request<{ alerts: StaffAlert[] }>(`/api/alerts/${status ? `?status=${status}` : ""}`),

  resolveAlert: (alertId: number) =>
    request<StaffAlert>(`/api/alerts/${alertId}`, { method: "PATCH", body: JSON.stringify({ status: "RESOLVED" }) }),
};
