"use client";

import { useState } from "react";
import { Plus, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SourceRow } from "../types/lead.schema";
import { useLeads } from "../hooks/use-leads";
import { useSources } from "../hooks/use-sources";
import { CreateLeadDialog, type LeadPrefill } from "./create-lead-dialog";

function toPrefill(row: SourceRow): LeadPrefill {
    return {
        company_name: row.name,
        mobile: row.contact,
        email: row.email,
        address: [row.city, row.province].filter(Boolean).join(", ") || null,
        source: row.source,
        party_kind: row.party_kind,
        party_id: row.party_id,
    };
}

function SourceTable({
    rows,
    isLoading,
    emptyTitle,
    emptyHint,
    onCreate,
}: {
    rows: SourceRow[];
    isLoading: boolean;
    emptyTitle: string;
    emptyHint: string;
    onCreate: (row: SourceRow) => void;
}) {
    if (isLoading) {
        return (
            <div className="grid gap-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
            </div>
        );
    }
    if (rows.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Users className="size-5" />
                    </EmptyMedia>
                    <EmptyTitle>{emptyTitle}</EmptyTitle>
                    <EmptyDescription>{emptyHint}</EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead className="hidden md:table-cell">Location</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={`${row.source}-${row.id}`}>
                            <TableCell className="max-w-[180px] truncate font-medium">
                                {row.name}
                            </TableCell>
                            <TableCell className="max-w-[160px] truncate text-muted-foreground">
                                {row.contact ?? row.email ?? "—"}
                            </TableCell>
                            <TableCell className="hidden max-w-[140px] truncate text-muted-foreground md:table-cell">
                                {[row.city, row.province].filter(Boolean).join(", ") || "—"}
                            </TableCell>
                            <TableCell className="text-right">
                                <Button size="sm" variant="ghost" onClick={() => onCreate(row)}>
                                    <Plus className="size-4" aria-hidden />
                                    Create lead
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

export function LeadGenerationTabs() {
    const [search, setSearch] = useState("");
    const [prefill, setPrefill] = useState<LeadPrefill | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const { customerRows, prospectingRows, clientRows, isLoading } = useSources(search);
    const { items: recent, isLoading: recentLoading, refresh: refreshLeads } = useLeads({ limit: 10 });

    function openFor(row: SourceRow) {
        setPrefill(toPrefill(row));
        setDialogOpen(true);
    }

    function openBlank(source: LeadPrefill["source"]) {
        setPrefill({ company_name: "", source, party_kind: "none", party_id: null });
        setDialogOpen(true);
    }

    return (
        <div className="grid gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name, code, contact…"
                        className="pl-8"
                    />
                </div>
            </div>

            <Tabs defaultValue="customer-db">
                <TabsList>
                    <TabsTrigger value="customer-db" className="min-h-11 md:min-h-0">
                        Customer DB
                    </TabsTrigger>
                    <TabsTrigger value="prospecting" className="min-h-11 md:min-h-0">
                        Prospecting
                    </TabsTrigger>
                    <TabsTrigger value="client-db" className="min-h-11 md:min-h-0">
                        Client DB
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="customer-db" className="grid gap-2">
                    <SourceTable
                        rows={customerRows}
                        isLoading={isLoading}
                        emptyTitle="No customers found"
                        emptyHint="Try another search term."
                        onCreate={openFor}
                    />
                </TabsContent>
                <TabsContent value="prospecting" className="grid gap-2">
                    <div className="flex justify-end">
                        <Button size="sm" onClick={() => openBlank("prospecting")}>
                            <Plus className="size-4" />
                            Add prospect
                        </Button>
                    </div>
                    <SourceTable
                        rows={prospectingRows}
                        isLoading={isLoading}
                        emptyTitle="No prospects yet"
                        emptyHint="Add prospect manually to create the first one."
                        onCreate={openFor}
                    />
                </TabsContent>
                <TabsContent value="client-db" className="grid gap-2">
                    <SourceTable
                        rows={clientRows}
                        isLoading={isLoading}
                        emptyTitle="No clients found"
                        emptyHint="Try another search term."
                        onCreate={openFor}
                    />
                </TabsContent>
            </Tabs>

            <section className="grid gap-2 rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Recent leads</h2>
                    <Button size="sm" variant="ghost" onClick={() => openBlank("prospecting")}>
                        <Plus className="size-4" />
                        New lead
                    </Button>
                </div>
                {recentLoading ? (
                    <div className="grid gap-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                    </div>
                ) : recent.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No leads yet — create one from a source above.</p>
                ) : (
                    <ul className="divide-y divide-border">
                        {recent.map((lead) => (
                            <li key={lead.lead_id} className="flex items-center gap-2 py-2 text-sm">
                                <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">
                                    {lead.lead_code}
                                </span>
                                <span className="min-w-0 flex-1 truncate font-medium">{lead.company_name}</span>
                                <StatusBadge tone="info" className="hidden sm:inline-flex">
                                    {lead.source}
                                </StatusBadge>
                                <StatusBadge tone="neutral">Stage {lead.stage_id}</StatusBadge>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <CreateLeadDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                prefill={prefill}
                onCreated={() => void refreshLeads()}
            />
        </div>
    );
}
