const BASE = "/api/customer-activation/customer-asset/asset-reports";

export const assetReportsRoutes = {
    lastPurchase: BASE + "/last-purchase",
    customerAssets: BASE + "/customer-assets",
    valuation: BASE + "/valuation",
} as const;
