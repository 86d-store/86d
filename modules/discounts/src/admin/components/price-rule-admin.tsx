"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";
import PriceRuleAdminTemplate from "./price-rule-admin.mdx";

interface CartPriceRuleCondition {
	type: string;
	value: string | number;
}

interface CartPriceRule {
	id: string;
	name: string;
	description?: string | undefined;
	type: "percentage" | "fixed_amount" | "free_shipping";
	value: number;
	conditions: CartPriceRuleCondition[];
	priority: number;
	stackable: boolean;
	isActive: boolean;
	usedCount: number;
	maximumUses?: number | undefined;
}

interface ListResult {
	rules: CartPriceRule[];
	total: number;
	pages: number;
}

function Skeleton({ className = "" }: { className?: string }) {
	return (
		<div
			className={`animate-pulse rounded bg-muted ${className}`}
			aria-hidden="true"
		/>
	);
}

function usePriceRuleApi() {
	const client = useModuleClient();
	const admin = client.module("discounts").admin;
	return {
		list: admin["/admin/discounts/price-rules"],
		create: admin["/admin/discounts/price-rules/create"],
		update: admin["/admin/discounts/price-rules/:id/update"],
		remove: admin["/admin/discounts/price-rules/:id/delete"],
	};
}

function formatValue(type: string, value: number): string {
	if (type === "percentage") return `${value}%`;
	if (type === "fixed_amount") {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
		}).format(value / 100);
	}
	return "Free shipping";
}

const CONDITION_LABELS: Record<string, string> = {
	minimum_subtotal: "Min subtotal",
	minimum_item_count: "Min items",
	contains_product: "Has product",
	contains_category: "Has category",
};

function formatCondition(cond: CartPriceRuleCondition): string {
	const label = CONDITION_LABELS[cond.type] ?? cond.type;
	if (cond.type === "minimum_subtotal") {
		return `${label}: ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(cond.value) / 100)}`;
	}
	return `${label}: ${cond.value}`;
}

const PAGE_SIZE = 20;

export function PriceRuleAdmin() {
	const api = usePriceRuleApi();
	const [page, setPage] = useState(1);
	const [isActiveFilter, setIsActiveFilter] = useState("");
	const priceRuleNameRef = useRef<HTMLInputElement>(null);
	const [showCreate, setShowCreate] = useState(false);

	// Create form state
	const [formName, setFormName] = useState("");
	const [formType, setFormType] = useState<string>("percentage");
	const [formValue, setFormValue] = useState("");
	const [formPriority, setFormPriority] = useState("0");
	const [formStackable, setFormStackable] = useState(false);
	const [formConditions, setFormConditions] = useState<
		CartPriceRuleCondition[]
	>([]);
	const [condType, setCondType] = useState("minimum_subtotal");
	const [condValue, setCondValue] = useState("");

	const queryInput: Record<string, string> = {
		page: String(page),
		limit: String(PAGE_SIZE),
	};
	if (isActiveFilter !== "") queryInput.isActive = isActiveFilter;

	const {
		data: listData,
		isLoading: loading,
		isError: rulesError,
		refetch: refetchRules,
	} = api.list.useQuery(queryInput) as {
		data: ListResult | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const deleteMut = api.remove.useMutation({
		onSettled: () => {
			void api.list.invalidate();
		},
	});
	const toggleMut = api.update.useMutation({
		onSettled: () => {
			void api.list.invalidate();
		},
	});
	useEffect(() => {
		if (!showCreate) return;
		priceRuleNameRef.current?.focus();
	}, [showCreate]);
	useEffect(() => {
		if (!showCreate) return;
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") setShowCreate(false);
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [showCreate]);

	const createMut = api.create.useMutation({
		onSettled: () => {
			void api.list.invalidate();
			setShowCreate(false);
			setFormName("");
			setFormValue("");
			setFormConditions([]);
		},
	});

	if (rulesError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load price rules
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchRules()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const rules = listData?.rules ?? [];
	const totalPages = listData?.pages ?? 1;

	function addCondition() {
		if (!condValue.trim()) return;
		setFormConditions((prev) => [
			...prev,
			{
				type: condType,
				value:
					condType === "minimum_subtotal" || condType === "minimum_item_count"
						? Number(condValue)
						: condValue,
			},
		]);
		setCondValue("");
	}

	function removeCondition(idx: number) {
		setFormConditions((prev) => prev.filter((_, i) => i !== idx));
	}

	function handleCreate() {
		const numValue = Number(formValue);
		if (!formName.trim() || Number.isNaN(numValue)) return;
		createMut.mutate({
			name: formName.trim(),
			type: formType,
			value:
				formType === "fixed_amount" ? Math.round(numValue * 100) : numValue,
			priority: Number(formPriority) || 0,
			stackable: formStackable,
			conditions: formConditions,
		});
	}

	const tableBody =
		loading && rules.length === 0 ? (
			Array.from({ length: 5 }, (_, i) => (
				<tr key={`sk-${i}`}>
					{Array.from({ length: 7 }, (_, j) => (
						<td key={`sk-cell-${j}`} className="px-4 py-3">
							<Skeleton className="h-4" />
						</td>
					))}
				</tr>
			))
		) : rules.length === 0 ? (
			<tr>
				<td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
					No price rules yet. Create one to get started.
				</td>
			</tr>
		) : (
			rules.map((rule) => (
				<tr key={rule.id} className="hover:bg-muted/30">
					<td className="px-4 py-3 text-foreground text-sm">
						<div>
							<span className="font-medium">{rule.name}</span>
							{rule.stackable && (
								<span className="ml-2 inline-flex rounded-full bg-blue-100 px-1.5 py-0.5 text-blue-700 text-xs dark:bg-blue-950 dark:text-blue-300">
									Stackable
								</span>
							)}
						</div>
						<span className="text-muted-foreground text-xs">
							Priority: {rule.priority}
						</span>
					</td>
					<td className="hidden px-4 py-3 sm:table-cell">
						<span
							className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
								rule.type === "percentage"
									? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
									: rule.type === "fixed_amount"
										? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
										: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
							}`}
						>
							{rule.type === "percentage"
								? "%"
								: rule.type === "fixed_amount"
									? "$"
									: "Ship"}
						</span>
					</td>
					<td className="px-4 py-3 text-right font-medium text-foreground text-sm">
						{formatValue(rule.type, rule.value)}
					</td>
					<td className="hidden px-4 py-3 text-center md:table-cell">
						{rule.conditions.length > 0 ? (
							<div className="flex flex-wrap justify-center gap-1">
								{rule.conditions.map((c, i) => (
									<span
										key={`${c.type}-${String(c.value)}-${String(i)}`}
										className="inline-flex rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs"
									>
										{formatCondition(c)}
									</span>
								))}
							</div>
						) : (
							<span className="text-muted-foreground text-xs">
								No conditions
							</span>
						)}
					</td>
					<td className="hidden px-4 py-3 text-right text-muted-foreground text-sm md:table-cell">
						{rule.usedCount}
						{rule.maximumUses != null && `/${rule.maximumUses}`}
					</td>
					<td className="px-4 py-3 text-center">
						<button
							type="button"
							onClick={() =>
								toggleMut.mutate({
									id: rule.id,
									isActive: !rule.isActive,
								})
							}
							className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
								rule.isActive
									? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
									: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
							}`}
						>
							{rule.isActive ? "Active" : "Inactive"}
						</button>
					</td>
					<td className="px-4 py-3 text-right">
						<button
							type="button"
							onClick={() => {
								if (confirm(`Delete "${rule.name}"?`)) {
									deleteMut.mutate({ id: rule.id });
								}
							}}
							className="text-red-500 text-sm hover:text-red-700"
						>
							Delete
						</button>
					</td>
				</tr>
			))
		);

	const createModal = showCreate ? (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
			<div
				role="dialog"
				aria-modal="true"
				className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg"
			>
				<h2 className="mb-4 font-semibold text-foreground text-lg">
					Create Price Rule
				</h2>

				<div className="space-y-4">
					<label className="block">
						<span className="mb-1 block font-medium text-sm">Name</span>
						<input
							ref={priceRuleNameRef}
							type="text"
							value={formName}
							onChange={(e) => setFormName(e.target.value)}
							placeholder="e.g. 10% off orders over $50"
							className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						/>
					</label>

					<div className="grid grid-cols-2 gap-3">
						<label className="block">
							<span className="mb-1 block font-medium text-sm">Type</span>
							<select
								value={formType}
								onChange={(e) => setFormType(e.target.value)}
								className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							>
								<option value="percentage">Percentage</option>
								<option value="fixed_amount">Fixed Amount</option>
								<option value="free_shipping">Free Shipping</option>
							</select>
						</label>
						<label className="block">
							<span className="mb-1 block font-medium text-sm">
								{formType === "percentage"
									? "Percentage"
									: formType === "fixed_amount"
										? "Amount ($)"
										: "Value"}
							</span>
							<input
								type="number"
								value={formValue}
								onChange={(e) => setFormValue(e.target.value)}
								placeholder={formType === "percentage" ? "10" : "5.00"}
								disabled={formType === "free_shipping"}
								className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
							/>
						</label>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<label className="block">
							<span className="mb-1 block font-medium text-sm">Priority</span>
							<input
								type="number"
								value={formPriority}
								onChange={(e) => setFormPriority(e.target.value)}
								className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</label>
						<div className="flex items-end">
							<label className="flex cursor-pointer items-center gap-2 text-sm">
								<input
									type="checkbox"
									checked={formStackable}
									onChange={(e) => setFormStackable(e.target.checked)}
									className="h-4 w-4 rounded border-border"
								/>
								Stackable with other rules
							</label>
						</div>
					</div>

					<div>
						<span className="mb-1 block font-medium text-sm">Conditions</span>
						<div className="flex gap-2">
							<select
								value={condType}
								onChange={(e) => setCondType(e.target.value)}
								className="h-9 rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							>
								<option value="minimum_subtotal">Min subtotal ($)</option>
								<option value="minimum_item_count">Min item count</option>
								<option value="contains_product">Contains product ID</option>
								<option value="contains_category">Contains category ID</option>
							</select>
							<input
								type={
									condType === "minimum_subtotal" ||
									condType === "minimum_item_count"
										? "number"
										: "text"
								}
								value={condValue}
								onChange={(e) => setCondValue(e.target.value)}
								placeholder="Value"
								className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
							<button
								type="button"
								onClick={addCondition}
								className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted"
							>
								Add
							</button>
						</div>
						{formConditions.length > 0 && (
							<div className="mt-2 flex flex-wrap gap-1">
								{formConditions.map((c, i) => (
									<span
										key={`${c.type}-${String(c.value)}-${String(i)}`}
										className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs"
									>
										{formatCondition(c)}
										<button
											type="button"
											onClick={() => removeCondition(i)}
											aria-label="Remove condition"
											className="ml-1 text-muted-foreground hover:text-foreground"
										>
											&times;
										</button>
									</span>
								))}
							</div>
						)}
					</div>
				</div>

				<div className="mt-6 flex justify-end gap-2">
					<button
						type="button"
						onClick={() => setShowCreate(false)}
						className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleCreate}
						disabled={!formName.trim() || createMut.isPending}
						className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-sm disabled:opacity-50"
					>
						{createMut.isPending ? "Creating..." : "Create Rule"}
					</button>
				</div>
			</div>
		</div>
	) : null;

	return (
		<PriceRuleAdminTemplate
			isActiveFilter={isActiveFilter}
			onFilterChange={(v: string) => {
				setIsActiveFilter(v);
				setPage(1);
			}}
			tableBody={tableBody}
			showPagination={totalPages > 1}
			page={page}
			totalPages={totalPages}
			onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
			onNextPage={() => setPage((p) => Math.min(totalPages, p + 1))}
			onShowCreate={() => setShowCreate(true)}
			createModal={createModal}
		/>
	);
}
