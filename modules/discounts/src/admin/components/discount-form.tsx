"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useState } from "react";
import DiscountFormTemplate from "./discount-form.mdx";

interface Discount {
	id: string;
	name: string;
	description?: string;
	type: "percentage" | "fixed_amount" | "free_shipping";
	value: number;
	minimumAmount?: number | null;
	maximumUses?: number | null;
	isActive: boolean;
	startsAt?: string | null;
	endsAt?: string | null;
	appliesTo: "all" | "specific_products" | "specific_categories";
	appliesToIds?: string[];
	stackable: boolean;
}

function extractError(error: Error | null, fallback: string): string {
	if (!error) return fallback;
	const body = (
		error as Error & { body?: { error?: string | { message?: string } } }
	).body;
	if (typeof body?.error === "string") return body.error;
	if (typeof body?.error?.message === "string") return body.error.message;
	return fallback;
}

function toDateInputValue(iso: string | null | undefined): string {
	if (!iso) return "";
	const d = new Date(iso);
	return d.toISOString().slice(0, 16);
}

function useDiscountsAdminApi() {
	const client = useModuleClient();
	return {
		getDiscount: client.module("discounts").admin["/admin/discounts/:id"],
		createDiscount: client.module("discounts").admin["/admin/discounts/create"],
		updateDiscount:
			client.module("discounts").admin["/admin/discounts/:id/update"],
		listDiscounts: client.module("discounts").admin["/admin/discounts"],
	};
}

export function DiscountForm(props: {
	discountId?: string | undefined;
	params?: Record<string, string>;
}) {
	const discountId = props.discountId ?? props.params?.id;
	const api = useDiscountsAdminApi();
	const isEdit = !!discountId;

	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [type, setType] = useState<Discount["type"]>("percentage");
	const [value, setValue] = useState("");
	const [minimumAmount, setMinimumAmount] = useState("");
	const [maximumUses, setMaximumUses] = useState("");
	const [isActive, setIsActive] = useState(true);
	const [startsAt, setStartsAt] = useState("");
	const [endsAt, setEndsAt] = useState("");
	const [appliesTo, setAppliesTo] = useState<Discount["appliesTo"]>("all");
	const [stackable, setStackable] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);

	const { data: discountData, isLoading: loadingDiscount } =
		api.getDiscount.useQuery(
			discountId ? { params: { id: discountId } } : undefined,
			{ enabled: isEdit },
		) as {
			data: { discount: Discount } | undefined;
			isLoading: boolean;
		};

	useEffect(() => {
		if (discountData?.discount) {
			const d = discountData.discount;
			setName(d.name);
			setDescription(d.description ?? "");
			setType(d.type);
			setValue(
				d.type === "fixed_amount" ? String(d.value / 100) : String(d.value),
			);
			setMinimumAmount(
				d.minimumAmount != null ? String(d.minimumAmount / 100) : "",
			);
			setMaximumUses(d.maximumUses != null ? String(d.maximumUses) : "");
			setIsActive(d.isActive);
			setStartsAt(toDateInputValue(d.startsAt));
			setEndsAt(toDateInputValue(d.endsAt));
			setAppliesTo(d.appliesTo);
			setStackable(d.stackable);
		}
	}, [discountData]);

	const createMutation = api.createDiscount.useMutation({
		onSettled: () => {
			void api.listDiscounts.invalidate();
		},
		onSuccess: () => {
			setSuccess(true);
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to create discount."));
		},
	});

	const updateMutation = api.updateDiscount.useMutation({
		onSettled: () => {
			void api.listDiscounts.invalidate();
			void api.getDiscount.invalidate();
		},
		onSuccess: () => {
			setSuccess(true);
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to update discount."));
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setSuccess(false);

		if (!name.trim()) {
			setError("Name is required.");
			return;
		}

		const numValue = Number.parseFloat(value);
		if (Number.isNaN(numValue) || numValue < 0) {
			setError("Enter a valid value.");
			return;
		}

		if (type === "percentage" && numValue > 100) {
			setError("Percentage cannot exceed 100.");
			return;
		}

		const payload: Record<string, unknown> = {
			name: name.trim(),
			type,
			value: type === "fixed_amount" ? Math.round(numValue * 100) : numValue,
			isActive,
			appliesTo,
			stackable,
		};

		if (description.trim()) payload.description = description.trim();

		if (minimumAmount) {
			const min = Number.parseFloat(minimumAmount);
			if (!Number.isNaN(min)) payload.minimumAmount = Math.round(min * 100);
		} else if (isEdit) {
			payload.minimumAmount = null;
		}

		if (maximumUses) {
			const max = Number.parseInt(maximumUses, 10);
			if (!Number.isNaN(max)) payload.maximumUses = max;
		} else if (isEdit) {
			payload.maximumUses = null;
		}

		if (startsAt) {
			payload.startsAt = new Date(startsAt).toISOString();
		} else if (isEdit) {
			payload.startsAt = null;
		}

		if (endsAt) {
			payload.endsAt = new Date(endsAt).toISOString();
		} else if (isEdit) {
			payload.endsAt = null;
		}

		if (isEdit && discountId) {
			updateMutation.mutate({ params: { id: discountId }, ...payload });
		} else {
			createMutation.mutate(payload);
		}
	};

	const isPending = createMutation.isPending || updateMutation.isPending;

	const title = isEdit ? "Edit Discount" : "New Discount";

	const formContent =
		isEdit && loadingDiscount ? (
			<div className="space-y-4">
				{[1, 2, 3, 4].map((_i) => (
					<div key={key} className="space-y-1.5">
						<div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
						<div className="h-9 w-full animate-pulse rounded-md bg-muted" />
					</div>
				))}
			</div>
		) : success ? (
			<div className="space-y-4">
				<div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 text-sm dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
					Discount {isEdit ? "updated" : "created"} successfully.
				</div>
				<a
					href="/admin/discounts"
					className="inline-flex rounded-md border border-border px-3 py-1.5 font-medium text-foreground text-sm hover:bg-muted"
				>
					Back to discounts
				</a>
			</div>
		) : (
			<form onSubmit={handleSubmit} className="space-y-6">
				{error && (
					<div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
						{error}
					</div>
				)}

				{/* Name + Description */}
				<div className="rounded-lg border border-border bg-card p-5">
					<h3 className="mb-4 font-semibold text-foreground text-sm">
						Details
					</h3>
					<div className="space-y-4">
						<label className="block">
							<span className="mb-1.5 block font-medium text-muted-foreground text-sm">
								Name *
							</span>
							<input
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Summer Sale 20% Off"
								maxLength={200}
								required
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
							/>
						</label>
						<label className="block">
							<span className="mb-1.5 block font-medium text-muted-foreground text-sm">
								Description
							</span>
							<textarea
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								rows={2}
								maxLength={2000}
								placeholder="Internal description for this discount..."
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
							/>
						</label>
					</div>
				</div>

				{/* Type + Value */}
				<div className="rounded-lg border border-border bg-card p-5">
					<h3 className="mb-4 font-semibold text-foreground text-sm">
						Discount Value
					</h3>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<label className="block">
							<span className="mb-1.5 block font-medium text-muted-foreground text-sm">
								Type *
							</span>
							<select
								value={type}
								onChange={(e) => setType(e.target.value as Discount["type"])}
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
							>
								<option value="percentage">Percentage</option>
								<option value="fixed_amount">Fixed Amount</option>
								<option value="free_shipping">Free Shipping</option>
							</select>
						</label>
						{type !== "free_shipping" && (
							<label className="block">
								<span className="mb-1.5 block font-medium text-muted-foreground text-sm">
									{type === "percentage" ? "Percentage *" : "Amount (USD) *"}
								</span>
								<div className="relative">
									{type === "fixed_amount" && (
										<span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground text-sm">
											$
										</span>
									)}
									<input
										type="number"
										step={type === "percentage" ? "1" : "0.01"}
										min="0"
										max={type === "percentage" ? "100" : undefined}
										value={value}
										onChange={(e) => setValue(e.target.value)}
										placeholder={type === "percentage" ? "20" : "10.00"}
										required
										className={`w-full rounded-md border border-border bg-background py-2 pr-3 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring ${type === "fixed_amount" ? "pl-7" : "px-3"}`}
									/>
									{type === "percentage" && (
										<span className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground text-sm">
											%
										</span>
									)}
								</div>
							</label>
						)}
					</div>
				</div>

				{/* Conditions */}
				<div className="rounded-lg border border-border bg-card p-5">
					<h3 className="mb-4 font-semibold text-foreground text-sm">
						Conditions
					</h3>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<label className="block">
							<span className="mb-1.5 block font-medium text-muted-foreground text-sm">
								Minimum order amount (USD)
							</span>
							<div className="relative">
								<span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground text-sm">
									$
								</span>
								<input
									type="number"
									step="0.01"
									min="0"
									value={minimumAmount}
									onChange={(e) => setMinimumAmount(e.target.value)}
									placeholder="No minimum"
									className="w-full rounded-md border border-border bg-background py-2 pr-3 pl-7 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
								/>
							</div>
						</label>
						<label className="block">
							<span className="mb-1.5 block font-medium text-muted-foreground text-sm">
								Maximum uses
							</span>
							<input
								type="number"
								min="1"
								step="1"
								value={maximumUses}
								onChange={(e) => setMaximumUses(e.target.value)}
								placeholder="Unlimited"
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
							/>
						</label>
						<label className="block">
							<span className="mb-1.5 block font-medium text-muted-foreground text-sm">
								Applies to
							</span>
							<select
								value={appliesTo}
								onChange={(e) =>
									setAppliesTo(e.target.value as Discount["appliesTo"])
								}
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
							>
								<option value="all">All products</option>
								<option value="specific_products">Specific products</option>
								<option value="specific_categories">Specific categories</option>
							</select>
						</label>
					</div>
				</div>

				{/* Schedule */}
				<div className="rounded-lg border border-border bg-card p-5">
					<h3 className="mb-4 font-semibold text-foreground text-sm">
						Schedule
					</h3>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<label className="block">
							<span className="mb-1.5 block font-medium text-muted-foreground text-sm">
								Start date
							</span>
							<input
								type="datetime-local"
								value={startsAt}
								onChange={(e) => setStartsAt(e.target.value)}
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
							/>
						</label>
						<label className="block">
							<span className="mb-1.5 block font-medium text-muted-foreground text-sm">
								End date
							</span>
							<input
								type="datetime-local"
								value={endsAt}
								onChange={(e) => setEndsAt(e.target.value)}
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
							/>
						</label>
					</div>
				</div>

				{/* Options */}
				<div className="rounded-lg border border-border bg-card p-5">
					<h3 className="mb-4 font-semibold text-foreground text-sm">
						Options
					</h3>
					<div className="space-y-3">
						<label className="flex items-center gap-3">
							<input
								type="checkbox"
								checked={isActive}
								onChange={(e) => setIsActive(e.target.checked)}
								className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
							/>
							<span className="text-foreground text-sm">Active</span>
						</label>
						<label className="flex items-center gap-3">
							<input
								type="checkbox"
								checked={stackable}
								onChange={(e) => setStackable(e.target.checked)}
								className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
							/>
							<span className="text-foreground text-sm">
								Stackable with other discounts
							</span>
						</label>
					</div>
				</div>

				{/* Actions */}
				<div className="flex items-center gap-3">
					<button
						type="submit"
						disabled={isPending}
						className="rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm transition-opacity disabled:opacity-50"
					>
						{isPending
							? isEdit
								? "Saving..."
								: "Creating..."
							: isEdit
								? "Save Changes"
								: "Create Discount"}
					</button>
					<a
						href={
							isEdit && discountId
								? `/admin/discounts/${discountId}`
								: "/admin/discounts"
						}
						className="rounded-md border border-border px-4 py-2 font-medium text-foreground text-sm hover:bg-muted"
					>
						Cancel
					</a>
				</div>
			</form>
		);

	return <DiscountFormTemplate title={title} formContent={formContent} />;
}
