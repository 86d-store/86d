"use client";

import { useCallback, useState } from "react";
import { useOrdersApi } from "./_hooks";
import type { OrderItem } from "./_types";
import { extractError } from "./_utils";
import ReturnRequestFormTemplate from "./return-request-form.mdx";

const RETURN_REASONS = [
	{ value: "defective", label: "Defective / not working" },
	{ value: "wrong_item", label: "Wrong item received" },
	{ value: "not_as_described", label: "Not as described" },
	{ value: "changed_mind", label: "Changed my mind" },
	{ value: "too_small", label: "Too small" },
	{ value: "too_large", label: "Too large" },
	{ value: "arrived_late", label: "Arrived too late" },
	{ value: "damaged_in_shipping", label: "Damaged in shipping" },
	{ value: "other", label: "Other" },
];

export function ReturnRequestForm({
	orderId,
	items,
	onSuccess,
	onCancel,
}: {
	orderId: string;
	items: OrderItem[];
	onSuccess: () => void;
	onCancel: () => void;
}) {
	const api = useOrdersApi();
	const [reason, setReason] = useState("");
	const [customerNotes, setCustomerNotes] = useState("");
	const [error, setError] = useState("");
	const [selectedItems, setSelectedItems] = useState<Record<string, number>>(
		() => {
			const m: Record<string, number> = {};
			for (const item of items) {
				m[item.id] = item.quantity;
			}
			return m;
		},
	);

	const toggleItem = useCallback((itemId: string, maxQty: number) => {
		setSelectedItems((prev) => {
			if (prev[itemId] !== undefined) {
				const next = { ...prev };
				delete next[itemId];
				return next;
			}
			return { ...prev, [itemId]: maxQty };
		});
	}, []);

	const setItemQty = useCallback((itemId: string, qty: number) => {
		setSelectedItems((prev) => ({ ...prev, [itemId]: qty }));
	}, []);

	const createMutation = api.createReturn.useMutation({
		onSuccess: () => {
			onSuccess();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to submit return request."));
		},
	});

	const itemEntries = Object.entries(selectedItems).filter(
		([, qty]) => qty > 0,
	);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!reason) {
			setError("Please select a reason for the return.");
			return;
		}
		if (itemEntries.length === 0) {
			setError("Select at least one item to return.");
			return;
		}
		setError("");
		createMutation.mutate({
			params: { id: orderId },
			body: {
				reason,
				customerNotes: customerNotes || undefined,
				items: itemEntries.map(([orderItemId, quantity]) => ({
					orderItemId,
					quantity,
				})),
			},
		});
	};

	const itemChecklistContent = (
		<div className="space-y-2 rounded-xl border border-border p-3">
			{items.map((item) => {
				const checked = selectedItems[item.id] !== undefined;
				return (
					<div key={item.id} className="flex items-center gap-3">
						<input
							type="checkbox"
							checked={checked}
							onChange={() => toggleItem(item.id, item.quantity)}
							className="size-4 rounded border-border"
						/>
						<div className="min-w-0 flex-1">
							<p className="truncate text-foreground text-sm">{item.name}</p>
						</div>
						{checked && (
							<input
								type="number"
								min={1}
								max={item.quantity}
								value={selectedItems[item.id] ?? 1}
								onChange={(e) =>
									setItemQty(
										item.id,
										Math.min(
											item.quantity,
											Math.max(1, Number.parseInt(e.target.value, 10) || 1),
										),
									)
								}
								className="h-8 w-16 rounded border border-border bg-background px-2 text-center text-sm"
							/>
						)}
						<span className="text-muted-foreground text-xs">
							/ {item.quantity}
						</span>
					</div>
				);
			})}
		</div>
	);

	const reasonOptions = RETURN_REASONS.map((r) => (
		<option key={r.value} value={r.value}>
			{r.label}
		</option>
	));

	return (
		<ReturnRequestFormTemplate
			onSubmit={handleSubmit}
			itemChecklistContent={itemChecklistContent}
			reason={reason}
			onReasonChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
				setReason(e.target.value)
			}
			reasonOptions={reasonOptions}
			customerNotes={customerNotes}
			onNotesChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
				setCustomerNotes(e.target.value)
			}
			error={error || null}
			submitDisabled={
				createMutation.isPending || !reason || itemEntries.length === 0
			}
			submitPending={createMutation.isPending}
			onCancel={onCancel}
		/>
	);
}
