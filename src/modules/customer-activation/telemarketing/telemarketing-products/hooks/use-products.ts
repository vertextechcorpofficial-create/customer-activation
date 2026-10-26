"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Product, ProductCreate, ProductUpdate } from "../types/product.schema";
import {
    createProduct as apiCreateProduct,
    getProducts,
    setProductActive as apiSetProductActive,
    updateProduct as apiUpdateProduct,
} from "../providers/product-provider";

function toMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Something went wrong";
}

export function useProducts() {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /** Background reload after a write: keeps the last good list if it fails. */
    const sync = useCallback(async () => {
        try {
            setProducts(await getProducts());
            setError(null);
        } catch {
            // the write already succeeded — keep the list we have
        }
    }, []);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setProducts(await getProducts());
        } catch (err) {
            setError(toMessage(err));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const createProduct = useCallback(
        async (input: ProductCreate): Promise<boolean> => {
            try {
                await apiCreateProduct(input);
                toast.success("Product created");
                await sync();
                return true;
            } catch (err) {
                toast.error("Failed to create product", { description: toMessage(err) });
                return false;
            }
        },
        [sync],
    );

    const updateProduct = useCallback(
        async (productId: number, input: ProductUpdate): Promise<boolean> => {
            try {
                await apiUpdateProduct(productId, input);
                toast.success("Product updated");
                await sync();
                return true;
            } catch (err) {
                toast.error("Failed to update product", { description: toMessage(err) });
                return false;
            }
        },
        [sync],
    );

    const setProductActive = useCallback(
        async (productId: number, isActive: boolean): Promise<boolean> => {
            try {
                await apiSetProductActive(productId, isActive);
                toast.success(isActive ? "Product activated" : "Product deactivated");
                await sync();
                return true;
            } catch (err) {
                toast.error(isActive ? "Failed to activate product" : "Failed to deactivate product", {
                    description: toMessage(err),
                });
                return false;
            }
        },
        [sync],
    );

    return { products, isLoading, error, refresh, createProduct, updateProduct, setProductActive };
}
