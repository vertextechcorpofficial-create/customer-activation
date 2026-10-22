const BASE = "/api/customer-activation/customer-asset/asset-registration";

export const assetRegistrationRoutes = {
    items: BASE,
    item: (id: number) => `${BASE}/${id}`,
    itemTags: (id: number) => `${BASE}/${id}/tags`,
    itemHistory: (id: number) => `${BASE}/${id}/history`,
    catalogs: `${BASE}/catalogs`,
    groupCatalog: "/api/customer-activation/customer-asset/asset-groups",
    tagCatalog: "/api/customer-activation/customer-asset/asset-tags",
} as const;
