"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";
import {
	type BulkPriceRule,
	extractError,
	inputCls,
	labelCls,
	RuleSheet,
} from "./_shared";

function useBulkPricingDetailApi(ruleId: string) {
	const client = useModuleClient();
	return {
		rule: client.module("bulk-pricing").admin["/admin/bulk-pricing/rules/:id"],
		updateRule:
			client.module("bulk-pricing").admin[
				"/admin/bulk-pricing/rules/:id/update"
			],
		preview:
			client.module("bulk-pricing").admin[
				"/admin/bulk-pricing/rules/:id/preview"
			],
		listTiers: client.module("bulk-pricing").admin["/admin/bulk-pricing/tiers"],
		createTier:
			client.module("bulk-pricing").admin["/admin/bulk-pricing/tiers/create"],
		updateTier:
			client.module("bulk-pricing").admin[
				"/admin/bulk-pricing/tiers/:id/update"
			],
		deleteTier:
			client.module("bulk-pricing").admin[
				"/admin/bulk-pricing/tiers/:id/delete"
			],
		ruleId,
	};
}

interface PricingTier {
	id: string;
	ruleId: string;
	minQuantity: number;
	maxQuantity?: number;
	discountType: "percentage" | "fixed_amount" | "fixed_price";
	discountValue: number;
	label?: string;
}

function TierSheet({ ruleId, tier, onSaved, onCancel, api }: TierSheetProps) {
	useEffect(() => {
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") onCancel();
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [onCancel]);
	const firstInputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		firstInputRef.current?.focus();
	}, []);
	const isEditing = !!tier;
	const [minQty, setMinQty] = useState(String(tier?.minQuantity ?? 2));
	const [maxQty, setMaxQty] = useState(
		tier?.maxQuantity ? String(tier.maxQuantity) : "",
	);
	const [discountType, setDiscountType] = useState<
		"percentage" | "fixed_amount" | "fixed_price"
	>(tier?.discountType ?? "percentage");
	const [discountValue, setDiscountValue] = useState(
		tier
			? String(
					discountType === "percentage"
						? tier.discountValue
						: (tier.discountValue / 100).toFixed(2),
				)
			: "",
	);
	const [label, setLabel] = useState(tier?.label ?? "");
	const [error, setError] = useState("");

	const createMutation = api.createTier.useMutation({
		onSuccess: () => {
			void api.preview.invalidate();
			void api.listTiers.invalidate();
			onSaved();
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	const updateMutation = api.updateTier.useMutation({
		onSuccess: () => {
			void api.preview.invalidate();
			void api.listTiers.invalidate();
			onSaved();
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");

		const min = Number.parseInt(minQty, 10);
		if (Number.isNaN(min) || min < 1) {
			setError("Min quantity must be at least 1.");
			return;
		}

		const rawValue = Number.parseFloat(discountValue);
		if (Number.isNaN(rawValue) || rawValue < 0) {
			setError("Enter a valid discount value.");
			return;
		}

		const finalValue =
			discountType === "percentage" ? rawValue : Math.round(rawValue * 100);

		if (isEditing) {
			updateMutation.mutate({
				params: { id: tier.id },
				body: {
					minQuantity: min,
					maxQuantity: maxQty.trim() ? Number.parseInt(maxQty, 10) : undefined,
					discountType,
					discountValue: finalValue,
					label: label.trim() || undefined,
				},
			});
		} else {
			createMutation.mutate({
				body: {
					ruleId,
					minQuantity: min,
					maxQuantity: maxQty.trim() ? Number.parseInt(maxQty, 10) : undefined,
					discountType,
					discountValue: finalValue,
					label: label.trim() || undefined,
				},
			});
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex justify-end">
			<button
				type="button"
				className="absolute inset-0 cursor-default bg-black/40"
				aria-label="Close panel"
				onClick={onCancel}
			/>
			<div
				role="dialog"
				aria-modal="true"
				className="relative flex h-full w-full max-w-sm flex-col overflow-y-auto border-border border-l bg-background shadow-2xl"
			>
				<div className="flex shrink-0 items-center justify-between border-border border-b px-6 py-4">
					<h2 className="font-semibold text-foreground text-lg">
						{isEditing ? "Edit Tier" : "New Tier"}
					</h2>
					<button
						type="button"
						onClick={onCancel}
						className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
						aria-label="Close"
					>
						✕
					</button>
				</div>
				<form
					onSubmit={handleSubmit}
					className="flex flex-1 flex-col gap-5 px-6 py-6"
				>
					{error ? (
						<div
							role="alert"
							className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm"
						>
							{error}
						</div>
					) : null}
					<div className="space-y-4">
						<div className="grid gap-3 sm:grid-cols-2">
							<div>
								<label htmlFor="bt-min" className={labelCls}>
									Min quantity
								</label>
								<input
									id="bt-min"
									type="number"
									ref={firstInputRef}
									min="1"
									className={inputCls}
									value={minQty}
									onChange={(e) => setMinQty(e.target.value)}
								/>
							</div>
							<div>
								<label htmlFor="bt-max" className={labelCls}>
									Max quantity{" "}
									<span className="font-normal text-muted-foreground">
										(optional)
									</span>
								</label>
								<input
									id="bt-max"
									type="number"
									min="1"
									className={inputCls}
									value={maxQty}
									onChange={(e) => setMaxQty(e.target.value)}
									placeholder="No limit"
								/>
							</div>
						</div>
						<div>
							<label htmlFor="bt-type" className={labelCls}>
								Discount type
							</label>
							<select
								id="bt-type"
								className={inputCls}
								value={discountType}
								onChange={(e) =>
									setDiscountType(
										e.target.value as
											| "percentage"
											| "fixed_amount"
											| "fixed_price",
									)
								}
							>
								<option value="percentage">Percentage off</option>
								<option value="fixed_amount">Fixed amount off per unit</option>
								<option value="fixed_price">Fixed price per unit</option>
							</select>
						</div>
						<div>
							<label htmlFor="bt-value" className={labelCls}>
								Discount value{" "}
								<span className="font-normal text-muted-foreground">
									({discountType === "percentage" ? "%" : "$"})
								</span>
							</label>
							<input
								id="bt-value"
								type="number"
								step={discountType === "percentage" ? "0.1" : "0.01"}
								min="0"
								className={inputCls}
								value={discountValue}
								onChange={(e) => setDiscountValue(e.target.value)}
								placeholder={discountType === "percentage" ? "10" : "5.00"}
							/>
						</div>
						<div>
							<label htmlFor="bt-label" className={labelCls}>
								Label
							</label>
							<input
								id="bt-label"
								className={inputCls}
								value={label}
								onChange={(e) => setLabel(e.target.value)}
								placeholder="Buy 5+ save 10%"
							/>
						</div>
					</div>
					<div className="mt-auto flex justify-end gap-2 border-border border-t pt-4">
						<button
							type="button"
							onClick={onCancel}
							className="rounded-lg border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={isPending}
							className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
						>
							{isPending
								? isEditing
									? "Saving..."
									: "Adding..."
								: isEditing
									? "Save Changes"
									: "Add Tier"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

function formatDiscount(tier: PricingTier): string {
	switch (tier.discountType) {
		case "percentage":
			return `${tier.discountValue}% off`;
		case "fixed_amount":
			return `$${(tier.discountValue / 100).toFixed(2)} off/unit`;
		case "fixed_price":
			return `$${(tier.discountValue / 100).toFixed(2)}/unit`;
		default:
			return String(tier.discountValue);
	}
}

interface TierSheetProps {
	ruleId: string;
	tier?: PricingTier;
	onSaved: () => void;
	onCancel: () => void;
	api: ReturnType<typeof useBulkPricingDetailApi>;
}

export function BulkPricingDetail({
	params,
}: {
	params?: Record<string, string>;
}) {
	const ruleId = params?.id ?? "";
	const api = useBulkPricingDetailApi(ruleId);
	const [showEditRule, setShowEditRule] = useState(false);
	const [showCreateTier, setShowCreateTier] = useState(false);
	const [editTier, setEditTier] = useState<PricingTier | null>(null);

	const { data: ruleData, isLoading } = api.rule.useQuery({ id: ruleId }) as {
		data: { rule?: BulkPriceRule } | undefined;
		isLoading: boolean;
	};

	const { data: tiersData } = api.preview.useQuery({ id: ruleId }) as {
		data: { tiers?: PricingTier[] } | undefined;
	};

	const deleteTierMutation = api.deleteTier.useMutation({
		onSuccess: () => {
			void api.preview.invalidate();
			void api.listTiers.invalidate();
		},
	});

	const rule = ruleData?.rule;
	const tiers = tiersData?.tiers ?? [];

	const backLink = (
		<a
			href="/admin/bulk-pricing"
			className="text-muted-foreground text-sm hover:text-foreground"
		>
			← Back to Bulk Pricing
		</a>
	);

	if (isLoading) {
		return (
			<div>
				<div className="mb-6">{backLink}</div>
				<div className="space-y-4">
					<div className="h-32 animate-pulse rounded-lg border border-border bg-muted/30" />
					<div className="h-48 animate-pulse rounded-lg border border-border bg-muted/30" />
				</div>
			</div>
		);
	}

	if (!rule) {
		return (
			<div>
				<div className="mb-6">{backLink}</div>
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">
						Pricing rule not found.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div>
			{showEditRule ? (
				<RuleSheet
					rule={rule}
					onSaved={() => setShowEditRule(false)}
					onCancel={() => setShowEditRule(false)}
				/>
			) : null}
			{showCreateTier ? (
				<TierSheet
					ruleId={ruleId}
					onSaved={() => setShowCreateTier(false)}
					onCancel={() => setShowCreateTier(false)}
					api={api}
				/>
			) : null}
			{editTier ? (
				<TierSheet
					ruleId={ruleId}
					tier={editTier}
					onSaved={() => setEditTier(null)}
					onCancel={() => setEditTier(null)}
					api={api}
				/>
			) : null}

			<div className="mb-6">{backLink}</div>

			{/* Header */}
			<div className="mb-6 flex flex-wrap items-start justify-between gap-4">
				<div>
					<div className="flex items-center gap-3">
						<h1 className="font-bold text-2xl text-foreground">
							{rule.name ?? "Pricing Rule"}
						</h1>
						<span
							className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
								rule.active
									? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
									: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
							}`}
						>
							{rule.active ? "Active" : "Inactive"}
						</span>
					</div>
					{rule.description ? (
						<p className="mt-1 text-muted-foreground text-sm">
							{rule.description}
						</p>
					) : null}
				</div>
				<button
					type="button"
					onClick={() => setShowEditRule(true)}
					className="rounded-lg border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted"
				>
					Edit Rule
				</button>
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				{/* Tiers section */}
				<div className="lg:col-span-2">
					<div className="rounded-lg border border-border bg-card">
						<div className="flex items-center justify-between border-border border-b px-4 py-3">
							<h2 className="font-semibold text-foreground text-sm">
								Pricing Tiers ({tiers.length})
							</h2>
							<button
								type="button"
								onClick={() => setShowCreateTier(true)}
								className="rounded-lg bg-foreground px-3 py-1 font-medium text-background text-xs hover:opacity-90"
							>
								Add Tier
							</button>
						</div>
						{tiers.length === 0 ? (
							<div className="p-8 text-center">
								<p className="text-muted-foreground text-sm">
									No tiers configured.
								</p>
								<button
									type="button"
									onClick={() => setShowCreateTier(true)}
									className="mt-3 rounded-lg bg-foreground px-3 py-1.5 font-medium text-background text-sm hover:opacity-90"
								>
									Add Tier
								</button>
							</div>
						) : (
							<table className="w-full">
								<thead>
									<tr className="border-border border-b text-left">
										<th
											scope="col"
											className="px-4 py-2 font-medium text-muted-foreground text-xs"
										>
											Quantity Range
										</th>
										<th
											scope="col"
											className="px-4 py-2 font-medium text-muted-foreground text-xs"
										>
											Discount
										</th>
										<th
											scope="col"
											className="px-4 py-2 font-medium text-muted-foreground text-xs"
										>
											Label
										</th>
										<th
											scope="col"
											className="px-4 py-2 font-medium text-muted-foreground text-xs"
										>
											Actions
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border">
									{tiers.map((tier) => (
										<tr key={tier.id} className="hover:bg-muted/30">
											<td className="px-4 py-2.5 font-medium text-foreground text-sm tabular-nums">
												{tier.minQuantity}
												{tier.maxQuantity
													? ` – ${tier.maxQuantity}`
													: "+ units"}
											</td>
											<td className="px-4 py-2.5 text-foreground text-sm">
												{formatDiscount(tier)}
											</td>
											<td className="px-4 py-2.5 text-muted-foreground text-sm">
												{tier.label ?? "—"}
											</td>
											<td className="px-4 py-2.5">
												<div className="flex gap-1">
													<button
														type="button"
														onClick={() => setEditTier(tier)}
														className="rounded px-2 py-1 text-xs hover:bg-muted"
													>
														Edit
													</button>
													<button
														type="button"
														onClick={() => {
															if (window.confirm("Delete this pricing tier?")) {
																deleteTierMutation.mutate({
																	params: { id: tier.id },
																});
															}
														}}
														disabled={deleteTierMutation.isPending}
														className="rounded px-2 py-1 text-red-600 text-xs hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
													>
														Delete
													</button>
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						)}
					</div>
				</div>

				{/* Details */}
				<div>
					<div className="rounded-lg border border-border bg-card p-4">
						<h3 className="mb-3 font-semibold text-foreground text-sm">
							Details
						</h3>
						<dl className="space-y-2 text-sm">
							{rule.scope ? (
								<div>
									<dt className="text-muted-foreground">Scope</dt>
									<dd className="font-medium text-foreground capitalize">
										{rule.scope}
									</dd>
								</div>
							) : null}
							{rule.targetId ? (
								<div>
									<dt className="text-muted-foreground">Target</dt>
									<dd className="font-medium font-mono text-foreground text-xs">
										{rule.targetId}
									</dd>
								</div>
							) : null}
							{rule.priority != null ? (
								<div>
									<dt className="text-muted-foreground">Priority</dt>
									<dd className="font-medium text-foreground">
										{rule.priority}
									</dd>
								</div>
							) : null}
							{rule.startsAt ? (
								<div>
									<dt className="text-muted-foreground">Starts</dt>
									<dd className="font-medium text-foreground">
										{new Date(rule.startsAt).toLocaleDateString()}
									</dd>
								</div>
							) : null}
							{rule.endsAt ? (
								<div>
									<dt className="text-muted-foreground">Ends</dt>
									<dd className="font-medium text-foreground">
										{new Date(rule.endsAt).toLocaleDateString()}
									</dd>
								</div>
							) : null}
							<div>
								<dt className="text-muted-foreground">Created</dt>
								<dd className="font-medium text-foreground">
									{new Date(rule.createdAt).toLocaleDateString()}
								</dd>
							</div>
						</dl>
					</div>
				</div>
			</div>
		</div>
	);
}
