"use client";

import { NewCustomerForm } from "./components/new-customer-form";

/** Entry component for the new-customer lane: manual prospect entry. */
export function NewCustomerModule() {
    return (
        <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-4">
            <NewCustomerForm />
        </div>
    );
}
