import type { AssignmentStatus } from "./asset-tagging-remarks.schema";

export interface AssignmentView {
    id: number;
    customer_id: number;
    customer_name: string;
    customer_code: string | null;
    item_id: number;
    item_code: string;
    item_name: string;
    quantity: number;
    returned_quantity: number;
    remaining: number;
    remarks: string | null;
    tagged_at: string;
    expected_return_at: string | null;
    closed_at: string | null;
    condition_out: string | null;
    condition_in: string | null;
    return_remarks: string | null;
    assignment_status: AssignmentStatus;
    overdue: boolean;
}

export interface AvailableItem {
    id: number;
    item_code: string;
    name: string;
    quantity: number;
    quantity_available: number;
}

export interface CustomerOption {
    id: number;
    customer_code: string | null;
    customer_name: string;
}
