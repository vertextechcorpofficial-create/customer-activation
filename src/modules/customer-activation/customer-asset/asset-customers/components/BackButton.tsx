"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

export function BackButton({ fallbackHref }: { fallbackHref: string }) {
    const router = useRouter();

    const goBack = () => {
        if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
        } else {
            router.push(fallbackHref);
        }
    };

    return (
        <Button variant="outline" size="sm" onClick={goBack} aria-label="Go back">
            <ArrowLeft className="size-4" aria-hidden />
            Back
        </Button>
    );
}
