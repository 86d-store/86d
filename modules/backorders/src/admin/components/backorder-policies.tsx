"use client";

import { useState } from "react";
import { useBackordersApi } from "./_shared";

interface BackorderPolicy {
	id: string;
	productId: string;
	enabled: boolean;
	maxQuantityPerOrder?: number;
	maxTotalBackorders?: number;
	estimatedLeadDays?: number;
	autoConfirm: boolean;
	message?: string;
	createdAt: string;
	updatedAt: string;
}

function extractError(err: unknown): string {
	if (err && typeof err === "object" && "message" in err) {
		return String((err as { message: string }).message);
	}
	return "An unexpected error occurred";
}

export function BackorderPolicies() {
	const api = useBackordersApi();
	const [showCreate, setShowCreate] = useState(false);
	const [productId, setProductId] = useState("");
	const [enabled, setEnabled] = useState(true);
	const [maxQty, setMaxQty] = useState(0);
	const [maxTotal, setMaxTotal] = useState(0);
	const [leadDays, setLeadDays] = useState(14);
	const [autoConfirm, setAutoConfirm] = useState(false);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");

	const { data, isLoading } = api.listPolicies.useQuery({}) as {
		data: { policies?: BackorderPolicy[] } | undefined;
		isLoading: boolean;
	};

	const setMutation = api.setPolicy.useMutation() as {
		mutateAsync: (opts: { body: Record<string, unknown> }) => Promise<unknown>;
		isPending: boolean;
	};
	const deleteMutation = api.deletePolicy.useMutation() as {
		mutateAsync: (opts: {
			params: { productId: string };
			body: Record<string, unknown>;
		}) => Promise<unknown>;
		isPending: boolean;
	};

	const policies = data?.policies ?? [];

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		if (!productId.trim()) {
			setError("Product ID is required.");
			return;
		}
		try {
			await setMutation.mutateAsync({
				body: {
					productId: productId.trim(),
					enabled,
					maxQuantityPerOrder: maxQty > 0 ? maxQty : undefined,
					maxTotalBackorders: maxTotal > 0 ? maxTotal : undefined,
					estimatedLeadDays: leadDays > 0 ? leadDays : undefined,
					autoConfirm,
					message: message.trim() || undefined,
				},
			});
			setProductId("");
			setEnabled(true);
			setMaxQty(0);
			setMaxTotal(0);
			setLeadDays(14);
			setAutoConfirm(false);
			setMessage("");
			setShowCreate(false);
			window.location.reload();
		} catch (err) {
			setError(extractError(err));
		}
	};

	const handleDelete = async (policyProductId: string) => {
		if (!confirm("Delete this backorder policy?")) return;
		try {
			await deleteMutation.mutateAsync({
				params: { productId: policyProductId },
				body: {},
			});
			window.location.reload();
		} catch {
			// silently handled
		}
	};

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground">
						Backorder Policies
					</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Configure per-product backorder rules
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowCreate(!showCreate)}
					className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90"
				>
					{showCreate ? "Cancel" : "Add Policy"}
				</button>
			</div>

			{/* Create form */}
			{showCreate ? (
				<div className="mb-6 rounded-lg border border-border bg-card p-5">
					<h2 className="mb-4 font-semibold text-foreground text-sm">
						New Policy
					</h2>
					{error ? (
						<div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 text-sm dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
							{error}
						</div>
					) : null}
					<form onSubmit={handleCreate} className="space-y-4">
						<div className="grid gap-4 sm:grid-cols-2">
							<label className="block">
								<span className="mb-1 block font-medium text-sm">
									Product ID
								</span>
								<input
									type="text"
									value={productId}
									onChange={(e) => setProductId(e.target.value)}
									placeholder="Product ID"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
							<label className="block">
								<span className="mb-1 block font-medium text-sm">
									Est. Lead Days
								</span>
								<input
									type="number"
									value={leadDays}
									onChange={(e) =>
										setLeadDays(Number.parseInt(e.target.value, 10) || 0)
									}
									min={0}
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<label className="block">
								<span className="mb-1 block font-medium text-sm">
									Max Qty/Order
								</span>
								<input
									type="number"
									value={maxQty}
									onChange={(e) =>
										setMaxQty(Number.parseInt(e.target.value, 10) || 0)
									}
									min={0}
									placeholder="0 = unlimited"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
							<label className="block">
								<span className="mb-1 block font-medium text-sm">
									Max Total Backorders
								</span>
								<input
									type="number"
									value={maxTotal}
									onChange={(e) =>
										setMaxTotal(Number.parseInt(e.target.value, 10) || 0)
									}
									min={0}
									placeholder="0 = unlimited"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
						</div>
						<label className="block">
							<span className="mb-1 block font-medium text-sm">
								Customer Message
							</span>
							<input
								type="text"
								value={message}
								onChange={(e) => setMessage(e.target.value)}
								placeholder="Optional message shown to customers"
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
							/>
						</label>
						<div className="flex gap-6">
							<label className="flex items-center gap-2">
								<input
									type="checkbox"
									checked={enabled}
									onChange={(e) => setEnabled(e.target.checked)}
									className="rounded border-border"
								/>
								<span className="font-medium text-sm">Enabled</span>
							</label>
							<label className="flex items-center gap-2">
								<input
									type="checkbox"
									checked={autoConfirm}
									onChange={(e) => setAutoConfirm(e.target.checked)}
									className="rounded border-border"
								/>
								<span className="font-medium text-sm">Auto-confirm</span>
							</label>
						</div>
						<button
							type="submit"
							disabled={setMutation.isPending}
							className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
						>
							{setMutation.isPending ? "Saving..." : "Save Policy"}
						</button>
					</form>
				</div>
			) : null}

			{/* Policy list */}
			{isLoading ? (
				<div className="space-y-3">
					{(["k0", "k1", "k2"] as const).map((key) => (
						<div
							key={key}
							className="h-16 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : policies.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">
						No backorder policies configured.
					</p>
				</div>
			) : (
				<div className="space-y-3">
					{policies.map((policy) => (
						<div
							key={policy.id}
							className="rounded-lg border border-border bg-card p-4"
						>
							<div className="flex items-start justify-between gap-4">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<p className="font-mono text-foreground text-sm">
											Product: {policy.productId.slice(0, 12)}...
										</p>
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
												policy.enabled
													? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
													: "bg-muted text-muted-foreground"
											}`}
										>
											{policy.enabled ? "Enabled" : "Disabled"}
										</span>
										{policy.autoConfirm ? (
											<span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-800 text-xs dark:bg-blue-900/30 dark:text-blue-400">
												Auto-confirm
											</span>
										) : null}
									</div>
									<div className="mt-1.5 flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
										{policy.estimatedLeadDays ? (
											<span>{policy.estimatedLeadDays} day lead time</span>
										) : null}
										{policy.maxQuantityPerOrder ? (
											<span>Max {policy.maxQuantityPerOrder}/order</span>
										) : null}
										{policy.maxTotalBackorders ? (
											<span>Max {policy.maxTotalBackorders} total</span>
										) : null}
										{policy.message ? (
											<span>&ldquo;{policy.message}&rdquo;</span>
										) : null}
									</div>
								</div>
								<button
									type="button"
									onClick={() => handleDelete(policy.productId)}
									className="rounded px-2 py-1 text-red-600 text-xs hover:bg-red-50 dark:hover:bg-red-900/20"
								>
									Delete
								</button>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
