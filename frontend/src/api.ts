export interface Product {
  id: number;
  name: string;
  buy_price: number;
  target_percent: number;
  sold_price: number | null;
}

export interface User { id: number; username: string; email: string }

const token = () => localStorage.getItem("token");

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    },
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Algo deu errado.");
  return data as T;
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  register: (b: { username: string; email: string; password: string }) =>
    request<{ token: string; user: User }>("/auth/register", { method: "POST", body: json(b) }),
  login: (b: { login: string; password: string }) =>
    request<{ token: string; user: User }>("/auth/login", { method: "POST", body: json(b) }),
  list: () => request<Product[]>("/products"),
  create: (b: { name: string; buy_price: number; target_percent: number }) =>
    request<Product>("/products", { method: "POST", body: json(b) }),
  update: (id: number, b: { name: string; buy_price: number; target_percent: number; sold_price?: number }) =>
    request<Product>(`/products/${id}`, { method: "PATCH", body: json(b) }),
  sell: (id: number, sold_price: number) =>
    request<Product>(`/products/${id}/sell`, { method: "PATCH", body: json({ sold_price }) }),
  unsell: (id: number) => request<Product>(`/products/${id}/unsell`, { method: "PATCH" }),
  remove: (id: number) => request<void>(`/products/${id}`, { method: "DELETE" }),
};
