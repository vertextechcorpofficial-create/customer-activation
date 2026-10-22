const BASE = "/api/customer-activation/customer-asset/asset-reports";

export const assetReportsRoutes = {
    lastPurchase: BASE + "/last-purchase",
    customerAssets: BASE + "/customer-assets",
    valuation: BASE + "/valuation",
    report: BASE + "/report",
    detail: (id: number) => `${BASE}/${id}`,
} as const;
