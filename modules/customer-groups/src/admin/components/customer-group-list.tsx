"use client";

import { useEffect, useState } from "react";
import {
	type CustomerGroup,
	DeleteGroupModal,
	GroupForm,
	useGroupsApi,
} from "./_shared";

export function CustomerGroupList() {
	const api = useGroupsApi();
	const [deleteTarget, setDeleteTarget] = useState<CustomerGroup | null>(null);
	const [editTarget, setEditTarget] = useState<CustomerGroup | null>(null);
	const [showCreateForm, setShowCreateForm] = useState(false);

	const anyModalOpen = !!deleteTarget || showCreateForm;
	useEffect(() => {
		if (!anyModalOpen) return;
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") {
				setDeleteTarget(null);
				setShowCreateForm(false);
			}
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [anyModalOpen]);

	const {
		data,
		isLoading,
		isError: groupsError,
		refetch: refetchGroups,
	} = api.list.useQuery({}) as {
		data: { groups?: CustomerGroup[] } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const groups = data?.groups ?? [];

	if (groupsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load customer groups
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchGroups()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	if (showCreateForm || editTarget) {
		return (
			<GroupForm
				{...(editTarget ? { group: editTarget } : {})}
				onSaved={() => {
					setShowCreateForm(false);
					setEditTarget(null);
				}}
				onCancel={() => {
					setShowCreateForm(false);
					setEditTarget(null);
				}}
			/>
		);
	}

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground">
						Customer Groups
					</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Segment customers into groups for targeted pricing and promotions
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowCreateForm(true)}
					className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90"
				>
					New group
				</button>
			</div>

			{isLoading ? (
				<div className="space-y-3">
					{(["k0", "k1", "k2"] as const).map((key) => (
						<div
							key={key}
							className="h-16 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : groups.length === 0 ? (
				<div className="rounded-lg border border-border border-dashed bg-card p-12 text-center">
					<p className="font-medium text-foreground text-sm">
						No customer groups yet
					</p>
					<p className="mt-1 text-muted-foreground text-sm">
						Groups let you segment customers for targeted promotions and
						pricing.
					</p>
					<button
						type="button"
						onClick={() => setShowCreateForm(true)}
						className="mt-4 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground text-sm"
					>
						Create your first group
					</button>
				</div>
			) : (
				<div className="rounded-lg border border-border bg-card">
					<table className="w-full">
						<thead>
							<tr className="border-border border-b text-left">
								<th
									scope="col"
									className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Group
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Type
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Members
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Status
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-right font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{groups.map((group) => (
								<tr key={group.id} className="hover:bg-muted/50">
									<td className="px-4 py-3">
										<a
											href={`/admin/customer-groups/${group.id}`}
											className="font-medium text-foreground text-sm hover:underline"
										>
											{group.name}
										</a>
										{group.description ? (
											<p className="text-muted-foreground text-xs">
												{group.description}
											</p>
										) : null}
									</td>
									<td className="px-4 py-3">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
												group.isAutomatic
													? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
													: "bg-muted text-muted-foreground"
											}`}
										>
											{group.isAutomatic ? "Automatic" : "Manual"}
										</span>
									</td>
									<td className="px-4 py-3 text-muted-foreground text-sm">
										{group.memberCount ?? 0}
									</td>
									<td className="px-4 py-3">
										{group.isActive === false ? (
											<span className="text-muted-foreground text-xs">
												Inactive
											</span>
										) : (
											<span className="text-green-600 text-xs dark:text-green-400">
												Active
											</span>
										)}
									</td>
									<td className="px-4 py-3 text-right">
										<div className="flex justify-end gap-1">
											<button
												type="button"
												onClick={() => setEditTarget(group)}
												className="rounded-md px-2 py-1 text-foreground text-xs hover:bg-muted"
											>
												Edit
											</button>
											<button
												type="button"
												onClick={() => setDeleteTarget(group)}
												className="rounded-md px-2 py-1 text-destructive text-xs hover:bg-destructive/10"
											>
												Delete
											</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{deleteTarget && (
				<DeleteGroupModal
					group={deleteTarget}
					onClose={() => setDeleteTarget(null)}
					onSuccess={() => setDeleteTarget(null)}
				/>
			)}
		</div>
	);
}
