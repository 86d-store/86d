"use client";

import { useState } from "react";
import { useAddressApi } from "./_hooks";
import AddressBookTemplate from "./address-book.mdx";

interface Address {
	id: string;
	customerId: string;
	label?: string;
	firstName: string;
	lastName: string;
	company?: string;
	line1: string;
	line2?: string;
	city: string;
	state?: string;
	postalCode: string;
	country: string;
	phone?: string;
	isDefault: boolean;
	isDefaultBilling: boolean;
	createdAt: string;
	updatedAt: string;
}

interface AddressForm {
	label: string;
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
}

const emptyForm: AddressForm = {
	label: "",
	firstName: "",
	lastName: "",
	company: "",
	line1: "",
	line2: "",
	city: "",
	state: "",
	postalCode: "",
	country: "",
	phone: "",
};

function extractError(error: Error | null, fallback: string): string {
	if (!error) return fallback;
	const body = (
		error as Error & { body?: { error?: string | { message?: string } } }
	).body;
	if (typeof body?.error === "string") return body.error;
	if (typeof body?.error?.message === "string") return body.error.message;
	return fallback;
}

export function AddressBook({
	customerId,
}: {
	customerId?: string | undefined;
}) {
	const api = useAddressApi();
	const [showForm, setShowForm] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<AddressForm>(emptyForm);
	const [error, setError] = useState("");
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const { data, isLoading: loading } = customerId
		? (api.listAddresses.useQuery({}) as {
				data: { items: Address[]; total: number } | undefined;
				isLoading: boolean;
			})
		: { data: undefined, isLoading: false };

	const items = data?.items ?? [];

	const createMutation = api.createAddress.useMutation({
		onSuccess: () => {
			setShowForm(false);
			setForm(emptyForm);
			setError("");
			void api.listAddresses.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to create address."));
		},
	});

	const updateMutation = api.updateAddress.useMutation({
		onSuccess: () => {
			setEditingId(null);
			setForm(emptyForm);
			setError("");
			void api.listAddresses.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to update address."));
		},
	});

	const deleteMutation = api.deleteAddress.useMutation({
		onSuccess: () => {
			setDeletingId(null);
			setError("");
			void api.listAddresses.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to delete address."));
		},
	});

	const setDefaultMutation = api.setDefault.useMutation({
		onSuccess: () => {
			void api.listAddresses.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to set default address."));
		},
	});

	const setDefaultBillingMutation = api.setDefaultBilling.useMutation({
		onSuccess: () => {
			void api.listAddresses.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to set default billing address."));
		},
	});

	if (!customerId) {
		return (
			<div className="py-16 text-center">
				<p className="text-3xl">&#128205;</p>
				<h2 className="mt-4 font-semibold text-foreground text-lg">
					Your Addresses
				</h2>
				<p className="mt-2 text-muted-foreground text-sm">
					Sign in to manage your saved addresses.
				</p>
			</div>
		);
	}

	if (loading) {
		return (
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				{Array.from({ length: 2 }).map((_, i) => (
					<div
						key={`skel-${i}`}
						className="space-y-2 rounded-lg border border-border p-4"
					>
						<div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
						<div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
						<div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
						<div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
					</div>
				))}
			</div>
		);
	}

	const updateField = (field: keyof AddressForm, value: string) => {
		setForm((prev) => ({ ...prev, [field]: value }));
	};

	const handleSubmit = () => {
		if (
			!form.firstName ||
			!form.lastName ||
			!form.line1 ||
			!form.city ||
			!form.postalCode ||
			!form.country
		) {
			setError("Please fill in all required fields.");
			return;
		}
		setError("");

		const body: Record<string, string> = {
			firstName: form.firstName,
			lastName: form.lastName,
			line1: form.line1,
			city: form.city,
			postalCode: form.postalCode,
			country: form.country,
		};
		if (form.label) body.label = form.label;
		if (form.company) body.company = form.company;
		if (form.line2) body.line2 = form.line2;
		if (form.state) body.state = form.state;
		if (form.phone) body.phone = form.phone;

		if (editingId) {
			updateMutation.mutate({ params: { id: editingId }, body });
		} else {
			createMutation.mutate(body);
		}
	};

	const handleEdit = (addr: Address) => {
		setEditingId(addr.id);
		setShowForm(true);
		setForm({
			label: addr.label ?? "",
			firstName: addr.firstName,
			lastName: addr.lastName,
			company: addr.company ?? "",
			line1: addr.line1,
			line2: addr.line2 ?? "",
			city: addr.city,
			state: addr.state ?? "",
			postalCode: addr.postalCode,
			country: addr.country,
			phone: addr.phone ?? "",
		});
	};

	const handleCancelForm = () => {
		setShowForm(false);
		setEditingId(null);
		setForm(emptyForm);
		setError("");
	};

	const handleDelete = (id: string) => {
		if (deletingId === id) {
			deleteMutation.mutate({ params: { id } });
		} else {
			setDeletingId(id);
		}
	};

	const formContent = showForm ? (
		<div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800">
			<h3 className="mb-4 font-medium text-foreground">
				{editingId ? "Edit Address" : "New Address"}
			</h3>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div className="sm:col-span-2">
					<label
						htmlFor="addr-label"
						className="mb-1 block text-foreground/80 text-sm"
					>
						Label
					</label>
					<input
						id="addr-label"
						type="text"
						placeholder="e.g. Home, Work"
						value={form.label}
						onChange={(e) => updateField("label", e.target.value)}
						className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700"
					/>
				</div>
				<div>
					<label
						htmlFor="addr-firstName"
						className="mb-1 block text-foreground/80 text-sm"
					>
						First Name *
					</label>
					<input
						id="addr-firstName"
						type="text"
						value={form.firstName}
						onChange={(e) => updateField("firstName", e.target.value)}
						className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700"
					/>
				</div>
				<div>
					<label
						htmlFor="addr-lastName"
						className="mb-1 block text-foreground/80 text-sm"
					>
						Last Name *
					</label>
					<input
						id="addr-lastName"
						type="text"
						value={form.lastName}
						onChange={(e) => updateField("lastName", e.target.value)}
						className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700"
					/>
				</div>
				<div className="sm:col-span-2">
					<label
						htmlFor="addr-company"
						className="mb-1 block text-foreground/80 text-sm"
					>
						Company
					</label>
					<input
						id="addr-company"
						type="text"
						value={form.company}
						onChange={(e) => updateField("company", e.target.value)}
						className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700"
					/>
				</div>
				<div className="sm:col-span-2">
					<label
						htmlFor="addr-line1"
						className="mb-1 block text-foreground/80 text-sm"
					>
						Address Line 1 *
					</label>
					<input
						id="addr-line1"
						type="text"
						value={form.line1}
						onChange={(e) => updateField("line1", e.target.value)}
						className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700"
					/>
				</div>
				<div className="sm:col-span-2">
					<label
						htmlFor="addr-line2"
						className="mb-1 block text-foreground/80 text-sm"
					>
						Address Line 2
					</label>
					<input
						id="addr-line2"
						type="text"
						value={form.line2}
						onChange={(e) => updateField("line2", e.target.value)}
						className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700"
					/>
				</div>
				<div>
					<label
						htmlFor="addr-city"
						className="mb-1 block text-foreground/80 text-sm"
					>
						City *
					</label>
					<input
						id="addr-city"
						type="text"
						value={form.city}
						onChange={(e) => updateField("city", e.target.value)}
						className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700"
					/>
				</div>
				<div>
					<label
						htmlFor="addr-state"
						className="mb-1 block text-foreground/80 text-sm"
					>
						State / Province
					</label>
					<input
						id="addr-state"
						type="text"
						value={form.state}
						onChange={(e) => updateField("state", e.target.value)}
						className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700"
					/>
				</div>
				<div>
					<label
						htmlFor="addr-postalCode"
						className="mb-1 block text-foreground/80 text-sm"
					>
						Postal Code *
					</label>
					<input
						id="addr-postalCode"
						type="text"
						value={form.postalCode}
						onChange={(e) => updateField("postalCode", e.target.value)}
						className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700"
					/>
				</div>
				<div>
					<label
						htmlFor="addr-country"
						className="mb-1 block text-foreground/80 text-sm"
					>
						Country *
					</label>
					<input
						id="addr-country"
						type="text"
						value={form.country}
						onChange={(e) => updateField("country", e.target.value)}
						className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700"
					/>
				</div>
				<div className="sm:col-span-2">
					<label
						htmlFor="addr-phone"
						className="mb-1 block text-foreground/80 text-sm"
					>
						Phone
					</label>
					<input
						id="addr-phone"
						type="tel"
						value={form.phone}
						onChange={(e) => updateField("phone", e.target.value)}
						className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700"
					/>
				</div>
			</div>
			<div className="mt-4 flex gap-2">
				<button
					type="button"
					onClick={handleSubmit}
					disabled={createMutation.isPending || updateMutation.isPending}
					className="rounded-md bg-background px-4 py-2 text-sm text-white transition-colors hover:bg-muted disabled:opacity-50 dark:bg-muted dark:hover:bg-muted"
				>
					{createMutation.isPending || updateMutation.isPending
						? "Saving..."
						: editingId
							? "Update Address"
							: "Save Address"}
				</button>
				<button
					type="button"
					onClick={handleCancelForm}
					className="rounded-md border border-gray-300 px-4 py-2 text-sm transition-colors hover:bg-muted/30 dark:border-gray-700 dark:hover:bg-muted"
				>
					Cancel
				</button>
			</div>
		</div>
	) : null;

	const cardsContent = (
		<>
			{items.length === 0 ? (
				<div className="py-12 text-center">
					<p className="text-3xl">&#128205;</p>
					<h3 className="mt-4 font-medium text-foreground">No addresses yet</h3>
					<p className="mt-2 text-muted-foreground text-sm">
						Add your first address to get started.
					</p>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{items.map((addr) => (
						<div
							key={addr.id}
							className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800"
						>
							<div className="flex items-start justify-between">
								<div>
									{addr.label && (
										<span className="mb-1 inline-block rounded bg-muted px-2 py-0.5 font-medium text-foreground/80 text-xs">
											{addr.label}
										</span>
									)}
									<p className="font-medium text-foreground text-sm">
										{addr.firstName} {addr.lastName}
									</p>
								</div>
								<div className="flex gap-1">
									{addr.isDefault && (
										<span className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-800 text-xs dark:bg-blue-900/30 dark:text-blue-400">
											Shipping
										</span>
									)}
									{addr.isDefaultBilling && (
										<span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-800 text-xs dark:bg-green-900/30 dark:text-green-400">
											Billing
										</span>
									)}
								</div>
							</div>
							{addr.company && (
								<p className="mt-1 text-muted-foreground text-xs">
									{addr.company}
								</p>
							)}
							<p className="mt-2 text-foreground/80 text-sm">{addr.line1}</p>
							{addr.line2 && (
								<p className="text-foreground/80 text-sm">{addr.line2}</p>
							)}
							<p className="text-foreground/80 text-sm">
								{addr.city}
								{addr.state ? `, ${addr.state}` : ""} {addr.postalCode}
							</p>
							<p className="text-foreground/80 text-sm">{addr.country}</p>
							{addr.phone && (
								<p className="mt-1 text-muted-foreground text-xs">
									{addr.phone}
								</p>
							)}
							<div className="mt-3 flex flex-wrap gap-1 border-gray-100 border-t pt-3 dark:border-gray-800">
								<button
									type="button"
									onClick={() => handleEdit(addr)}
									className="rounded px-2 py-1 text-muted-foreground text-xs transition-colors hover:bg-muted dark:hover:bg-muted"
								>
									Edit
								</button>
								<button
									type="button"
									onClick={() => handleDelete(addr.id)}
									className="rounded px-2 py-1 text-red-600 text-xs transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
								>
									{deletingId === addr.id ? "Confirm?" : "Delete"}
								</button>
								{deletingId === addr.id && (
									<button
										type="button"
										onClick={() => setDeletingId(null)}
										className="rounded px-2 py-1 text-muted-foreground text-xs hover:bg-muted dark:hover:bg-muted"
									>
										Cancel
									</button>
								)}
								{!addr.isDefault && (
									<button
										type="button"
										onClick={() =>
											setDefaultMutation.mutate({
												params: { id: addr.id },
											})
										}
										className="rounded px-2 py-1 text-blue-600 text-xs transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
									>
										Set Shipping Default
									</button>
								)}
								{!addr.isDefaultBilling && (
									<button
										type="button"
										onClick={() =>
											setDefaultBillingMutation.mutate({
												params: { id: addr.id },
											})
										}
										className="rounded px-2 py-1 text-green-600 text-xs transition-colors hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
									>
										Set Billing Default
									</button>
								)}
							</div>
						</div>
					))}
				</div>
			)}
		</>
	);

	const content = (
		<>
			<div className="mb-4 flex items-center justify-between">
				{!showForm && (
					<button
						type="button"
						onClick={() => {
							setShowForm(true);
							setEditingId(null);
							setForm(emptyForm);
						}}
						className="rounded-md bg-background px-4 py-2 text-sm text-white transition-colors hover:bg-muted dark:bg-muted dark:hover:bg-muted"
					>
						Add Address
					</button>
				)}
			</div>
			{formContent}
			{!showForm && cardsContent}
		</>
	);

	return (
		<AddressBookTemplate
			addressCount={items.length}
			error={error}
			content={content}
		/>
	);
}
