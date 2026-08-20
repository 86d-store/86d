"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import DiscountDetailTemplate from "./discount-detail.mdx";

interface Discount {
	id: string;
	name: string;
	description?: string;
	type: "percentage" | "fixed_amount" | "free_shipping";
	value: number;
	minimumAmount?: number | null;
	maximumUses?: number | null;
	usedCount: number;
	isActive: boolean;
	startsAt?: string | null;
	endsAt?: string | null;
	appliesTo: "all" | "specific_products" | "specific_categories";
	stackable: boolean;
	createdAt: string;
	updatedAt: string;
}

interface DiscountCode {
	id: string;
	discountId: string;
	code: string;
	usedCount: number;
	maximumUses?: number | null;
	isActive: boolean;
	createdAt: string;
}

interface CodeStats {
	total: number;
	active: number;
	inactive: number;
	totalRedemptions: number;
	fullyUsed: number;
	unused: number;
	redemptionRate: number;
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

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(iso));
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

function useDiscountsAdminApi() {
	const client = useModuleClient();
	return {
		getDiscount: client.module("discounts").admin["/admin/discounts/:id"],
		updateDiscount:
			client.module("discounts").admin["/admin/discounts/:id/update"],
		deleteDiscount:
			client.module("discounts").admin["/admin/discounts/:id/delete"],
		createCode: client.module("discounts").admin["/admin/discounts/:id/codes"],
		generateCodes:
			client.module("discounts").admin["/admin/discounts/:id/generate-codes"],
		codeStats:
			client.module("discounts").admin["/admin/discounts/:id/code-stats"],
		deleteCode:
			client.module("discounts").admin["/admin/discounts/codes/:id/delete"],
		updateCode:
			client.module("discounts").admin["/admin/discounts/codes/:id/update"],
		listDiscounts: client.module("discounts").admin["/admin/discounts"],
	};
}

function CreateCodeForm({
	discountId,
	onClose,
	onSuccess,
}: {
	discountId: string;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const api = useDiscountsAdminApi();
	const [code, setCode] = useState("");
	const [maxUses, setMaxUses] = useState("");
	const [error, setError] = useState("");

	const createMutation = api.createCode.useMutation({
		onSuccess: () => {
			onSuccess();
			onClose();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to create promo code."));
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		const trimmed = code.trim().toUpperCase();
		if (!trimmed) {
			setError("Code is required.");
			return;
		}

		const maxUsesNum = maxUses ? Number.parseInt(maxUses, 10) : Number.NaN;
		createMutation.mutate({
			params: { id: discountId },
			code: trimmed,
			...(!Number.isNaN(maxUsesNum) && maxUsesNum > 0
				? { maximumUses: maxUsesNum }
				: {}),
		});
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="rounded-lg border border-border bg-card p-4"
		>
			<h4 className="mb-3 font-semibold text-foreground text-sm">
				Add Promo Code
			</h4>
			{error && (
				<div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-red-700 text-xs dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
					{error}
				</div>
			)}
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<label className="block">
					<span className="mb-1 block text-muted-foreground text-xs">
						Code *
					</span>
					<input
						type="text"
						value={code}
						onChange={(e) => setCode(e.target.value)}
						placeholder="SUMMER20"
						maxLength={50}
						required
						className="w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm uppercase outline-none focus:ring-2 focus:ring-ring"
					/>
				</label>
				<label className="block">
					<span className="mb-1 block text-muted-foreground text-xs">
						Max uses (per code)
					</span>
					<input
						type="number"
						min="1"
						step="1"
						value={maxUses}
						onChange={(e) => setMaxUses(e.target.value)}
						placeholder="Unlimited"
						className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
					/>
				</label>
			</div>
			<div className="mt-3 flex gap-2">
				<button
					type="submit"
					disabled={createMutation.isPending}
					className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-sm disabled:opacity-50"
				>
					{createMutation.isPending ? "Creating..." : "Create Code"}
				</button>
				<button
					type="button"
					onClick={onClose}
					className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted"
				>
					Cancel
				</button>
			</div>
		</form>
	);
}

function BulkGenerateForm({
	discountId,
	onClose,
	onSuccess,
}: {
	discountId: string;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const api = useDiscountsAdminApi();
	const [count, setCount] = useState("10");
	const [prefix, setPrefix] = useState("");
	const [maxUses, setMaxUses] = useState("1");
	const [error, setError] = useState("");
	const [result, setResult] = useState<{
		generated: number;
		codes: DiscountCode[];
	} | null>(null);

	const generateMutation = api.generateCodes.useMutation({
		onSuccess: (data: { generated: number; codes: DiscountCode[] }) => {
			setResult(data);
			onSuccess();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to generate codes."));
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setResult(null);
		const n = Number.parseInt(count, 10);
		if (Number.isNaN(n) || n < 1 || n > 500) {
			setError("Count must be between 1 and 500.");
			return;
		}

		const mu = Number.parseInt(maxUses, 10);
		generateMutation.mutate({
			params: { id: discountId },
			count: n,
			...(prefix.trim() ? { prefix: prefix.trim() } : {}),
			...(!Number.isNaN(mu) && mu > 0 ? { maximumUses: mu } : {}),
		});
	};

	const handleExportCsv = () => {
		if (!result?.codes.length) return;
		const csv = ["Code,MaxUses,Status"]
			.concat(
				result.codes.map(
					(c) =>
						`${c.code},${c.maximumUses ?? "Unlimited"},${c.isActive ? "Active" : "Inactive"}`,
				),
			)
			.join("\n");
		const blob = new Blob([csv], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `codes-${discountId}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<div className="rounded-lg border border-border bg-card p-4">
			<h4 className="mb-3 font-semibold text-foreground text-sm">
				Generate Bulk Codes
			</h4>
			{error && (
				<div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-red-700 text-xs dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
					{error}
				</div>
			)}
			{result ? (
				<div>
					<div className="mb-3 rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/30">
						<p className="font-medium text-green-800 text-sm dark:text-green-300">
							Generated {result.generated} codes
						</p>
					</div>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={handleExportCsv}
							className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-sm"
						>
							Export CSV
						</button>
						<button
							type="button"
							onClick={onClose}
							className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted"
						>
							Close
						</button>
					</div>
				</div>
			) : (
				<form onSubmit={handleSubmit}>
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
						<label className="block">
							<span className="mb-1 block text-muted-foreground text-xs">
								Count *
							</span>
							<input
								type="number"
								min="1"
								max="500"
								value={count}
								onChange={(e) => setCount(e.target.value)}
								required
								className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
							/>
						</label>
						<label className="block">
							<span className="mb-1 block text-muted-foreground text-xs">
								Prefix
							</span>
							<input
								type="text"
								value={prefix}
								onChange={(e) => setPrefix(e.target.value)}
								placeholder="e.g. WINTER"
								maxLength={20}
								className="w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm uppercase outline-none focus:ring-2 focus:ring-ring"
							/>
						</label>
						<label className="block">
							<span className="mb-1 block text-muted-foreground text-xs">
								Max uses per code
							</span>
							<input
								type="number"
								min="1"
								step="1"
								value={maxUses}
								onChange={(e) => setMaxUses(e.target.value)}
								placeholder="1"
								className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
							/>
						</label>
					</div>
					<p className="mt-2 text-muted-foreground text-xs">
						{prefix.trim()
							? `Codes will be like: ${prefix.trim().toUpperCase()}-XXXXXXXX`
							: "Codes will be random 8-character strings"}
					</p>
					<div className="mt-3 flex gap-2">
						<button
							type="submit"
							disabled={generateMutation.isPending}
							className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-sm disabled:opacity-50"
						>
							{generateMutation.isPending
								? "Generating..."
								: `Generate ${count || "0"} Codes`}
						</button>
						<button
							type="button"
							onClick={onClose}
							className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted"
						>
							Cancel
						</button>
					</div>
				</form>
			)}
		</div>
	);
}

function CodeStatsBar({ stats }: { stats: CodeStats }) {
	return (
		<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
			<div className="rounded-md border border-border bg-muted/30 p-3">
				<p className="text-muted-foreground text-xs">Total Codes</p>
				<p className="mt-0.5 font-semibold text-foreground">{stats.total}</p>
			</div>
			<div className="rounded-md border border-border bg-muted/30 p-3">
				<p className="text-muted-foreground text-xs">Redemptions</p>
				<p className="mt-0.5 font-semibold text-foreground">
					{stats.totalRedemptions}
				</p>
			</div>
			<div className="rounded-md border border-border bg-muted/30 p-3">
				<p className="text-muted-foreground text-xs">Unused</p>
				<p className="mt-0.5 font-semibold text-foreground">{stats.unused}</p>
			</div>
			<div className="rounded-md border border-border bg-muted/30 p-3">
				<p className="text-muted-foreground text-xs">Redemption Rate</p>
				<p className="mt-0.5 font-semibold text-foreground">
					{stats.redemptionRate}%
				</p>
			</div>
		</div>
	);
}

export function DiscountDetail(props: {
	discountId?: string;
	params?: Record<string, string>;
}) {
	const discountId = props.discountId ?? props.params?.id;
	const api = useDiscountsAdminApi();
	const [showCreateCode, setShowCreateCode] = useState(false);
	const [showBulkGenerate, setShowBulkGenerate] = useState(false);
	const [deleteCodeConfirm, setDeleteCodeConfirm] = useState<string | null>(
		null,
	);

	const { data, isLoading } = api.getDiscount.useQuery(
		{ params: { id: discountId ?? "" } },
		{ enabled: !!discountId },
	) as {
		data: { discount: Discount; codes: DiscountCode[] } | undefined;
		isLoading: boolean;
	};

	const { data: codeStats } = api.codeStats.useQuery(
		{ params: { id: discountId ?? "" } },
		{ enabled: !!discountId },
	) as { data: CodeStats | undefined };

	const discount = data?.discount;
	const codes = data?.codes ?? [];

	const toggleMutation = api.updateDiscount.useMutation({
		onSettled: () => {
			void api.getDiscount.invalidate();
			void api.listDiscounts.invalidate();
		},
	});

	const deleteDiscountMutation = api.deleteDiscount.useMutation({
		onSuccess: () => {
			window.location.href = "/admin/discounts";
		},
	});

	const deleteCodeMutation = api.deleteCode.useMutation({
		onSettled: () => {
			setDeleteCodeConfirm(null);
			void api.getDiscount.invalidate();
			void api.codeStats.invalidate();
		},
	});

	const updateCodeMutation = api.updateCode.useMutation({
		onSettled: () => {
			void api.getDiscount.invalidate();
			void api.codeStats.invalidate();
		},
	});

	const handleDeleteDiscount = () => {
		if (!confirm("Delete this discount? This cannot be undone.")) return;
		deleteDiscountMutation.mutate({ params: { id: discountId } });
	};

	const handleDeleteCode = (codeId: string) => {
		deleteCodeMutation.mutate({ params: { id: codeId } });
	};

	const handleToggleCode = (codeId: string, currentActive: boolean) => {
		updateCodeMutation.mutate({
			params: { id: codeId },
			isActive: !currentActive,
		});
	};

	const handleRefreshCodes = () => {
		void api.getDiscount.invalidate();
		void api.codeStats.invalidate();
	};

	const handleExportAllCodes = () => {
		if (!codes.length) return;
		const csv = ["Code,Used,MaxUses,Status,Created"]
			.concat(
				codes.map(
					(c) =>
						`${c.code},${c.usedCount},${c.maximumUses ?? "Unlimited"},${c.isActive ? "Active" : "Inactive"},${c.createdAt}`,
				),
			)
			.join("\n");
		const blob = new Blob([csv], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `all-codes-${discountId}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	if (!discountId) {
		return (
			<div className="rounded-md border border-border bg-muted/30 p-4 text-muted-foreground">
				<p className="font-medium">Discount not found</p>
				<p className="mt-1 text-sm">No discount ID was provided.</p>
				<a
					href="/admin/discounts"
					className="mt-3 inline-block text-sm underline"
				>
					Back to discounts
				</a>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="space-y-6 py-4">
				<div className="h-7 w-1/3 animate-pulse rounded bg-muted" />
				<div className="grid gap-4 sm:grid-cols-3">
					{[1, 2, 3].map((i) => (
						<div
							key={i}
							className="space-y-2 rounded-lg border border-border p-4"
						>
							<div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
							<div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
						</div>
					))}
				</div>
				<div className="h-48 animate-pulse rounded-lg border border-border bg-muted/30" />
			</div>
		);
	}

	if (!discount) {
		return (
			<div className="py-12 text-center">
				<p className="font-medium text-foreground text-sm">
					Discount not found
				</p>
				<a
					href="/admin/discounts"
					className="mt-2 inline-block text-muted-foreground text-sm hover:text-foreground"
				>
					Back to discounts
				</a>
			</div>
		);
	}

	const content = (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground">
						{discount.name}
					</h1>
					{discount.description && (
						<p className="mt-1 text-muted-foreground text-sm">
							{discount.description}
						</p>
					)}
				</div>
				<div className="flex items-center gap-2">
					<a
						href={`/admin/discounts/${discountId}/edit`}
						className="rounded-md border border-border px-3 py-1.5 font-medium text-foreground text-sm hover:bg-muted"
					>
						Edit
					</a>
					<button
						type="button"
						onClick={handleDeleteDiscount}
						disabled={deleteDiscountMutation.isPending}
						className="rounded-md border border-red-200 px-3 py-1.5 font-medium text-red-600 text-sm hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-950/30"
					>
						Delete
					</button>
				</div>
			</div>

			{/* Overview cards */}
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<div className="rounded-lg border border-border bg-card p-4">
					<p className="text-muted-foreground text-xs">Value</p>
					<p className="mt-1 font-semibold text-foreground text-lg">
						{formatValue(discount.type, discount.value)}
					</p>
				</div>
				<div className="rounded-lg border border-border bg-card p-4">
					<p className="text-muted-foreground text-xs">Status</p>
					<div className="mt-1">
						<span
							className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
								discount.isActive
									? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
									: "bg-muted text-muted-foreground"
							}`}
						>
							{discount.isActive ? "Active" : "Inactive"}
						</span>
						<button
							type="button"
							onClick={() =>
								toggleMutation.mutate({
									params: { id: discountId },
									isActive: !discount.isActive,
								})
							}
							disabled={toggleMutation.isPending}
							className="ml-2 text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline"
						>
							{discount.isActive ? "Deactivate" : "Activate"}
						</button>
					</div>
				</div>
				<div className="rounded-lg border border-border bg-card p-4">
					<p className="text-muted-foreground text-xs">Times used</p>
					<p className="mt-1 font-semibold text-foreground text-lg">
						{discount.usedCount}
						{discount.maximumUses != null && (
							<span className="font-normal text-muted-foreground text-sm">
								{" "}
								/ {discount.maximumUses}
							</span>
						)}
					</p>
				</div>
				<div className="rounded-lg border border-border bg-card p-4">
					<p className="text-muted-foreground text-xs">Type</p>
					<p className="mt-1 font-medium text-foreground text-sm capitalize">
						{discount.type.replace(/_/g, " ")}
					</p>
				</div>
			</div>

			{/* Details */}
			<div className="rounded-lg border border-border bg-card p-5">
				<h3 className="mb-3 font-semibold text-foreground text-sm">
					Configuration
				</h3>
				<dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
					{discount.minimumAmount != null && (
						<>
							<dt className="text-muted-foreground">Minimum order</dt>
							<dd className="font-medium text-foreground">
								{new Intl.NumberFormat("en-US", {
									style: "currency",
									currency: "USD",
								}).format(discount.minimumAmount / 100)}
							</dd>
						</>
					)}
					<dt className="text-muted-foreground">Applies to</dt>
					<dd className="font-medium text-foreground capitalize">
						{discount.appliesTo.replace(/_/g, " ")}
					</dd>
					<dt className="text-muted-foreground">Stackable</dt>
					<dd className="font-medium text-foreground">
						{discount.stackable ? "Yes" : "No"}
					</dd>
					{discount.startsAt && (
						<>
							<dt className="text-muted-foreground">Starts</dt>
							<dd className="font-medium text-foreground">
								{formatDate(discount.startsAt)}
							</dd>
						</>
					)}
					{discount.endsAt && (
						<>
							<dt className="text-muted-foreground">Ends</dt>
							<dd className="font-medium text-foreground">
								{formatDate(discount.endsAt)}
							</dd>
						</>
					)}
					<dt className="text-muted-foreground">Created</dt>
					<dd className="font-medium text-foreground">
						{formatDate(discount.createdAt)}
					</dd>
					<dt className="text-muted-foreground">Updated</dt>
					<dd className="font-medium text-foreground">
						{formatDate(discount.updatedAt)}
					</dd>
				</dl>
			</div>

			{/* Code Stats */}
			{codeStats && codeStats.total > 0 && <CodeStatsBar stats={codeStats} />}

			{/* Promo Codes */}
			<div className="rounded-lg border border-border bg-card">
				<div className="flex items-center justify-between border-border border-b px-5 py-3">
					<h3 className="font-semibold text-foreground text-sm">
						Promo Codes ({codes.length})
					</h3>
					<div className="flex gap-2">
						{codes.length > 0 && (
							<button
								type="button"
								onClick={handleExportAllCodes}
								className="rounded-md border border-border px-3 py-1.5 font-medium text-foreground text-xs hover:bg-muted"
							>
								Export CSV
							</button>
						)}
						<button
							type="button"
							onClick={() => {
								setShowBulkGenerate(true);
								setShowCreateCode(false);
							}}
							className="rounded-md border border-border px-3 py-1.5 font-medium text-foreground text-xs hover:bg-muted"
						>
							Bulk Generate
						</button>
						<button
							type="button"
							onClick={() => {
								setShowCreateCode(true);
								setShowBulkGenerate(false);
							}}
							className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-xs"
						>
							+ Add Code
						</button>
					</div>
				</div>

				{showCreateCode && (
					<div className="border-border border-b p-4">
						<CreateCodeForm
							discountId={discountId}
							onClose={() => setShowCreateCode(false)}
							onSuccess={handleRefreshCodes}
						/>
					</div>
				)}

				{showBulkGenerate && (
					<div className="border-border border-b p-4">
						<BulkGenerateForm
							discountId={discountId}
							onClose={() => setShowBulkGenerate(false)}
							onSuccess={handleRefreshCodes}
						/>
					</div>
				)}

				{codes.length === 0 ? (
					<div className="px-5 py-8 text-center">
						<p className="font-medium text-foreground text-sm">
							No promo codes yet
						</p>
						<p className="mt-1 text-muted-foreground text-xs">
							Create promo codes that customers can use at checkout, or bulk
							generate unique coupon codes.
						</p>
					</div>
				) : (
					<table className="w-full text-sm">
						<thead>
							<tr className="border-border border-b bg-muted/50">
								<th
									scope="col"
									className="px-5 py-2.5 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
								>
									Code
								</th>
								<th
									scope="col"
									className="px-5 py-2.5 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide"
								>
									Used
								</th>
								<th
									scope="col"
									className="px-5 py-2.5 text-center font-semibold text-muted-foreground text-xs uppercase tracking-wide"
								>
									Status
								</th>
								<th
									scope="col"
									className="hidden px-5 py-2.5 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide sm:table-cell"
								>
									Created
								</th>
								<th
									scope="col"
									className="px-5 py-2.5 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide"
								>
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{codes.map((c) => (
								<tr key={c.id} className="transition-colors hover:bg-muted/30">
									<td className="px-5 py-3 font-medium font-mono text-foreground text-xs">
										{c.code}
									</td>
									<td className="px-5 py-3 text-right text-muted-foreground">
										{c.usedCount}
										{c.maximumUses != null && ` / ${c.maximumUses}`}
									</td>
									<td className="px-5 py-3 text-center">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
												c.isActive
													? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
													: "bg-muted text-muted-foreground"
											}`}
										>
											{c.isActive ? "Active" : "Inactive"}
										</span>
									</td>
									<td className="hidden px-5 py-3 text-right text-muted-foreground text-xs sm:table-cell">
										{formatDate(c.createdAt)}
									</td>
									<td className="px-5 py-3 text-right">
										<span className="inline-flex gap-3">
											<button
												type="button"
												onClick={() => handleToggleCode(c.id, c.isActive)}
												disabled={updateCodeMutation.isPending}
												className="text-muted-foreground text-xs hover:text-foreground"
											>
												{c.isActive ? "Deactivate" : "Activate"}
											</button>
											{deleteCodeConfirm === c.id ? (
												<span className="space-x-2">
													<button
														type="button"
														onClick={() => handleDeleteCode(c.id)}
														disabled={deleteCodeMutation.isPending}
														className="font-medium text-red-600 text-xs hover:text-red-800 dark:text-red-400"
													>
														Confirm
													</button>
													<button
														type="button"
														onClick={() => setDeleteCodeConfirm(null)}
														className="text-muted-foreground text-xs"
													>
														Cancel
													</button>
												</span>
											) : (
												<button
													type="button"
													onClick={() => setDeleteCodeConfirm(c.id)}
													className="text-muted-foreground text-xs hover:text-red-600 dark:hover:text-red-400"
												>
													Delete
												</button>
											)}
										</span>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);

	return <DiscountDetailTemplate content={content} />;
}
