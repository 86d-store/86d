"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";

export function useGroupsApi() {
	const client = useModuleClient();
	return {
		list: client.module("customer-groups").admin["/admin/customer-groups"],
		create:
			client.module("customer-groups").admin["/admin/customer-groups/create"],
		get: client.module("customer-groups").admin["/admin/customer-groups/:id"],
		update:
			client.module("customer-groups").admin[
				"/admin/customer-groups/:id/update"
			],
		delete:
			client.module("customer-groups").admin[
				"/admin/customer-groups/:id/delete"
			],
		listMembers:
			client.module("customer-groups").admin[
				"/admin/customer-groups/:id/members"
			],
		addMember:
			client.module("customer-groups").admin[
				"/admin/customer-groups/:id/members/add"
			],
		removeMember:
			client.module("customer-groups").admin[
				"/admin/customer-groups/:id/members/remove"
			],
		listPricing:
			client.module("customer-groups").admin[
				"/admin/customer-groups/:id/pricing/list"
			],
		setPricing:
			client.module("customer-groups").admin[
				"/admin/customer-groups/:id/pricing"
			],
		removePricing:
			client.module("customer-groups").admin[
				"/admin/customer-groups/pricing/:adjustmentId/remove"
			],
	};
}

export interface CustomerGroup {
	id: string;
	name: string;
	slug: string;
	description?: string;
	type?: string;
	isActive?: boolean;
	priority?: number;
	memberCount?: number;
	isAutomatic: boolean;
	createdAt: string;
	updatedAt?: string;
}

export function GroupForm({
	group,
	onSaved,
	onCancel,
}: {
	group?: CustomerGroup;
	onSaved: () => void;
	onCancel: () => void;
}) {
	const api = useGroupsApi();
	const isEditing = !!group;

	const [name, setName] = useState(group?.name ?? "");
	const [slug, setSlug] = useState(group?.slug ?? "");
	const [slugDirty, setSlugDirty] = useState(isEditing);
	const [description, setDescription] = useState(group?.description ?? "");
	const [type, setType] = useState<"manual" | "automatic">(
		group?.isAutomatic ? "automatic" : "manual",
	);
	const [isActive, setIsActive] = useState(group?.isActive ?? true);
	const [priority, setPriority] = useState(String(group?.priority ?? 0));
	const [error, setError] = useState("");

	const createMutation = api.create.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			onSaved();
		},
		onError: (err: Error) => setError(err.message),
	});

	const updateMutation = api.update.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			void api.get.invalidate({ params: { id: group?.id ?? "" } });
			onSaved();
		},
		onError: (err: Error) => setError(err.message),
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	const handleNameChange = (value: string) => {
		setName(value);
		if (!slugDirty) {
			setSlug(slugify(value));
		}
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		if (!name.trim()) {
			setError("Name is required.");
			return;
		}
		if (!slug.trim()) {
			setError("Slug is required.");
			return;
		}

		if (isEditing && group) {
			updateMutation.mutate({
				params: { id: group.id },
				name: name.trim(),
				slug: slug.trim(),
				description: description.trim() || undefined,
				type,
				isActive,
				priority: Number(priority) || 0,
			});
		} else {
			createMutation.mutate({
				name: name.trim(),
				slug: slug.trim(),
				description: description.trim() || undefined,
				type,
				priority: Number(priority) || 0,
			});
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-5">
			<div className="flex items-center justify-between">
				<h2 className="font-bold text-foreground text-xl">
					{isEditing ? "Edit Group" : "New Group"}
				</h2>
				<button
					type="button"
					onClick={onCancel}
					className="text-muted-foreground text-sm hover:text-foreground"
				>
					Cancel
				</button>
			</div>

			<div>
				<label htmlFor="group-name" className={labelCls}>
					Name <span className="text-destructive">*</span>
				</label>
				<input
					id="group-name"
					type="text"
					required
					value={name}
					onChange={(e) => handleNameChange(e.target.value)}
					placeholder="VIP Customers"
					className={inputCls}
				/>
			</div>

			<div>
				<label htmlFor="group-slug" className={labelCls}>
					Slug <span className="text-destructive">*</span>
				</label>
				<input
					id="group-slug"
					type="text"
					required
					value={slug}
					onChange={(e) => {
						setSlug(e.target.value);
						setSlugDirty(true);
					}}
					placeholder="vip-customers"
					className={inputCls}
				/>
			</div>

			<div>
				<label htmlFor="group-desc" className={labelCls}>
					Description
				</label>
				<textarea
					id="group-desc"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					placeholder="A brief description of this group..."
					rows={3}
					className={inputCls}
				/>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				<div>
					<label htmlFor="group-type" className={labelCls}>
						Type
					</label>
					<select
						id="group-type"
						value={type}
						onChange={(e) => setType(e.target.value as "manual" | "automatic")}
						className={inputCls}
					>
						<option value="manual">Manual — assign members explicitly</option>
						<option value="automatic">Automatic — rule-based membership</option>
					</select>
				</div>
				<div>
					<label htmlFor="group-priority" className={labelCls}>
						Priority
					</label>
					<input
						id="group-priority"
						type="number"
						min="0"
						max="10000"
						value={priority}
						onChange={(e) => setPriority(e.target.value)}
						className={inputCls}
					/>
					<p className="mt-1 text-muted-foreground text-xs">
						Higher priority groups apply first.
					</p>
				</div>
			</div>

			{isEditing && (
				<div className="flex items-center gap-2">
					<input
						id="group-active"
						type="checkbox"
						checked={isActive}
						onChange={(e) => setIsActive(e.target.checked)}
						className="h-4 w-4 rounded border-border"
					/>
					<label htmlFor="group-active" className="text-foreground text-sm">
						Active
					</label>
				</div>
			)}

			{error && (
				<p className="text-destructive text-sm" role="alert">
					{error}
				</p>
			)}

			<div className="flex gap-2">
				<button
					type="submit"
					disabled={isPending}
					className="rounded-lg bg-primary px-5 py-2 font-medium text-primary-foreground text-sm transition-opacity disabled:opacity-60"
				>
					{isPending ? "Saving…" : isEditing ? "Update Group" : "Create Group"}
				</button>
				<button
					type="button"
					onClick={onCancel}
					className="rounded-lg border border-border px-5 py-2 font-medium text-foreground text-sm hover:bg-muted"
				>
					Cancel
				</button>
			</div>
		</form>
	);
}

export function DeleteGroupModal({
	group,
	onClose,
	onSuccess,
}: {
	group: CustomerGroup;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const api = useGroupsApi();
	const cancelRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		cancelRef.current?.focus();
	}, []);

	const deleteMutation = api.delete.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			onSuccess();
		},
	});

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div
				role="dialog"
				aria-modal="true"
				className="w-full max-w-sm rounded-xl border border-border bg-card shadow-xl"
			>
				<div className="px-6 py-5">
					<h2 className="font-semibold text-foreground text-lg">
						Delete group?
					</h2>
					<p className="mt-2 text-muted-foreground text-sm">
						<span className="font-medium text-foreground">{group.name}</span>{" "}
						and all its memberships and pricing rules will be permanently
						deleted.
					</p>
					<div className="mt-5 flex justify-end gap-2">
						<button
							ref={cancelRef}
							type="button"
							onClick={onClose}
							className="rounded-md border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={() =>
								deleteMutation.mutate({ params: { id: group.id } })
							}
							disabled={deleteMutation.isPending}
							className="rounded-md bg-destructive px-4 py-2 font-medium text-destructive-foreground text-sm hover:bg-destructive/90 disabled:opacity-50"
						>
							{deleteMutation.isPending ? "Deleting…" : "Delete"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

export function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

export const labelCls = "mb-1 block font-medium text-foreground text-sm";

export const inputCls =
	"w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1";
