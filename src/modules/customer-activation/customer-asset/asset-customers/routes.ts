const BASE = "/api/customer-activation/customer-asset/asset-customers";

export const assetCustomersRoutes = {
    customers: BASE,
    customer: (id: number) => `${BASE}/${id}`,
    holdings: BASE + "/holdings",
    notes: BASE + "/notes",
    note: (id: number) => `${BASE}/notes/${id}`,
} as const;
