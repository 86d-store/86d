"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import CustomerDetailTemplate from "./customer-detail.mdx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Customer {
	id: string;
	email: string;
	firstName?: string | null;
	lastName?: string | null;
	phone?: string | null;
	dateOfBirth?: string | null;
	tags?: string[] | null;
	metadata?: Record<string, unknown> | null;
	createdAt: string;
	updatedAt: string;
}

interface CustomerAddress {
	id: string;
	customerId: string;
	type: "billing" | "shipping";
	firstName: string;
	lastName: string;
	company?: string | null;
	line1: string;
	line2?: string | null;
	city: string;
	state: string;
	postalCode: string;
	country: string;
	phone?: string | null;
	isDefault: boolean;
}

interface GetCustomerResult {
	customer?: Customer;
	addresses?: CustomerAddress[];
	error?: string;
}

// ─── Module Client ───────────────────────────────────────────────────────────

function useCustomersAdminApi() {
	const client = useModuleClient();
	return {
		getCustomer: client.module("customers").admin["/admin/customers/:id"],
		updateCustomer:
			client.module("customers").admin["/admin/customers/:id/update"],
		deleteCustomer:
			client.module("customers").admin["/admin/customers/:id/delete"],
		addTags: client.module("customers").admin["/admin/customers/:id/tags"],
		removeTags:
			client.module("customers").admin["/admin/customers/:id/tags/remove"],
		createAddress:
			client.module("customers").admin["/admin/customers/:id/addresses/create"],
		updateAddress:
			client.module("customers").admin[
				"/admin/customers/:id/addresses/:addressId/update"
			],
		deleteAddress:
			client.module("customers").admin[
				"/admin/customers/:id/addresses/:addressId/delete"
			],
		setDefaultAddress:
			client.module("customers").admin[
				"/admin/customers/:id/addresses/:addressId/set-default"
			],
	};
}

// ─── Address Form State ───────────────────────────────────────────────────────

interface AddressFormValues {
	type: "billing" | "shipping";
	firstName: string;
	lastName: string;
	company: string;
	line1: string;
	line2: string;
	city: string;
	state: string;
	postalCode: string;
	country: string;
	phone: string;
	isDefault: boolean;
}

const emptyAddressForm: AddressFormValues = {
	type: "shipping",
	firstName: "",
	lastName: "",
	company: "",
	line1: "",
	line2: "",
	city: "",
	state: "",
	postalCode: "",
	country: "US",
	phone: "",
	isDefault: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(iso));
}

function formatDateTime(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(iso));
}

function formatAddress(addr: CustomerAddress): string {
	const parts = [addr.line1];
	if (addr.line2) parts.push(addr.line2);
	parts.push(`${addr.city}, ${addr.state} ${addr.postalCode}`);
	parts.push(addr.country);
	return parts.join(", ");
}

// ─── CustomerDetail ──────────────────────────────────────────────────────────

interface CustomerDetailProps {
	customerId?: string;
	params?: Record<string, string>;
}

export function CustomerDetail(props: CustomerDetailProps) {
	const customerId = props.customerId ?? props.params?.id;
	const api = useCustomersAdminApi();
	const [editing, setEditing] = useState(false);
	const [editForm, setEditForm] = useState({
		firstName: "",
		lastName: "",
		phone: "",
	});
	const [newTag, setNewTag] = useState("");
	const [addressEditId, setAddressEditId] = useState<string | null>(null);
	const [addressFormOpen, setAddressFormOpen] = useState(false);
	const [addressForm, setAddressForm] =
		useState<AddressFormValues>(emptyAddressForm);

	const { data: customerData, isLoading: loading } = api.getCustomer.useQuery(
		{ params: { id: customerId ?? "" } },
		{ enabled: !!customerId },
	) as {
		data: GetCustomerResult | undefined;
		isLoading: boolean;
	};

	const updateMutation = api.updateCustomer.useMutation({
		onSuccess: () => {
			setEditing(false);
			void api.getCustomer.invalidate();
		},
	});

	const deleteMutation = api.deleteCustomer.useMutation({
		onSuccess: () => {
			window.location.href = "/admin/customers";
		},
	});

	const addTagMutation = api.addTags.useMutation({
		onSuccess: () => {
			setNewTag("");
			void api.getCustomer.invalidate();
		},
	});

	const removeTagMutation = api.removeTags.useMutation({
		onSuccess: () => {
			void api.getCustomer.invalidate();
		},
	});

	const createAddressMutation = api.createAddress.useMutation({
		onSuccess: () => {
			setAddressFormOpen(false);
			setAddressEditId(null);
			setAddressForm(emptyAddressForm);
			void api.getCustomer.invalidate();
		},
	});

	const updateAddressMutation = api.updateAddress.useMutation({
		onSuccess: () => {
			setAddressFormOpen(false);
			setAddressEditId(null);
			setAddressForm(emptyAddressForm);
			void api.getCustomer.invalidate();
		},
	});

	const deleteAddressMutation = api.deleteAddress.useMutation({
		onSuccess: () => void api.getCustomer.invalidate(),
	});

	const setDefaultAddressMutation = api.setDefaultAddress.useMutation({
		onSuccess: () => void api.getCustomer.invalidate(),
	});

	const customer = customerData?.customer ?? null;
	const addresses = customerData?.addresses ?? [];

	const startEditing = () => {
		if (!customer) return;
		setEditForm({
			firstName: customer.firstName ?? "",
			lastName: customer.lastName ?? "",
			phone: customer.phone ?? "",
		});
		setEditing(true);
	};

	const handleUpdate = (e: React.FormEvent) => {
		e.preventDefault();
		updateMutation.mutate({
			params: { id: customerId },
			firstName: editForm.firstName || undefined,
			lastName: editForm.lastName || undefined,
			phone: editForm.phone || null,
		});
	};

	const handleDelete = () => {
		if (
			!window.confirm(
				"Are you sure you want to delete this customer? This cannot be undone.",
			)
		) {
			return;
		}
		deleteMutation.mutate({ params: { id: customerId } });
	};

	const handleAddTag = () => {
		const tag = newTag.trim();
		if (!tag || !customerId) return;
		addTagMutation.mutate({ params: { id: customerId }, tags: [tag] });
	};

	const handleRemoveTag = (tag: string) => {
		if (!customerId) return;
		removeTagMutation.mutate({ params: { id: customerId }, tags: [tag] });
	};

	const openAddAddress = () => {
		setAddressEditId(null);
		setAddressForm(emptyAddressForm);
		setAddressFormOpen(true);
	};

	const openEditAddress = (addr: CustomerAddress) => {
		setAddressEditId(addr.id);
		setAddressForm({
			type: addr.type,
			firstName: addr.firstName,
			lastName: addr.lastName,
			company: addr.company ?? "",
			line1: addr.line1,
			line2: addr.line2 ?? "",
			city: addr.city,
			state: addr.state,
			postalCode: addr.postalCode,
			country: addr.country,
			phone: addr.phone ?? "",
			isDefault: addr.isDefault,
		});
		setAddressFormOpen(true);
	};

	const handleAddressSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!customerId) return;
		const payload = {
			...addressForm,
			company: addressForm.company || undefined,
			line2: addressForm.line2 || undefined,
			phone: addressForm.phone || undefined,
		};
		if (addressEditId) {
			updateAddressMutation.mutate({
				params: { customerId, addressId: addressEditId },
				...payload,
			});
		} else {
			createAddressMutation.mutate({
				params: { customerId },
				...payload,
			});
		}
	};

	if (!customerId) {
		return (
			<div className="rounded-md border border-border bg-muted/30 p-4 text-muted-foreground">
				<p className="font-medium">Customer not found</p>
				<p className="mt-1 text-sm">No customer ID was provided.</p>
				<a
					href="/admin/customers"
					className="mt-3 inline-block text-sm underline"
				>
					Back to customers
				</a>
			</div>
		);
	}

	// Loading skeleton
	if (loading) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div className="h-7 w-48 animate-pulse rounded bg-muted" />
					<div className="flex gap-2">
						<div className="h-9 w-16 animate-pulse rounded-md bg-muted" />
						<div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
					</div>
				</div>
				<div className="grid gap-6 lg:grid-cols-3">
					<div className="space-y-4 lg:col-span-2">
						<div className="h-48 animate-pulse rounded-lg bg-muted" />
					</div>
					<div className="space-y-4">
						<div className="h-32 animate-pulse rounded-lg bg-muted" />
					</div>
				</div>
			</div>
		);
	}

	if (!customer) {
		return (
			<div className="flex flex-col items-center justify-center py-20 text-center">
				<p className="font-medium text-base text-foreground">
					Customer not found
				</p>
				<a
					href="/admin/customers"
					className="mt-3 text-foreground text-sm underline underline-offset-2"
				>
					Back to customers
				</a>
			</div>
		);
	}

	const fullName =
		[customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
		"Unnamed";

	const billingAddresses = addresses.filter((a) => a.type === "billing");
	const shippingAddresses = addresses.filter((a) => a.type === "shipping");

	const content = (
		<div>
			{/* Header */}
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="font-semibold text-foreground text-lg">{fullName}</h1>
					<p className="text-muted-foreground text-sm">{customer.email}</p>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={startEditing}
						className="rounded-md border border-border px-4 py-2 font-medium text-foreground text-sm transition-colors hover:bg-muted"
					>
						Edit
					</button>
					<button
						type="button"
						onClick={handleDelete}
						disabled={deleteMutation.isPending}
						className="rounded-md border border-destructive/50 px-4 py-2 font-medium text-destructive text-sm transition-colors hover:bg-destructive/10 disabled:opacity-50"
					>
						{deleteMutation.isPending ? "Deleting..." : "Delete"}
					</button>
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				{/* Main column */}
				<div className="space-y-5 lg:col-span-2">
					{/* Edit form */}
					{editing && (
						<div className="rounded-lg border border-border bg-card p-5">
							<h2 className="mb-4 font-semibold text-foreground text-sm">
								Edit Customer
							</h2>
							<form
								onSubmit={(e) => void handleUpdate(e)}
								className="space-y-4"
							>
								<div className="grid gap-4 sm:grid-cols-2">
									<label className="block">
										<span className="mb-1 block font-medium text-foreground text-xs">
											First name
										</span>
										<input
											type="text"
											value={editForm.firstName}
											onChange={(e) =>
												setEditForm((f) => ({
													...f,
													firstName: e.target.value,
												}))
											}
											className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:border-foreground/30 focus:outline-none focus:ring-1 focus:ring-foreground/30"
										/>
									</label>
									<label className="block">
										<span className="mb-1 block font-medium text-foreground text-xs">
											Last name
										</span>
										<input
											type="text"
											value={editForm.lastName}
											onChange={(e) =>
												setEditForm((f) => ({
													...f,
													lastName: e.target.value,
												}))
											}
											className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:border-foreground/30 focus:outline-none focus:ring-1 focus:ring-foreground/30"
										/>
									</label>
								</div>
								<label className="block">
									<span className="mb-1 block font-medium text-foreground text-xs">
										Phone
									</span>
									<input
										type="tel"
										value={editForm.phone}
										onChange={(e) =>
											setEditForm((f) => ({
												...f,
												phone: e.target.value,
											}))
										}
										className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:border-foreground/30 focus:outline-none focus:ring-1 focus:ring-foreground/30"
									/>
								</label>
								<div className="flex justify-end gap-2 border-border/40 border-t pt-4">
									<button
										type="button"
										onClick={() => setEditing(false)}
										className="rounded-md border border-border px-4 py-2 font-medium text-foreground text-sm hover:bg-muted"
									>
										Cancel
									</button>
									<button
										type="submit"
										disabled={updateMutation.isPending}
										className="rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
									>
										{updateMutation.isPending ? "Saving..." : "Save changes"}
									</button>
								</div>
							</form>
						</div>
					)}

					{/* Tags */}
					<div className="rounded-lg border border-border bg-card p-5">
						<h2 className="mb-4 font-semibold text-foreground text-sm">Tags</h2>
						<div className="flex flex-wrap gap-2">
							{(customer.tags ?? []).map((tag) => (
								<span
									key={tag}
									className="inline-flex items-center gap-1 rounded-full bg-foreground/10 px-2.5 py-1 font-medium text-foreground text-xs"
								>
									{tag}
									<button
										type="button"
										onClick={() => handleRemoveTag(tag)}
										disabled={removeTagMutation.isPending}
										className="ml-0.5 rounded-full p-0.5 text-foreground/60 hover:bg-foreground/10 hover:text-foreground"
										aria-label={`Remove tag ${tag}`}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="12"
											height="12"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
											strokeLinecap="round"
											strokeLinejoin="round"
											aria-hidden="true"
										>
											<line x1="18" x2="6" y1="6" y2="18" />
											<line x1="6" x2="18" y1="6" y2="18" />
										</svg>
									</button>
								</span>
							))}
							{(customer.tags ?? []).length === 0 && (
								<p className="text-muted-foreground text-sm">No tags</p>
							)}
						</div>
						<div className="mt-3 flex items-center gap-2">
							<input
								type="text"
								value={newTag}
								onChange={(e) => setNewTag(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										handleAddTag();
									}
								}}
								placeholder="Add a tag…"
								className="h-8 w-40 rounded-md border border-border bg-background px-2.5 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
							/>
							<button
								type="button"
								onClick={handleAddTag}
								disabled={!newTag.trim() || addTagMutation.isPending}
								className="h-8 rounded-md bg-foreground px-3 font-medium text-background text-xs hover:opacity-90 disabled:opacity-50"
							>
								Add
							</button>
						</div>
					</div>

					{/* Addresses */}
					<div className="rounded-lg border border-border bg-card p-5">
						<div className="mb-4 flex items-center justify-between">
							<h2 className="font-semibold text-foreground text-sm">
								Addresses ({addresses.length})
							</h2>
							<button
								type="button"
								onClick={openAddAddress}
								className="rounded-md border border-border px-3 py-1.5 font-medium text-foreground text-xs transition-colors hover:bg-muted"
							>
								+ Add address
							</button>
						</div>

						{/* Address form (create / edit) */}
						{addressFormOpen && (
							<form
								onSubmit={(e) => void handleAddressSubmit(e)}
								className="mb-4 space-y-3 rounded-md border border-border bg-muted/30 p-4"
							>
								<p className="font-semibold text-foreground text-sm">
									{addressEditId ? "Edit address" : "Add address"}
								</p>
								<div className="grid gap-3 sm:grid-cols-2">
									<div>
										<label
											htmlFor="addr-type"
											className="mb-1 block font-medium text-foreground text-xs"
										>
											Type
										</label>
										<select
											id="addr-type"
											value={addressForm.type}
											onChange={(e) =>
												setAddressForm((f) => ({
													...f,
													type: e.target.value as "billing" | "shipping",
												}))
											}
											className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
										>
											<option value="shipping">Shipping</option>
											<option value="billing">Billing</option>
										</select>
									</div>
									<div className="flex items-end">
										<label
											htmlFor="addr-default"
											className="flex cursor-pointer items-center gap-2 text-foreground text-sm"
										>
											<input
												id="addr-default"
												type="checkbox"
												checked={addressForm.isDefault}
												onChange={(e) =>
													setAddressForm((f) => ({
														...f,
														isDefault: e.target.checked,
													}))
												}
												className="rounded"
											/>
											Set as default
										</label>
									</div>
								</div>
								<div className="grid gap-3 sm:grid-cols-2">
									{(
										[
											["firstName", "First name"],
											["lastName", "Last name"],
										] as const
									).map(([field, label]) => (
										<div key={field}>
											<label
												htmlFor={`addr-${field}`}
												className="mb-1 block font-medium text-foreground text-xs"
											>
												{label}
											</label>
											<input
												id={`addr-${field}`}
												type="text"
												value={addressForm[field]}
												onChange={(e) =>
													setAddressForm((f) => ({
														...f,
														[field]: e.target.value,
													}))
												}
												required
												className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
											/>
										</div>
									))}
								</div>
								<div>
									<label
										htmlFor="addr-company"
										className="mb-1 block font-medium text-foreground text-xs"
									>
										Company (optional)
									</label>
									<input
										id="addr-company"
										type="text"
										value={addressForm.company}
										onChange={(e) =>
											setAddressForm((f) => ({
												...f,
												company: e.target.value,
											}))
										}
										className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
									/>
								</div>
								<div>
									<label
										htmlFor="addr-line1"
										className="mb-1 block font-medium text-foreground text-xs"
									>
										Address line 1
									</label>
									<input
										id="addr-line1"
										type="text"
										value={addressForm.line1}
										onChange={(e) =>
											setAddressForm((f) => ({ ...f, line1: e.target.value }))
										}
										required
										className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
									/>
								</div>
								<div>
									<label
										htmlFor="addr-line2"
										className="mb-1 block font-medium text-foreground text-xs"
									>
										Address line 2 (optional)
									</label>
									<input
										id="addr-line2"
										type="text"
										value={addressForm.line2}
										onChange={(e) =>
											setAddressForm((f) => ({ ...f, line2: e.target.value }))
										}
										className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
									/>
								</div>
								<div className="grid gap-3 sm:grid-cols-3">
									<div>
										<label
											htmlFor="addr-city"
											className="mb-1 block font-medium text-foreground text-xs"
										>
											City
										</label>
										<input
											id="addr-city"
											type="text"
											value={addressForm.city}
											onChange={(e) =>
												setAddressForm((f) => ({
													...f,
													city: e.target.value,
												}))
											}
											required
											className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
										/>
									</div>
									<div>
										<label
											htmlFor="addr-state"
											className="mb-1 block font-medium text-foreground text-xs"
										>
											State / Province
										</label>
										<input
											id="addr-state"
											type="text"
											value={addressForm.state}
											onChange={(e) =>
												setAddressForm((f) => ({
													...f,
													state: e.target.value,
												}))
											}
											required
											className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
										/>
									</div>
									<div>
										<label
											htmlFor="addr-postal"
											className="mb-1 block font-medium text-foreground text-xs"
										>
											Postal code
										</label>
										<input
											id="addr-postal"
											type="text"
											value={addressForm.postalCode}
											onChange={(e) =>
												setAddressForm((f) => ({
													...f,
													postalCode: e.target.value,
												}))
											}
											required
											className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
										/>
									</div>
								</div>
								<div className="grid gap-3 sm:grid-cols-2">
									<div>
										<label
											htmlFor="addr-country"
											className="mb-1 block font-medium text-foreground text-xs"
										>
											Country (2-letter code)
										</label>
										<input
											id="addr-country"
											type="text"
											value={addressForm.country}
											onChange={(e) =>
												setAddressForm((f) => ({
													...f,
													country: e.target.value.toUpperCase().slice(0, 2),
												}))
											}
											required
											maxLength={2}
											className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-foreground text-sm uppercase focus:outline-none focus:ring-1 focus:ring-ring"
										/>
									</div>
									<div>
										<label
											htmlFor="addr-phone"
											className="mb-1 block font-medium text-foreground text-xs"
										>
											Phone (optional)
										</label>
										<input
											id="addr-phone"
											type="tel"
											value={addressForm.phone}
											onChange={(e) =>
												setAddressForm((f) => ({
													...f,
													phone: e.target.value,
												}))
											}
											className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
										/>
									</div>
								</div>
								<div className="flex gap-2">
									<button
										type="submit"
										disabled={
											createAddressMutation.isPending ||
											updateAddressMutation.isPending
										}
										className="rounded-md bg-foreground px-4 py-1.5 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
									>
										{createAddressMutation.isPending ||
										updateAddressMutation.isPending
											? "Saving…"
											: addressEditId
												? "Save changes"
												: "Add address"}
									</button>
									<button
										type="button"
										onClick={() => {
											setAddressFormOpen(false);
											setAddressEditId(null);
											setAddressForm(emptyAddressForm);
										}}
										className="rounded-md border border-border px-4 py-1.5 font-medium text-foreground text-sm hover:bg-muted"
									>
										Cancel
									</button>
								</div>
							</form>
						)}

						{addresses.length === 0 && !addressFormOpen ? (
							<p className="py-4 text-center text-muted-foreground text-sm">
								No addresses on file
							</p>
						) : (
							<div className="space-y-4">
								{shippingAddresses.length > 0 && (
									<div>
										<h3 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
											Shipping
										</h3>
										<div className="space-y-2">
											{shippingAddresses.map((addr) => (
												<AddressCard
													key={addr.id}
													address={addr}
													customerId={customerId ?? ""}
													onEdit={() => openEditAddress(addr)}
													onDelete={() => {
														if (window.confirm("Delete this address?")) {
															deleteAddressMutation.mutate({
																params: {
																	customerId: customerId ?? "",
																	addressId: addr.id,
																},
															});
														}
													}}
													onSetDefault={() => {
														setDefaultAddressMutation.mutate({
															params: {
																customerId: customerId ?? "",
																addressId: addr.id,
															},
														});
													}}
													isDeleting={deleteAddressMutation.isPending}
													isSettingDefault={setDefaultAddressMutation.isPending}
												/>
											))}
										</div>
									</div>
								)}
								{billingAddresses.length > 0 && (
									<div>
										<h3 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
											Billing
										</h3>
										<div className="space-y-2">
											{billingAddresses.map((addr) => (
												<AddressCard
													key={addr.id}
													address={addr}
													customerId={customerId ?? ""}
													onEdit={() => openEditAddress(addr)}
													onDelete={() => {
														if (window.confirm("Delete this address?")) {
															deleteAddressMutation.mutate({
																params: {
																	customerId: customerId ?? "",
																	addressId: addr.id,
																},
															});
														}
													}}
													onSetDefault={() => {
														setDefaultAddressMutation.mutate({
															params: {
																customerId: customerId ?? "",
																addressId: addr.id,
															},
														});
													}}
													isDeleting={deleteAddressMutation.isPending}
													isSettingDefault={setDefaultAddressMutation.isPending}
												/>
											))}
										</div>
									</div>
								)}
							</div>
						)}
					</div>

					{/* Metadata */}
					{customer.metadata && Object.keys(customer.metadata).length > 0 && (
						<div className="rounded-lg border border-border bg-card p-5">
							<h2 className="mb-4 font-semibold text-foreground text-sm">
								Metadata
							</h2>
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-border border-b">
											<th
												scope="col"
												className="pb-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider"
											>
												Key
											</th>
											<th
												scope="col"
												className="pb-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider"
											>
												Value
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border">
										{Object.entries(customer.metadata).map(([key, value]) => (
											<tr key={key}>
												<td className="py-2 font-mono text-foreground text-xs">
													{key}
												</td>
												<td className="py-2 text-muted-foreground text-xs">
													{typeof value === "string"
														? value
														: JSON.stringify(value)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					)}
				</div>

				{/* Sidebar */}
				<div className="space-y-5">
					{/* Details */}
					<div className="rounded-lg border border-border bg-card p-5">
						<h2 className="mb-4 font-semibold text-foreground text-sm">
							Details
						</h2>
						<dl className="space-y-3">
							<div>
								<dt className="font-medium text-muted-foreground text-xs">
									Email
								</dt>
								<dd className="mt-0.5 text-foreground text-sm">
									{customer.email}
								</dd>
							</div>
							{customer.phone && (
								<div>
									<dt className="font-medium text-muted-foreground text-xs">
										Phone
									</dt>
									<dd className="mt-0.5 text-foreground text-sm">
										{customer.phone}
									</dd>
								</div>
							)}
							{customer.dateOfBirth && (
								<div>
									<dt className="font-medium text-muted-foreground text-xs">
										Date of birth
									</dt>
									<dd className="mt-0.5 text-foreground text-sm">
										{formatDate(customer.dateOfBirth)}
									</dd>
								</div>
							)}
							<div>
								<dt className="font-medium text-muted-foreground text-xs">
									Joined
								</dt>
								<dd className="mt-0.5 text-foreground text-sm">
									{formatDateTime(customer.createdAt)}
								</dd>
							</div>
							<div>
								<dt className="font-medium text-muted-foreground text-xs">
									Last updated
								</dt>
								<dd className="mt-0.5 text-foreground text-sm">
									{formatDateTime(customer.updatedAt)}
								</dd>
							</div>
						</dl>
					</div>

					{/* Quick stats */}
					<div className="rounded-lg border border-border bg-card p-5">
						<h2 className="mb-4 font-semibold text-foreground text-sm">
							Summary
						</h2>
						<dl className="space-y-3">
							<div>
								<dt className="font-medium text-muted-foreground text-xs">
									Addresses
								</dt>
								<dd className="mt-0.5 text-foreground text-sm">
									{addresses.length}
								</dd>
							</div>
							<div>
								<dt className="font-medium text-muted-foreground text-xs">
									Customer ID
								</dt>
								<dd className="mt-0.5 font-mono text-foreground text-xs">
									{customer.id}
								</dd>
							</div>
						</dl>
					</div>
				</div>
			</div>
		</div>
	);

	return <CustomerDetailTemplate content={content} />;
}

// ─── AddressCard ──────────────────────────────────────────────────────────────

interface AddressCardProps {
	address: CustomerAddress;
	customerId: string;
	onEdit: () => void;
	onDelete: () => void;
	onSetDefault: () => void;
	isDeleting: boolean;
	isSettingDefault: boolean;
}

function AddressCard({
	address,
	onEdit,
	onDelete,
	onSetDefault,
	isDeleting,
	isSettingDefault,
}: AddressCardProps) {
	return (
		<div className="rounded-md border border-border bg-muted/30 p-3">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1 text-foreground text-sm">
					<p className="font-medium">
						{address.firstName} {address.lastName}
					</p>
					{address.company && (
						<p className="text-muted-foreground text-xs">{address.company}</p>
					)}
					<p className="mt-1 text-muted-foreground text-xs">
						{formatAddress(address)}
					</p>
					{address.phone && (
						<p className="mt-0.5 text-muted-foreground text-xs">
							{address.phone}
						</p>
					)}
				</div>
				<div className="flex shrink-0 flex-col items-end gap-1.5">
					{address.isDefault ? (
						<span className="rounded-full bg-foreground/10 px-2 py-0.5 font-medium text-foreground text-xs">
							Default
						</span>
					) : (
						<button
							type="button"
							onClick={onSetDefault}
							disabled={isSettingDefault}
							className="rounded px-2 py-0.5 text-muted-foreground text-xs transition-colors hover:text-foreground disabled:opacity-50"
						>
							Set default
						</button>
					)}
					<div className="flex gap-1">
						<button
							type="button"
							onClick={onEdit}
							className="rounded px-2 py-0.5 font-medium text-foreground text-xs transition-colors hover:bg-muted"
						>
							Edit
						</button>
						<button
							type="button"
							onClick={onDelete}
							disabled={isDeleting}
							className="rounded px-2 py-0.5 font-medium text-destructive text-xs transition-colors hover:bg-destructive/10 disabled:opacity-50"
						>
							Delete
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
