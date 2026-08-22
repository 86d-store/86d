"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";
import NavigationAdminTemplate from "./navigation-admin.mdx";

interface MenuData {
	id: string;
	name: string;
	slug: string;
	location: string;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

interface MenuItemData {
	id: string;
	menuId: string;
	parentId?: string | null;
	label: string;
	type: string;
	url?: string | null;
	resourceId?: string | null;
	openInNewTab: boolean;
	cssClass?: string | null;
	position: number;
	isVisible: boolean;
	children?: MenuItemData[];
}

interface MenuWithItemsData extends MenuData {
	items: MenuItemData[];
}

const LOCATION_LABELS: Record<string, string> = {
	header: "Header",
	footer: "Footer",
	sidebar: "Sidebar",
	mobile: "Mobile",
	custom: "Custom",
};

function Skeleton({ className = "" }: { className?: string }) {
	return (
		<div
			className={`animate-pulse rounded bg-muted ${className}`}
			aria-hidden="true"
		/>
	);
}

function useNavigationAdminApi() {
	const client = useModuleClient();
	return {
		listMenus: client.module("navigation").admin["/admin/navigation/menus"],
		getMenu: client.module("navigation").admin["/admin/navigation/menus/:id"],
		createMenu:
			client.module("navigation").admin["/admin/navigation/menus/create"],
		updateMenu:
			client.module("navigation").admin["/admin/navigation/menus/:id/update"],
		deleteMenu:
			client.module("navigation").admin["/admin/navigation/menus/:id/delete"],
		createItem:
			client.module("navigation").admin["/admin/navigation/items/create"],
		updateItem:
			client.module("navigation").admin["/admin/navigation/items/:id/update"],
		deleteItem:
			client.module("navigation").admin["/admin/navigation/items/:id/delete"],
		reorderItems:
			client.module("navigation").admin[
				"/admin/navigation/menus/:menuId/reorder"
			],
	};
}

function DeleteModal({
	menu,
	onClose,
	onSuccess,
}: {
	menu: MenuData;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const cancelRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		cancelRef.current?.focus();
	}, []);
	useEffect(() => {
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [onClose]);
	const api = useNavigationAdminApi();

	const deleteMutation = api.deleteMenu.useMutation({
		onSuccess: () => {
			void api.listMenus.invalidate();
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
						Delete menu?
					</h2>
					<p className="mt-2 text-muted-foreground text-sm">
						<span className="font-medium text-foreground">{menu.name}</span> and
						all its items will be permanently deleted.
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
								deleteMutation.mutate({
									params: { id: menu.id },
								})
							}
							disabled={deleteMutation.isPending}
							className="rounded-md bg-destructive px-4 py-2 font-medium text-destructive-foreground text-sm hover:bg-destructive/90 disabled:opacity-50"
						>
							{deleteMutation.isPending ? "Deleting\u2026" : "Delete"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

function MenuForm({
	menu,
	onSaved,
	onCancel,
}: {
	menu?: MenuData | undefined;
	onSaved: () => void;
	onCancel: () => void;
}) {
	const api = useNavigationAdminApi();
	const isEditing = !!menu;

	const [name, setName] = useState(menu?.name ?? "");
	const [slug, setSlug] = useState(menu?.slug ?? "");
	const [location, setLocation] = useState(menu?.location ?? "header");
	const [isActive, setIsActive] = useState(menu?.isActive ?? true);
	const [error, setError] = useState("");

	const createMutation = api.createMenu.useMutation({
		onSuccess: () => {
			void api.listMenus.invalidate();
			onSaved();
		},
		onError: () => setError("Failed to create menu."),
	});

	const updateMutation = api.updateMenu.useMutation({
		onSuccess: () => {
			void api.listMenus.invalidate();
			onSaved();
		},
		onError: () => setError("Failed to update menu."),
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		const payload = {
			name,
			...(slug.trim() ? { slug: slug.trim() } : {}),
			location,
			isActive,
		};

		if (isEditing && menu) {
			updateMutation.mutate({ params: { id: menu.id }, ...payload });
		} else {
			createMutation.mutate(payload);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-5">
			<div className="flex items-center justify-between">
				<h2 className="font-bold text-foreground text-xl">
					{isEditing ? "Edit Menu" : "New Menu"}
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
				<label
					htmlFor="menu-name"
					className="mb-1 block font-medium text-foreground text-sm"
				>
					Name <span className="text-destructive">*</span>
				</label>
				<input
					id="menu-name"
					type="text"
					required
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Main Navigation"
					className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1"
				/>
			</div>

			<div>
				<label
					htmlFor="menu-slug"
					className="mb-1 block font-medium text-foreground text-sm"
				>
					Slug
				</label>
				<input
					id="menu-slug"
					type="text"
					value={slug}
					onChange={(e) => setSlug(e.target.value)}
					placeholder="main-navigation (auto-generated if blank)"
					className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1"
				/>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				<div>
					<label
						htmlFor="menu-location"
						className="mb-1 block font-medium text-foreground text-sm"
					>
						Location
					</label>
					<select
						id="menu-location"
						value={location}
						onChange={(e) => setLocation(e.target.value)}
						className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<option value="header">Header</option>
						<option value="footer">Footer</option>
						<option value="sidebar">Sidebar</option>
						<option value="mobile">Mobile</option>
						<option value="custom">Custom</option>
					</select>
				</div>
				<div className="flex items-end pb-1">
					<label className="flex items-center gap-2 text-foreground text-sm">
						<input
							type="checkbox"
							checked={isActive}
							onChange={(e) => setIsActive(e.target.checked)}
							className="h-4 w-4 rounded border-border"
						/>
						Active
					</label>
				</div>
			</div>

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
					{isPending
						? "Saving\u2026"
						: isEditing
							? "Update Menu"
							: "Create Menu"}
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

function MenuDetail({
	menuId,
	onBack,
}: {
	menuId: string;
	onBack: () => void;
}) {
	const api = useNavigationAdminApi();
	const [addingItem, setAddingItem] = useState(false);
	const [editingItem, setEditingItem] = useState<MenuItemData | null>(null);

	const { data } = api.getMenu.useQuery({ params: { id: menuId } }) as {
		data: { menu: MenuWithItemsData | null } | undefined;
	};

	const menu = data?.menu;

	const createMutation = api.createItem.useMutation({
		onSuccess: () => {
			void api.getMenu.invalidate();
			setAddingItem(false);
		},
	});

	const updateMutation = api.updateItem.useMutation({
		onSuccess: () => {
			void api.getMenu.invalidate();
			setEditingItem(null);
		},
	});

	const deleteMutation = api.deleteItem.useMutation({
		onSuccess: () => {
			void api.getMenu.invalidate();
		},
	});

	if (!menu) {
		return (
			<div className="divide-y divide-border">
				{Array.from({ length: 6 }, (_, i) => `skel-${i}`).map((key) => (
					<div key={key} className="px-4 py-2.5">
						<Skeleton className="h-4 w-1/3" />
					</div>
				))}
			</div>
		);
	}

	const renderItems = (items: MenuItemData[], depth = 0) =>
		items.map((item) => (
			<div key={item.id}>
				<div
					className="flex items-center gap-2 border-border border-b px-4 py-2.5 transition-colors hover:bg-muted/30"
					style={{ paddingLeft: `${16 + depth * 24}px` }}
				>
					<span className="flex-1 text-foreground text-sm">{item.label}</span>
					<span className="text-muted-foreground text-xs">{item.type}</span>
					{item.url && (
						<span className="max-w-32 truncate text-muted-foreground text-xs">
							{item.url}
						</span>
					)}
					<button
						type="button"
						onClick={() => setEditingItem(item)}
						className="rounded-md px-2 py-1 text-foreground text-xs hover:bg-muted"
					>
						Edit
					</button>
					<button
						type="button"
						onClick={() =>
							deleteMutation.mutate({
								params: { id: item.id },
							})
						}
						className="rounded-md px-2 py-1 text-destructive text-xs hover:bg-destructive/10"
					>
						Delete
					</button>
				</div>
				{item.children &&
					item.children.length > 0 &&
					renderItems(item.children, depth + 1)}
			</div>
		));

	return (
		<div>
			<div className="mb-4 flex items-center gap-3">
				<button
					type="button"
					onClick={onBack}
					className="text-muted-foreground text-sm hover:text-foreground"
				>
					&larr; Back
				</button>
				<h2 className="font-bold text-foreground text-xl">{menu.name}</h2>
				<span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
					{LOCATION_LABELS[menu.location] ?? menu.location}
				</span>
			</div>

			{(addingItem || editingItem) && (
				<ItemForm
					menuId={menuId}
					item={editingItem ?? undefined}
					onSave={(payload) => {
						if (editingItem) {
							updateMutation.mutate({
								params: { id: editingItem.id },
								...payload,
							});
						} else {
							createMutation.mutate({
								menuId,
								...payload,
							});
						}
					}}
					onCancel={() => {
						setAddingItem(false);
						setEditingItem(null);
					}}
					isPending={createMutation.isPending || updateMutation.isPending}
				/>
			)}

			{!addingItem && !editingItem && (
				<button
					type="button"
					onClick={() => setAddingItem(true)}
					className="mb-4 flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
				>
					Add Item
				</button>
			)}

			<div className="overflow-hidden rounded-lg border border-border bg-card">
				{menu.items.length === 0 ? (
					<div className="px-4 py-12 text-center">
						<p className="font-medium text-foreground text-sm">No items yet</p>
						<p className="mt-1 text-muted-foreground text-xs">
							Add menu items to build your navigation.
						</p>
					</div>
				) : (
					renderItems(menu.items)
				)}
			</div>
		</div>
	);
}

function ItemForm({
	menuId,
	item,
	onSave,
	onCancel,
	isPending,
}: {
	menuId: string;
	item?: MenuItemData | undefined;
	onSave: (payload: Record<string, unknown>) => void;
	onCancel: () => void;
	isPending: boolean;
}) {
	const isEditing = !!item;
	const [label, setLabel] = useState(item?.label ?? "");
	const [type, setType] = useState(item?.type ?? "link");
	const [url, setUrl] = useState(item?.url ?? "");
	const [resourceId, setResourceId] = useState(item?.resourceId ?? "");
	const [openInNewTab, setOpenInNewTab] = useState(item?.openInNewTab ?? false);
	const [position, setPosition] = useState(String(item?.position ?? 0));

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		onSave({
			label,
			type,
			...(url.trim() ? { url: url.trim() } : {}),
			...(resourceId.trim() ? { resourceId: resourceId.trim() } : {}),
			openInNewTab,
			position: Number(position) || 0,
		});
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="mb-4 space-y-4 rounded-lg border border-border bg-card p-4"
		>
			<h3 className="font-semibold text-foreground text-sm">
				{isEditing ? "Edit Item" : "Add Item"}
			</h3>

			<div className="grid gap-3 sm:grid-cols-2">
				<div>
					<label
						htmlFor={`item-label-${menuId}`}
						className="mb-1 block text-foreground text-xs"
					>
						Label <span className="text-destructive">*</span>
					</label>
					<input
						id={`item-label-${menuId}`}
						type="text"
						required
						value={label}
						onChange={(e) => setLabel(e.target.value)}
						placeholder="Shop"
						className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>
				<div>
					<label
						htmlFor={`item-type-${menuId}`}
						className="mb-1 block text-foreground text-xs"
					>
						Type
					</label>
					<select
						id={`item-type-${menuId}`}
						value={type}
						onChange={(e) => setType(e.target.value)}
						className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<option value="link">Link</option>
						<option value="category">Category</option>
						<option value="collection">Collection</option>
						<option value="page">Page</option>
						<option value="product">Product</option>
					</select>
				</div>
			</div>

			<div className="grid gap-3 sm:grid-cols-2">
				<div>
					<label
						htmlFor={`item-url-${menuId}`}
						className="mb-1 block text-foreground text-xs"
					>
						URL
					</label>
					<input
						id={`item-url-${menuId}`}
						type="text"
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						placeholder="/products"
						className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>
				<div>
					<label
						htmlFor={`item-resource-${menuId}`}
						className="mb-1 block text-foreground text-xs"
					>
						Resource ID
					</label>
					<input
						id={`item-resource-${menuId}`}
						type="text"
						value={resourceId}
						onChange={(e) => setResourceId(e.target.value)}
						placeholder="category or collection ID"
						className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>
			</div>

			<div className="grid gap-3 sm:grid-cols-2">
				<div>
					<label
						htmlFor={`item-pos-${menuId}`}
						className="mb-1 block text-foreground text-xs"
					>
						Position
					</label>
					<input
						id={`item-pos-${menuId}`}
						type="number"
						min="0"
						value={position}
						onChange={(e) => setPosition(e.target.value)}
						className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>
				<div className="flex items-end pb-1">
					<label className="flex items-center gap-2 text-foreground text-sm">
						<input
							type="checkbox"
							checked={openInNewTab}
							onChange={(e) => setOpenInNewTab(e.target.checked)}
							className="h-4 w-4 rounded border-border"
						/>
						Open in new tab
					</label>
				</div>
			</div>

			<div className="flex gap-2">
				<button
					type="submit"
					disabled={isPending}
					className="rounded-lg bg-primary px-4 py-1.5 font-medium text-primary-foreground text-sm disabled:opacity-60"
				>
					{isPending ? "Saving\u2026" : isEditing ? "Update" : "Add"}
				</button>
				<button
					type="button"
					onClick={onCancel}
					className="rounded-lg border border-border px-4 py-1.5 text-foreground text-sm hover:bg-muted"
				>
					Cancel
				</button>
			</div>
		</form>
	);
}

export function NavigationAdmin() {
	const api = useNavigationAdminApi();
	const [locationFilter, setLocationFilter] = useState("");
	const [deleteTarget, setDeleteTarget] = useState<MenuData | null>(null);
	const [editTarget, setEditTarget] = useState<MenuData | null>(null);
	const [showCreateForm, setShowCreateForm] = useState(false);
	const [detailMenuId, setDetailMenuId] = useState<string | null>(null);

	const queryInput: Record<string, string> = {};
	if (locationFilter) queryInput.location = locationFilter;

	const {
		data,
		isLoading: loading,
		isError: menusError,
		refetch: refetchMenus,
	} = api.listMenus.useQuery(queryInput) as {
		data: { menus: MenuData[] } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const menus = data?.menus ?? [];

	if (detailMenuId) {
		return (
			<MenuDetail menuId={detailMenuId} onBack={() => setDetailMenuId(null)} />
		);
	}

	if (showCreateForm || editTarget) {
		return (
			<MenuForm
				menu={editTarget ?? undefined}
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

	if (menusError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load navigation menus
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchMenus()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const subtitle = `${menus.length} ${menus.length === 1 ? "menu" : "menus"}`;

	const tableBody = loading ? (
		(["k0", "k1", "k2"] as const).map((key) => (
			<tr key={key}>
				{(["k0", "k1", "k2", "k3", "k4"] as const).map((key) => (
					<td key={key} className="px-4 py-3">
						<div className="h-4 w-24 animate-pulse rounded bg-muted" />
					</td>
				))}
			</tr>
		))
	) : menus.length === 0 ? (
		<tr>
			<td colSpan={5} className="px-4 py-12 text-center">
				<p className="font-medium text-foreground text-sm">No menus found</p>
				<p className="mt-1 text-muted-foreground text-xs">
					Create your first menu to define store navigation.
				</p>
			</td>
		</tr>
	) : (
		menus.map((m) => (
			<tr key={m.id} className="transition-colors hover:bg-muted/30">
				<td className="px-4 py-3">
					<button
						type="button"
						onClick={() => setDetailMenuId(m.id)}
						className="font-medium text-foreground text-sm hover:underline"
					>
						{m.name}
					</button>
					<p className="text-muted-foreground text-xs">{m.slug}</p>
				</td>
				<td className="px-4 py-3">
					<span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
						{LOCATION_LABELS[m.location] ?? m.location}
					</span>
				</td>
				<td className="hidden px-4 py-3 md:table-cell">
					{m.isActive ? (
						<span className="text-green-600 text-sm dark:text-green-400">
							Active
						</span>
					) : (
						<span className="text-muted-foreground text-sm">Inactive</span>
					)}
				</td>
				<td className="hidden px-4 py-3 text-right text-muted-foreground text-sm lg:table-cell">
					&mdash;
				</td>
				<td className="px-4 py-3 text-right">
					<div className="flex justify-end gap-1">
						<button
							type="button"
							onClick={() => setDetailMenuId(m.id)}
							className="rounded-md px-2 py-1 text-foreground text-xs hover:bg-muted"
						>
							Items
						</button>
						<button
							type="button"
							onClick={() => setEditTarget(m)}
							className="rounded-md px-2 py-1 text-foreground text-xs hover:bg-muted"
						>
							Edit
						</button>
						<button
							type="button"
							onClick={() => setDeleteTarget(m)}
							className="rounded-md px-2 py-1 text-destructive text-xs hover:bg-destructive/10"
						>
							Delete
						</button>
					</div>
				</td>
			</tr>
		))
	);

	return (
		<NavigationAdminTemplate
			subtitle={subtitle}
			onNewMenu={() => setShowCreateForm(true)}
			locationFilter={locationFilter}
			onLocationFilterChange={(v: string) => setLocationFilter(v)}
			tableBody={tableBody}
			deleteModal={
				deleteTarget ? (
					<DeleteModal
						menu={deleteTarget}
						onClose={() => setDeleteTarget(null)}
						onSuccess={() => setDeleteTarget(null)}
					/>
				) : null
			}
		/>
	);
}
