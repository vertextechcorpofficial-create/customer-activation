const BASE = "/api/customer-activation/customer-asset/asset-tags";

export const assetTagsRoutes = {
    tags: BASE,
    tag: (id: number) => `${BASE}/${id}`,
} as const;
