"use client";

import { useEffect, useRef, useState } from "react";
import { useMembershipsApi } from "./_shared";

interface MembershipPlan {
	id: string;
	name: string;
	slug: string;
	description?: string;
	price: number;
	billingInterval: string;
	trialDays: number;
	features?: string[];
	isActive: boolean;
	maxMembers?: number;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

function PlanSheet({ plan, onSaved, onCancel }: PlanSheetProps) {
	const api = useMembershipsApi();
	const isEditing = !!plan;
	const firstInputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		firstInputRef.current?.focus();
	}, []);

	const [name, setName] = useState(plan?.name ?? "");
	const [slug, setSlug] = useState(plan?.slug ?? "");
	const [description, setDescription] = useState(plan?.description ?? "");
	const [price, setPrice] = useState(
		plan ? String((plan.price / 100).toFixed(2)) : "",
	);
	const [billingInterval, setBillingInterval] = useState(
		plan?.billingInterval ?? "monthly",
	);
	const [trialDays, setTrialDays] = useState(String(plan?.trialDays ?? 0));
	const [maxMembers, setMaxMembers] = useState(
		plan?.maxMembers ? String(plan.maxMembers) : "",
	);
	const [features, setFeatures] = useState(
		plan?.features ? plan.features.join(", ") : "",
	);
	const [isActive, setIsActive] = useState(plan?.isActive ?? true);
	const [error, setError] = useState("");

	const createMutation = api.createPlan.useMutation({
		onSuccess: () => {
			void api.listPlans.invalidate();
			onSaved();
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	const updateMutation = api.updatePlan.useMutation({
		onSuccess: () => {
			void api.listPlans.invalidate();
			onSaved();
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");

		if (!name.trim()) {
			setError("Plan name is required.");
			return;
		}

		const parsedPrice = Math.round(Number.parseFloat(price) * 100);
		if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
			setError("Enter a valid price.");
			return;
		}

		const parsedTrialDays = Number.parseInt(trialDays, 10) || 0;
		const parsedMaxMembers = maxMembers.trim()
			? Number.parseInt(maxMembers, 10)
			: undefined;
		const parsedFeatures = features.trim()
			? features
					.split(",")
					.map((f) => f.trim())
					.filter(Boolean)
			: undefined;

		const autoSlug = name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "");

		if (isEditing) {
			updateMutation.mutate({
				params: { id: plan.id },
				body: {
					name: name.trim(),
					slug: slug.trim() || autoSlug,
					description: description.trim() || null,
					price: parsedPrice,
					billingInterval: billingInterval as "monthly" | "yearly" | "lifetime",
					trialDays: parsedTrialDays,
					isActive,
					...(parsedMaxMembers != null ? { maxMembers: parsedMaxMembers } : {}),
					...(parsedFeatures != null ? { features: parsedFeatures } : {}),
				},
			});
		} else {
			createMutation.mutate({
				body: {
					name: name.trim(),
					slug: slug.trim() || autoSlug,
					description: description.trim() || undefined,
					price: parsedPrice,
					billingInterval: billingInterval as "monthly" | "yearly" | "lifetime",
					trialDays: parsedTrialDays,
					...(parsedMaxMembers != null ? { maxMembers: parsedMaxMembers } : {}),
					...(parsedFeatures != null ? { features: parsedFeatures } : {}),
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
				className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-border border-l bg-background shadow-2xl"
			>
				{/* Header */}
				<div className="flex shrink-0 items-center justify-between border-border border-b px-6 py-4">
					<h2 className="font-semibold text-foreground text-lg">
						{isEditing ? "Edit Plan" : "New Plan"}
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

				{/* Body */}
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
						<div className="grid gap-4 sm:grid-cols-2">
							<div>
								<label htmlFor="ps-name" className={labelCls}>
									Name <span className="text-destructive">*</span>
								</label>
								<input
									ref={firstInputRef}
									id="ps-name"
									className={inputCls}
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="Premium"
								/>
							</div>
							<div>
								<label htmlFor="ps-slug" className={labelCls}>
									Slug
								</label>
								<input
									id="ps-slug"
									className={inputCls}
									value={slug}
									onChange={(e) => setSlug(e.target.value)}
									placeholder="premium"
								/>
							</div>
						</div>

						<div className="grid gap-4 sm:grid-cols-3">
							<div>
								<label htmlFor="ps-price" className={labelCls}>
									Price ($) <span className="text-destructive">*</span>
								</label>
								<input
									id="ps-price"
									type="number"
									step="0.01"
									min="0"
									className={inputCls}
									value={price}
									onChange={(e) => setPrice(e.target.value)}
									placeholder="9.99"
								/>
							</div>
							<div>
								<label htmlFor="ps-interval" className={labelCls}>
									Billing
								</label>
								<select
									id="ps-interval"
									className={inputCls}
									value={billingInterval}
									onChange={(e) => setBillingInterval(e.target.value)}
								>
									<option value="monthly">Monthly</option>
									<option value="yearly">Yearly</option>
									<option value="lifetime">Lifetime</option>
								</select>
							</div>
							<div>
								<label htmlFor="ps-trial" className={labelCls}>
									Trial days
								</label>
								<input
									id="ps-trial"
									type="number"
									min="0"
									className={inputCls}
									value={trialDays}
									onChange={(e) => setTrialDays(e.target.value)}
									placeholder="0"
								/>
							</div>
						</div>

						<div>
							<label htmlFor="ps-description" className={labelCls}>
								Description
							</label>
							<input
								id="ps-description"
								className={inputCls}
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="What's included in this plan"
							/>
						</div>

						<div>
							<label htmlFor="ps-features" className={labelCls}>
								Features{" "}
								<span className="font-normal text-muted-foreground">
									(comma-separated)
								</span>
							</label>
							<input
								id="ps-features"
								className={inputCls}
								value={features}
								onChange={(e) => setFeatures(e.target.value)}
								placeholder="Unlimited orders, Priority support"
							/>
						</div>

						<div>
							<label htmlFor="ps-maxmembers" className={labelCls}>
								Max members{" "}
								<span className="font-normal text-muted-foreground">
									(leave blank for unlimited)
								</span>
							</label>
							<input
								id="ps-maxmembers"
								type="number"
								min="1"
								className={inputCls}
								value={maxMembers}
								onChange={(e) => setMaxMembers(e.target.value)}
								placeholder="Unlimited"
							/>
						</div>

						{isEditing ? (
							<label className="flex cursor-pointer items-center gap-3">
								<input
									type="checkbox"
									checked={isActive}
									onChange={(e) => setIsActive(e.target.checked)}
									className="h-4 w-4 rounded border-border accent-foreground"
								/>
								<span className="text-foreground text-sm">Active</span>
							</label>
						) : null}
					</div>

					{/* Footer */}
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
									: "Creating..."
								: isEditing
									? "Save Changes"
									: "Create Plan"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

const PLAN_SKELETON_IDS = ["a", "b", "c"] as const;

function formatCurrency(amount: number) {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: "USD",
	}).format(amount / 100);
}

const INTERVAL_LABELS: Record<string, string> = {
	monthly: "Monthly",
	yearly: "Yearly",
	lifetime: "Lifetime",
};

interface PlanSheetProps {
	plan?: MembershipPlan;
	onSaved: () => void;
	onCancel: () => void;
}

function extractError(err: unknown): string {
	if (err && typeof err === "object" && "message" in err) {
		return String((err as { message: string }).message);
	}
	return "An unexpected error occurred";
}

const labelCls = "mb-1 block font-medium text-foreground text-sm";

const inputCls =
	"w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:opacity-50";

export function MembershipPlans() {
	const api = useMembershipsApi();
	const [showCreate, setShowCreate] = useState(false);
	const [editPlan, setEditPlan] = useState<MembershipPlan | null>(null);

	const anyModalOpen = showCreate || !!editPlan;
	useEffect(() => {
		if (!anyModalOpen) return;
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") {
				setShowCreate(false);
				setEditPlan(null);
			}
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [anyModalOpen]);

	const { data, isLoading } = api.listPlans.useQuery({}) as {
		data: { plans?: MembershipPlan[]; total?: number } | undefined;
		isLoading: boolean;
	};

	const deleteMutation = api.deletePlan.useMutation({
		onSuccess: () => void api.listPlans.invalidate(),
	}) as {
		mutate: (opts: { params: { id: string } }) => void;
		isPending: boolean;
	};

	const plans = data?.plans ?? [];

	const handleDelete = (plan: MembershipPlan) => {
		if (
			!confirm(
				`Delete plan "${plan.name}"? Active subscribers will not be affected, but new signups will be disabled.`,
			)
		)
			return;
		deleteMutation.mutate({ params: { id: plan.id } });
	};

	return (
		<div>
			{/* Sheet overlays */}
			{showCreate ? (
				<PlanSheet
					onSaved={() => setShowCreate(false)}
					onCancel={() => setShowCreate(false)}
				/>
			) : null}
			{editPlan ? (
				<PlanSheet
					plan={editPlan}
					onSaved={() => setEditPlan(null)}
					onCancel={() => setEditPlan(null)}
				/>
			) : null}

			{/* Header */}
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground">
						Membership Plans
					</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Create and manage subscription plans
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowCreate(true)}
					className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90"
				>
					Create Plan
				</button>
			</div>

			{/* Plan list */}
			{isLoading ? (
				<div className="space-y-3">
					{PLAN_SKELETON_IDS.map((id) => (
						<div
							key={`plan-skel-${id}`}
							className="h-20 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : plans.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-10 text-center">
					<p className="font-medium text-foreground text-sm">No plans yet</p>
					<p className="mt-1 text-muted-foreground text-xs">
						Create a plan to start accepting memberships
					</p>
					<button
						type="button"
						onClick={() => setShowCreate(true)}
						className="mt-4 rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90"
					>
						Create Plan
					</button>
				</div>
			) : (
				<div className="space-y-3">
					{plans.map((plan) => (
						<div
							key={plan.id}
							className="rounded-lg border border-border bg-card p-4"
						>
							<div className="flex items-start justify-between gap-4">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<p className="font-medium text-foreground text-sm">
											{plan.name}
										</p>
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
												plan.isActive
													? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
													: "bg-muted text-muted-foreground"
											}`}
										>
											{plan.isActive ? "Active" : "Inactive"}
										</span>
									</div>
									<div className="mt-1.5 flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
										<span>{formatCurrency(plan.price)}</span>
										<span>
											{INTERVAL_LABELS[plan.billingInterval] ??
												plan.billingInterval}
										</span>
										{plan.trialDays > 0 ? (
											<span>{plan.trialDays}-day trial</span>
										) : null}
										{plan.maxMembers ? (
											<span>Max {plan.maxMembers} members</span>
										) : null}
										{plan.description ? <span>{plan.description}</span> : null}
									</div>
									{plan.features && plan.features.length > 0 ? (
										<div className="mt-2 flex flex-wrap gap-1">
											{plan.features.map((f) => (
												<span
													key={f}
													className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs"
												>
													{f}
												</span>
											))}
										</div>
									) : null}
								</div>
								<div className="flex gap-1">
									<button
										type="button"
										onClick={() => setEditPlan(plan)}
										className="rounded px-2 py-1 text-xs hover:bg-muted"
									>
										Edit
									</button>
									<button
										type="button"
										onClick={() => handleDelete(plan)}
										disabled={deleteMutation.isPending}
										className="rounded px-2 py-1 text-red-600 text-xs hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
									>
										Delete
									</button>
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
