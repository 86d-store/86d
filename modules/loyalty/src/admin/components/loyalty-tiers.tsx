"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import LoyaltyTiersTemplate from "./loyalty-tiers.mdx";

interface LoyaltyTier {
	id: string;
	name: string;
	slug: string;
	minPoints: number;
	multiplier: number;
	perks?: Record<string, unknown> | null;
	sortOrder: number;
}

function Skeleton({ className = "" }: { className?: string }) {
	return (
		<div
			className={`animate-pulse rounded bg-muted ${className}`}
			aria-hidden="true"
		/>
	);
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

function formatNumber(n: number): string {
	return new Intl.NumberFormat("en-US").format(n);
}

function useLoyaltyTiersApi() {
	const client = useModuleClient();
	const admin = client.module("loyalty").admin;
	return {
		listTiers: admin["/admin/loyalty/tiers"],
		createTier: admin["/admin/loyalty/tiers/create"],
		updateTier: admin["/admin/loyalty/tiers/:id/update"],
		deleteTier: admin["/admin/loyalty/tiers/:id/delete"],
	};
}

export function LoyaltyTiers() {
	const api = useLoyaltyTiersApi();
	const [error, setError] = useState("");
	const [showForm, setShowForm] = useState(false);
	const [editingTier, setEditingTier] = useState<LoyaltyTier | null>(null);
	const [formName, setFormName] = useState("");
	const [formSlug, setFormSlug] = useState("");
	const [formMinPoints, setFormMinPoints] = useState("");
	const [formMultiplier, setFormMultiplier] = useState("1");
	const [actionLoading, setActionLoading] = useState(false);

	const {
		data: tiersData,
		isLoading: loading,
		error: queryError,
	} = api.listTiers.useQuery({}) as {
		data: { tiers: LoyaltyTier[] } | undefined;
		isLoading: boolean;
		error: Error | null;
	};

	const tiers = tiersData?.tiers ?? [];

	const createMutation = api.createTier.useMutation({
		onSuccess: () => resetForm(),
		onError: (err: Error) =>
			setError(extractError(err, "Failed to create tier.")),
		onSettled: () => {
			setActionLoading(false);
			void api.listTiers.invalidate();
		},
	});

	const updateMutation = api.updateTier.useMutation({
		onSuccess: () => resetForm(),
		onError: (err: Error) =>
			setError(extractError(err, "Failed to update tier.")),
		onSettled: () => {
			setActionLoading(false);
			void api.listTiers.invalidate();
		},
	});

	const deleteMutation = api.deleteTier.useMutation({
		onError: (err: Error) =>
			setError(extractError(err, "Failed to delete tier.")),
		onSettled: () => {
			setActionLoading(false);
			void api.listTiers.invalidate();
		},
	});

	function resetForm() {
		setShowForm(false);
		setEditingTier(null);
		setFormName("");
		setFormSlug("");
		setFormMinPoints("");
		setFormMultiplier("1");
		setError("");
	}

	function startEdit(tier: LoyaltyTier) {
		setEditingTier(tier);
		setFormName(tier.name);
		setFormSlug(tier.slug);
		setFormMinPoints(String(tier.minPoints));
		setFormMultiplier(String(tier.multiplier));
		setShowForm(true);
		setError("");
	}

	function handleSubmit() {
		if (!formName.trim()) {
			setError("Name is required.");
			return;
		}
		const minPoints = Number(formMinPoints);
		if (Number.isNaN(minPoints) || minPoints < 0) {
			setError("Min points must be a non-negative number.");
			return;
		}
		const multiplier = Number(formMultiplier);
		if (Number.isNaN(multiplier) || multiplier < 0) {
			setError("Multiplier must be a non-negative number.");
			return;
		}

		setActionLoading(true);
		setError("");

		if (editingTier) {
			updateMutation.mutate({
				params: { id: editingTier.id },
				body: {
					name: formName.trim(),
					minPoints: Math.floor(minPoints),
					multiplier,
				},
			});
		} else {
			const slug =
				formSlug.trim() ||
				formName
					.trim()
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, "-");
			if (!/^[a-z0-9-]+$/.test(slug)) {
				setError(
					"Slug must contain only lowercase letters, numbers, and hyphens.",
				);
				setActionLoading(false);
				return;
			}
			createMutation.mutate({
				body: {
					name: formName.trim(),
					slug,
					minPoints: Math.floor(minPoints),
					multiplier,
				},
			});
		}
	}

	function handleDelete(tier: LoyaltyTier) {
		setActionLoading(true);
		setError("");
		deleteMutation.mutate({ params: { id: tier.id } });
	}

	const tierRows =
		loading && tiers.length === 0 ? (
			Array.from({ length: 5 }, (_, i) => (
				<tr key={`sk-${i}`}>
					{Array.from({ length: 5 }, (_, j) => (
						<td key={`sk-cell-${j}`} className="px-4 py-3">
							<Skeleton className="h-4" />
						</td>
					))}
				</tr>
			))
		) : queryError ? (
			<tr>
				<td colSpan={5} className="px-4 py-8 text-center text-destructive">
					Failed to load tiers.
				</td>
			</tr>
		) : tiers.length === 0 ? (
			<tr>
				<td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
					No custom tiers configured. Default tiers (Bronze, Silver, Gold,
					Platinum) are used automatically.
				</td>
			</tr>
		) : (
			tiers.map((tier) => (
				<tr
					key={tier.id}
					className="border-border border-b last:border-0 hover:bg-muted/20"
				>
					<td className="px-4 py-3 font-medium text-foreground">{tier.name}</td>
					<td className="px-4 py-3">
						<code className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
							{tier.slug}
						</code>
					</td>
					<td className="px-4 py-3 text-foreground">
						{formatNumber(tier.minPoints)}
					</td>
					<td className="px-4 py-3 text-foreground">{tier.multiplier}x</td>
					<td className="px-4 py-3 text-right">
						<div className="flex justify-end gap-1">
							<button
								type="button"
								onClick={() => startEdit(tier)}
								className="rounded px-2 py-1 font-medium text-foreground text-xs hover:bg-muted"
							>
								Edit
							</button>
							<button
								type="button"
								disabled={actionLoading}
								onClick={() => handleDelete(tier)}
								className="rounded px-2 py-1 font-medium text-red-600 text-xs hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
							>
								Delete
							</button>
						</div>
					</td>
				</tr>
			))
		);

	const formSection = showForm ? (
		<div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
			<h4 className="font-medium text-foreground text-sm">
				{editingTier ? "Edit Tier" : "New Tier"}
			</h4>
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<label className="block">
					<span className="mb-1 block font-medium text-foreground text-sm">
						Name
					</span>
					<input
						type="text"
						value={formName}
						onChange={(e) => setFormName(e.target.value)}
						placeholder="e.g. Diamond"
						maxLength={100}
						className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</label>
				{!editingTier && (
					<label className="block">
						<span className="mb-1 block font-medium text-foreground text-sm">
							Slug
						</span>
						<input
							type="text"
							value={formSlug}
							onChange={(e) => setFormSlug(e.target.value)}
							placeholder="Auto-generated from name"
							maxLength={50}
							className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</label>
				)}
				<label className="block">
					<span className="mb-1 block font-medium text-foreground text-sm">
						Min Points
					</span>
					<input
						type="number"
						min="0"
						step="1"
						value={formMinPoints}
						onChange={(e) => setFormMinPoints(e.target.value)}
						placeholder="e.g. 10000"
						className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</label>
				<label className="block">
					<span className="mb-1 block font-medium text-foreground text-sm">
						Multiplier
					</span>
					<input
						type="number"
						min="0"
						step="0.1"
						value={formMultiplier}
						onChange={(e) => setFormMultiplier(e.target.value)}
						placeholder="1"
						className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</label>
			</div>
			<div className="flex gap-2">
				<button
					type="button"
					disabled={actionLoading}
					onClick={handleSubmit}
					className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
				>
					{actionLoading
						? "Saving..."
						: editingTier
							? "Update Tier"
							: "Create Tier"}
				</button>
				<button
					type="button"
					onClick={resetForm}
					className="rounded-lg border border-border px-4 py-2 font-medium text-foreground text-sm transition-colors hover:bg-muted"
				>
					Cancel
				</button>
			</div>
		</div>
	) : null;

	return (
		<LoyaltyTiersTemplate
			error={error}
			showForm={showForm}
			onShowForm={() => {
				resetForm();
				setShowForm(true);
			}}
			formSection={formSection}
			tierRows={tierRows}
		/>
	);
}
