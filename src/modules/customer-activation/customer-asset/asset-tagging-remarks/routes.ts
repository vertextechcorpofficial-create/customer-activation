const BASE = "/api/customer-activation/customer-asset/asset-tagging-remarks";

export const assetTaggingRemarksRoutes = {
    taggings: BASE,
    tagging: (id: number) => `${BASE}/${id}`,
    customers: `${BASE}/customers`,
    items: `${BASE}/items`,
} as const;
