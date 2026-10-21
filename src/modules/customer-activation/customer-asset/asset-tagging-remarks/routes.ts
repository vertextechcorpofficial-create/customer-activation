const BASE = "/api/customer-activation/customer-asset/asset-tagging-remarks";

export const assetTaggingRemarksRoutes = {
    taggings: BASE,
    tagging: (id: number) => `${BASE}/${id}`,
} as const;
