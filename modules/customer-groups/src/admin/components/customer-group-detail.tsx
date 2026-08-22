"use client";

import { useEffect, useState } from "react";
import {
	type CustomerGroup,
	DeleteGroupModal,
	GroupForm,
	useGroupsApi,
} from "./_shared";

interface GroupMember {
	id: string;
	customerId: string;
	customerEmail?: string;
	customerName?: string;
	joinedAt: string;
	expiresAt?: string;
}

interface GroupPriceAdjustment {
	id: string;
	adjustmentType: "percentage" | "fixed";
	value: number;
	scope: "all" | "category" | "product";
	scopeId?: string;
}

function AddMemberForm({
	groupId,
	onSaved,
}: {
	groupId: string;
	onSaved: () => void;
}) {
	const api = useGroupsApi();
	const [customerId, setCustomerId] = useState("");
	const [expiresAt, setExpiresAt] = useState("");
	const [error, setError] = useState("");

	const addMutation = api.addMember.useMutation({
		onSuccess: () => {
			void api.listMembers.invalidate({ params: { id: groupId } });
			void api.get.invalidate({ params: { id: groupId } });
			setCustomerId("");
			setExpiresAt("");
			onSaved();
		},
		onError: (err: Error) => setError(err.message),
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		if (!customerId.trim()) {
			setError("Customer ID is required.");
			return;
		}
		addMutation.mutate({
			params: { id: groupId },
			customerId: customerId.trim(),
			expiresAt: expiresAt || undefined,
		});
	};

	return (
		<form onSubmit={handleSubmit} className="mt-3 flex flex-wrap gap-2">
			<input
				type="text"
				value={customerId}
				onChange={(e) => setCustomerId(e.target.value)}
				placeholder="Customer ID"
				className="h-8 flex-1 rounded-md border border-input bg-background px-2.5 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
			/>
			<input
				type="datetime-local"
				value={expiresAt}
				onChange={(e) => setExpiresAt(e.target.value)}
				title="Expiry (optional)"
				className="h-8 rounded-md border border-input bg-background px-2.5 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
			/>
			<button
				type="submit"
				disabled={addMutation.isPending}
				className="h-8 rounded-md bg-primary px-3 font-medium text-primary-foreground text-sm disabled:opacity-60"
			>
				{addMutation.isPending ? "Adding…" : "Add"}
			</button>
			{error && (
				<p className="w-full text-destructive text-xs" role="alert">
					{error}
				</p>
			)}
		</form>
	);
}

function AddPricingForm({
	groupId,
	onSaved,
}: {
	groupId: string;
	onSaved: () => void;
}) {
	const api = useGroupsApi();
	const [adjustmentType, setAdjustmentType] = useState<"percentage" | "fixed">(
		"percentage",
	);
	const [value, setValue] = useState("");
	const [scope, setScope] = useState<"all" | "category" | "product">("all");
	const [scopeId, setScopeId] = useState("");
	const [error, setError] = useState("");

	const setPricingMutation = api.setPricing.useMutation({
		onSuccess: () => {
			void api.listPricing.invalidate({ params: { id: groupId } });
			setValue("");
			setScopeId("");
			onSaved();
		},
		onError: (err: Error) => setError(err.message),
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		const numValue = parseFloat(value);
		if (Number.isNaN(numValue) || numValue <= 0) {
			setError("Value must be a positive number.");
			return;
		}
		if (scope !== "all" && !scopeId.trim()) {
			setError("Scope ID is required for category or product scope.");
			return;
		}
		setPricingMutation.mutate({
			params: { id: groupId },
			adjustmentType,
			value: numValue,
			scope,
			scopeId: scope !== "all" ? scopeId.trim() : undefined,
		});
	};

	return (
		<form onSubmit={handleSubmit} className="mt-3 space-y-2">
			<div className="flex flex-wrap gap-2">
				<select
					value={adjustmentType}
					onChange={(e) =>
						setAdjustmentType(e.target.value as "percentage" | "fixed")
					}
					className="h-8 rounded-md border border-input bg-background px-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
				>
					<option value="percentage">% off</option>
					<option value="fixed">Fixed off</option>
				</select>
				<input
					type="number"
					value={value}
					onChange={(e) => setValue(e.target.value)}
					placeholder={adjustmentType === "percentage" ? "10" : "500"}
					min="0.01"
					step="0.01"
					className="h-8 w-24 rounded-md border border-input bg-background px-2.5 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
				/>
				<select
					value={scope}
					onChange={(e) =>
						setScope(e.target.value as "all" | "category" | "product")
					}
					className="h-8 rounded-md border border-input bg-background px-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
				>
					<option value="all">All products</option>
					<option value="category">Category</option>
					<option value="product">Product</option>
				</select>
				{scope !== "all" && (
					<input
						type="text"
						value={scopeId}
						onChange={(e) => setScopeId(e.target.value)}
						placeholder={scope === "category" ? "Category ID" : "Product ID"}
						className="h-8 flex-1 rounded-md border border-input bg-background px-2.5 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
					/>
				)}
				<button
					type="submit"
					disabled={setPricingMutation.isPending}
					className="h-8 rounded-md bg-primary px-3 font-medium text-primary-foreground text-sm disabled:opacity-60"
				>
					{setPricingMutation.isPending ? "Adding…" : "Add"}
				</button>
			</div>
			{error && (
				<p className="text-destructive text-xs" role="alert">
					{error}
				</p>
			)}
		</form>
	);
}

export function CustomerGroupDetail({
	params,
}: {
	params?: Record<string, string>;
}) {
	const id = params?.id ?? "";
	const api = useGroupsApi();
	const [showEditForm, setShowEditForm] = useState(false);
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [showAddMember, setShowAddMember] = useState(false);
	const [showAddPricing, setShowAddPricing] = useState(false);
	const [removingMember, setRemovingMember] = useState<string | null>(null);
	const [removingPricing, setRemovingPricing] = useState<string | null>(null);

	useEffect(() => {
		if (!showDeleteModal) return;
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") setShowDeleteModal(false);
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [showDeleteModal]);

	const { data, isLoading } = api.get.useQuery({ params: { id } }) as {
		data: { group?: CustomerGroup } | undefined;
		isLoading: boolean;
	};

	const { data: membersData, refetch: refetchMembers } =
		api.listMembers.useQuery({ params: { id } }) as {
			data: { members?: GroupMember[] } | undefined;
			refetch: () => void;
		};

	const { data: pricingData, refetch: refetchPricing } =
		api.listPricing.useQuery({ params: { id } }) as {
			data: { adjustments?: GroupPriceAdjustment[] } | undefined;
			refetch: () => void;
		};

	const removeMemberMutation = api.removeMember.useMutation({
		onSuccess: () => {
			void api.listMembers.invalidate({ params: { id } });
			void api.get.invalidate({ params: { id } });
			setRemovingMember(null);
		},
		onError: () => setRemovingMember(null),
	});

	const removePricingMutation = api.removePricing.useMutation({
		onSuccess: () => {
			void api.listPricing.invalidate({ params: { id } });
			setRemovingPricing(null);
		},
		onError: () => setRemovingPricing(null),
	});

	const group = data?.group;
	const members = membersData?.members ?? [];
	const adjustments = pricingData?.adjustments ?? [];

	if (isLoading) {
		return (
			<div>
				<div className="mb-6">
					<a
						href="/admin/customer-groups"
						className="text-muted-foreground text-sm hover:text-foreground"
					>
						&larr; Back to Customer Groups
					</a>
				</div>
				<div className="space-y-4">
					{(["k0", "k1"] as const).map((key) => (
						<div
							key={key}
							className="h-32 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			</div>
		);
	}

	if (!group) {
		return (
			<div>
				<div className="mb-6">
					<a
						href="/admin/customer-groups"
						className="text-muted-foreground text-sm hover:text-foreground"
					>
						&larr; Back to Customer Groups
					</a>
				</div>
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">Group not found.</p>
				</div>
			</div>
		);
	}

	if (showEditForm) {
		return (
			<div>
				<div className="mb-6">
					<button
						type="button"
						onClick={() => setShowEditForm(false)}
						className="text-muted-foreground text-sm hover:text-foreground"
					>
						&larr; Back to {group.name}
					</button>
				</div>
				<GroupForm
					group={group}
					onSaved={() => {
						void api.get.invalidate({ params: { id } });
						setShowEditForm(false);
					}}
					onCancel={() => setShowEditForm(false)}
				/>
			</div>
		);
	}

	return (
		<div>
			<div className="mb-6">
				<a
					href="/admin/customer-groups"
					className="text-muted-foreground text-sm hover:text-foreground"
				>
					&larr; Back to Customer Groups
				</a>
			</div>

			{/* Header */}
			<div className="mb-6 flex flex-wrap items-start justify-between gap-4">
				<div>
					<div className="flex items-center gap-3">
						<h1 className="font-bold text-2xl text-foreground">{group.name}</h1>
						<span
							className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
								group.isAutomatic
									? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
									: "bg-muted text-muted-foreground"
							}`}
						>
							{group.isAutomatic ? "Automatic" : "Manual"}
						</span>
						{group.isActive === false && (
							<span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs">
								Inactive
							</span>
						)}
					</div>
					{group.description ? (
						<p className="mt-1 text-muted-foreground text-sm">
							{group.description}
						</p>
					) : null}
				</div>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={() => setShowEditForm(true)}
						className="rounded-lg border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted"
					>
						Edit
					</button>
					<button
						type="button"
						onClick={() => setShowDeleteModal(true)}
						className="rounded-lg border border-destructive/30 px-3 py-1.5 text-destructive text-sm hover:bg-destructive/10"
					>
						Delete
					</button>
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				{/* Left column */}
				<div className="space-y-6 lg:col-span-2">
					{/* Members */}
					<div className="rounded-lg border border-border bg-card">
						<div className="flex items-center justify-between border-border border-b px-4 py-3">
							<h2 className="font-semibold text-foreground text-sm">
								Members ({members.length})
							</h2>
							<button
								type="button"
								onClick={() => setShowAddMember((v) => !v)}
								className="text-muted-foreground text-xs hover:text-foreground"
							>
								{showAddMember ? "Cancel" : "+ Add member"}
							</button>
						</div>

						{showAddMember && (
							<div className="border-border border-b px-4 py-3">
								<AddMemberForm
									groupId={id}
									onSaved={() => {
										setShowAddMember(false);
										refetchMembers();
									}}
								/>
							</div>
						)}

						{members.length === 0 ? (
							<div className="p-4 text-center text-muted-foreground text-sm">
								No members in this group yet.
							</div>
						) : (
							<table className="w-full">
								<thead>
									<tr className="border-border border-b text-left">
										<th
											scope="col"
											className="px-4 py-2 font-medium text-muted-foreground text-xs"
										>
											Customer
										</th>
										<th
											scope="col"
											className="px-4 py-2 font-medium text-muted-foreground text-xs"
										>
											Joined
										</th>
										<th
											scope="col"
											className="px-4 py-2 font-medium text-muted-foreground text-xs"
										>
											Expires
										</th>
										<th scope="col" className="px-4 py-2" />
									</tr>
								</thead>
								<tbody className="divide-y divide-border">
									{members.map((m) => (
										<tr key={m.id}>
											<td className="px-4 py-2.5">
												<p className="font-medium text-foreground text-sm">
													{m.customerName ?? m.customerId}
												</p>
												{m.customerEmail ? (
													<p className="text-muted-foreground text-xs">
														{m.customerEmail}
													</p>
												) : null}
											</td>
											<td className="px-4 py-2.5 text-muted-foreground text-sm">
												{new Date(m.joinedAt).toLocaleDateString()}
											</td>
											<td className="px-4 py-2.5 text-muted-foreground text-sm">
												{m.expiresAt
													? new Date(m.expiresAt).toLocaleDateString()
													: "Never"}
											</td>
											<td className="px-4 py-2.5 text-right">
												<button
													type="button"
													disabled={removingMember === m.customerId}
													onClick={() => {
														setRemovingMember(m.customerId);
														removeMemberMutation.mutate({
															params: { id },
															customerId: m.customerId,
														});
													}}
													className="text-destructive text-xs hover:underline disabled:opacity-50"
												>
													{removingMember === m.customerId
														? "Removing…"
														: "Remove"}
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						)}
					</div>

					{/* Pricing adjustments */}
					<div className="rounded-lg border border-border bg-card">
						<div className="flex items-center justify-between border-border border-b px-4 py-3">
							<h2 className="font-semibold text-foreground text-sm">
								Pricing Adjustments ({adjustments.length})
							</h2>
							<button
								type="button"
								onClick={() => setShowAddPricing((v) => !v)}
								className="text-muted-foreground text-xs hover:text-foreground"
							>
								{showAddPricing ? "Cancel" : "+ Add adjustment"}
							</button>
						</div>

						{showAddPricing && (
							<div className="border-border border-b px-4 py-3">
								<AddPricingForm
									groupId={id}
									onSaved={() => {
										setShowAddPricing(false);
										refetchPricing();
									}}
								/>
							</div>
						)}

						{adjustments.length === 0 ? (
							<div className="p-4 text-center text-muted-foreground text-sm">
								No pricing adjustments. Add one to give this group discounts.
							</div>
						) : (
							<table className="w-full">
								<thead>
									<tr className="border-border border-b text-left">
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
											Scope
										</th>
										<th scope="col" className="px-4 py-2" />
									</tr>
								</thead>
								<tbody className="divide-y divide-border">
									{adjustments.map((adj) => (
										<tr key={adj.id}>
											<td className="px-4 py-2.5 font-medium text-foreground text-sm">
												{adj.adjustmentType === "percentage"
													? `${adj.value}% off`
													: `$${(adj.value / 100).toFixed(2)} off`}
											</td>
											<td className="px-4 py-2.5 text-muted-foreground text-sm capitalize">
												{adj.scope}
												{adj.scopeId ? `: ${adj.scopeId.slice(0, 8)}…` : ""}
											</td>
											<td className="px-4 py-2.5 text-right">
												<button
													type="button"
													disabled={removingPricing === adj.id}
													onClick={() => {
														setRemovingPricing(adj.id);
														removePricingMutation.mutate({
															params: { adjustmentId: adj.id },
														});
													}}
													className="text-destructive text-xs hover:underline disabled:opacity-50"
												>
													{removingPricing === adj.id ? "Removing…" : "Remove"}
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						)}
					</div>
				</div>

				{/* Right column — details */}
				<div className="space-y-6">
					<div className="rounded-lg border border-border bg-card p-4">
						<h3 className="mb-3 font-semibold text-foreground text-sm">
							Details
						</h3>
						<dl className="space-y-2 text-sm">
							<div>
								<dt className="text-muted-foreground">Slug</dt>
								<dd className="font-medium font-mono text-foreground">
									{group.slug}
								</dd>
							</div>
							{group.priority != null ? (
								<div>
									<dt className="text-muted-foreground">Priority</dt>
									<dd className="font-medium text-foreground">
										{group.priority}
									</dd>
								</div>
							) : null}
							<div>
								<dt className="text-muted-foreground">Members</dt>
								<dd className="font-medium text-foreground">
									{group.memberCount ?? members.length}
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Created</dt>
								<dd className="font-medium text-foreground">
									{new Date(group.createdAt).toLocaleDateString()}
								</dd>
							</div>
							{group.updatedAt ? (
								<div>
									<dt className="text-muted-foreground">Updated</dt>
									<dd className="font-medium text-foreground">
										{new Date(group.updatedAt).toLocaleDateString()}
									</dd>
								</div>
							) : null}
						</dl>
					</div>
				</div>
			</div>

			{showDeleteModal && (
				<DeleteGroupModal
					group={group}
					onClose={() => setShowDeleteModal(false)}
					onSuccess={() => {
						window.location.href = "/admin/customer-groups";
					}}
				/>
			)}
		</div>
	);
}
