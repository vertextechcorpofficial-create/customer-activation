const BASE = "/api/customer-activation/customer-asset/asset-groups";

export const assetGroupsRoutes = {
    groups: BASE,
    group: (id: number) => `${BASE}/${id}`,
} as const;
