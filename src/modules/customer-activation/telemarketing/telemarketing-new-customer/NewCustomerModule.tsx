"use client";

import { useState } from "react";
import { NewCustomerForm } from "./components/new-customer-form";
import { ProspectTable } from "./components/prospect-table";

/** Entry component for the new-customer lane: manual entry plus recent list. */
export function NewCustomerModule() {
    const [refreshKey, setRefreshKey] = useState(0);

    return (
        <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-4">
            <NewCustomerForm onCreated={() => setRefreshKey((key) => key + 1)} />
            <ProspectTable refreshKey={refreshKey} />
        </div>
    );
}
