const BASE = "/api/customer-activation/customer-asset/asset-customers";

export const assetCustomersRoutes = {
    customers: BASE,
    holdings: BASE + "/holdings",
    notes: BASE + "/notes",
    note: (id: number) => `${BASE}/notes/${id}`,
} as const;
