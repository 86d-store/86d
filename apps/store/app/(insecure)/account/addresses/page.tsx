"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { MapPinIcon } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "~/components/status-badge";
import { Button } from "~/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "~/components/ui/empty";
import { Skeleton } from "~/components/ui/skeleton";

// ── Types ───────────────────────────────────────────────────────────────────

interface Address {
	id: string;
	type: string;
	firstName: string;
	lastName: string;
	company?: string | undefined;
	line1: string;
	line2?: string | undefined;
	city: string;
	state: string;
	postalCode: string;
	country: string;
	phone?: string | undefined;
	isDefault?: boolean | undefined;
}

interface AddressFormData {
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

const EMPTY_FORM: AddressFormData = {
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

// ── Address Form ────────────────────────────────────────────────────────────

function AddressForm({
	initial,
	onSubmit,
	onCancel,
	saving,
}: {
	initial: AddressFormData;
	onSubmit: (data: AddressFormData) => void;
	onCancel: () => void;
	saving: boolean;
}) {
	const [form, setForm] = useState<AddressFormData>(initial);

	function set<K extends keyof AddressFormData>(
		key: K,
		value: AddressFormData[K],
	) {
		setForm((f) => ({ ...f, [key]: value }));
	}

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				onSubmit(form);
			}}
			className="flex flex-col gap-4 rounded-xl border border-border p-5"
		>
			{/* Type */}
			<div>
				<label
					htmlFor="address-type"
					className="mb-1.5 block font-medium text-foreground text-sm"
				>
					Type
				</label>
				<select
					id="address-type"
					value={form.type}
					onChange={(e) =>
						set("type", e.target.value as "billing" | "shipping")
					}
					className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm focus:border-foreground focus:outline-none"
				>
					<option value="shipping">Shipping</option>
					<option value="billing">Billing</option>
				</select>
			</div>

			{/* Name */}
			<div className="grid grid-cols-2 gap-3">
				<div>
					<label
						htmlFor="address-first-name"
						className="mb-1.5 block font-medium text-foreground text-sm"
					>
						First name *
					</label>
					<input
						id="address-first-name"
						type="text"
						required
						value={form.firstName}
						onChange={(e) => set("firstName", e.target.value)}
						className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm focus:border-foreground focus:outline-none"
					/>
				</div>
				<div>
					<label
						htmlFor="address-last-name"
						className="mb-1.5 block font-medium text-foreground text-sm"
					>
						Last name *
					</label>
					<input
						id="address-last-name"
						type="text"
						required
						value={form.lastName}
						onChange={(e) => set("lastName", e.target.value)}
						className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm focus:border-foreground focus:outline-none"
					/>
				</div>
			</div>

			{/* Company */}
			<div>
				<label
					htmlFor="address-company"
					className="mb-1.5 block font-medium text-foreground text-sm"
				>
					Company
				</label>
				<input
					id="address-company"
					type="text"
					value={form.company}
					onChange={(e) => set("company", e.target.value)}
					className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm focus:border-foreground focus:outline-none"
				/>
			</div>

			{/* Address lines */}
			<div>
				<label
					htmlFor="address-line1"
					className="mb-1.5 block font-medium text-foreground text-sm"
				>
					Address line 1 *
				</label>
				<input
					id="address-line1"
					type="text"
					required
					value={form.line1}
					onChange={(e) => set("line1", e.target.value)}
					className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm focus:border-foreground focus:outline-none"
				/>
			</div>
			<div>
				<label
					htmlFor="address-line2"
					className="mb-1.5 block font-medium text-foreground text-sm"
				>
					Address line 2
				</label>
				<input
					id="address-line2"
					type="text"
					value={form.line2}
					onChange={(e) => set("line2", e.target.value)}
					className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm focus:border-foreground focus:outline-none"
				/>
			</div>

			{/* City / State / Postal */}
			<div className="grid grid-cols-3 gap-3">
				<div>
					<label
						htmlFor="address-city"
						className="mb-1.5 block font-medium text-foreground text-sm"
					>
						City *
					</label>
					<input
						id="address-city"
						type="text"
						required
						value={form.city}
						onChange={(e) => set("city", e.target.value)}
						className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm focus:border-foreground focus:outline-none"
					/>
				</div>
				<div>
					<label
						htmlFor="address-state"
						className="mb-1.5 block font-medium text-foreground text-sm"
					>
						State *
					</label>
					<input
						id="address-state"
						type="text"
						required
						value={form.state}
						onChange={(e) => set("state", e.target.value)}
						className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm focus:border-foreground focus:outline-none"
					/>
				</div>
				<div>
					<label
						htmlFor="address-postal"
						className="mb-1.5 block font-medium text-foreground text-sm"
					>
						Postal *
					</label>
					<input
						id="address-postal"
						type="text"
						required
						value={form.postalCode}
						onChange={(e) => set("postalCode", e.target.value)}
						className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm focus:border-foreground focus:outline-none"
					/>
				</div>
			</div>

			{/* Country */}
			<div>
				<label
					htmlFor="address-country"
					className="mb-1.5 block font-medium text-foreground text-sm"
				>
					Country code *
				</label>
				<input
					id="address-country"
					type="text"
					required
					maxLength={2}
					minLength={2}
					value={form.country}
					onChange={(e) => set("country", e.target.value.toUpperCase())}
					placeholder="US"
					className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm uppercase focus:border-foreground focus:outline-none"
				/>
			</div>

			{/* Phone */}
			<div>
				<label
					htmlFor="address-phone"
					className="mb-1.5 block font-medium text-foreground text-sm"
				>
					Phone
				</label>
				<input
					id="address-phone"
					type="tel"
					value={form.phone}
					onChange={(e) => set("phone", e.target.value)}
					className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm focus:border-foreground focus:outline-none"
				/>
			</div>

			{/* Default */}
			<label className="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					checked={form.isDefault}
					onChange={(e) => set("isDefault", e.target.checked)}
					className="rounded border-border"
				/>
				<span className="text-foreground">Set as default address</span>
			</label>

			{/* Actions */}
			<div className="flex items-center justify-end gap-3 pt-2">
				<button
					type="button"
					onClick={onCancel}
					className="rounded-lg border border-border px-4 py-2 text-foreground text-sm transition-colors hover:bg-muted"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={saving}
					className="rounded-lg bg-foreground px-5 py-2 font-semibold text-background text-sm transition-opacity hover:opacity-90 disabled:opacity-60"
				>
					{saving ? "Saving..." : "Save address"}
				</button>
			</div>
		</form>
	);
}

// ── Addresses Page ──────────────────────────────────────────────────────────

export default function AddressesPage() {
	const client = useModuleClient();

	const listApi = client.module("customers").store["/customers/me/addresses"];
	const createApi =
		client.module("customers").store["/customers/me/addresses/create"];
	const addressByIdApi =
		client.module("customers").store["/customers/me/addresses/:id"];
	const deleteByIdApi =
		client.module("customers").store["/customers/me/addresses/:id/delete"];

	const { data, isLoading, isError, refetch } = listApi.useQuery() as {
		data: { addresses: Address[] } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const [mode, setMode] = useState<"list" | "add" | { editing: Address }>(
		"list",
	);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [error, setError] = useState("");

	const createMutation = createApi.useMutation({
		onSuccess: () => {
			void listApi.invalidate();
			setMode("list");
		},
		onError: () => {
			setError("Failed to add address. Please try again.");
		},
	});

	const updateMutation = addressByIdApi.useMutation({
		onSuccess: () => {
			void listApi.invalidate();
			setMode("list");
		},
		onError: () => {
			setError("Failed to update address. Please try again.");
		},
	});

	const deleteMutation = deleteByIdApi.useMutation({
		onSuccess: () => {
			void listApi.invalidate();
			setDeletingId(null);
		},
		onError: () => {
			setError("Failed to delete address. Please try again.");
			setDeletingId(null);
		},
	});

	const saving = createMutation.isPending || updateMutation.isPending;
	const addresses = data?.addresses ?? [];

	function handleCreate(formData: AddressFormData) {
		setError("");
		createMutation.mutate({
			type: formData.type,
			firstName: formData.firstName,
			lastName: formData.lastName,
			company: formData.company || undefined,
			line1: formData.line1,
			line2: formData.line2 || undefined,
			city: formData.city,
			state: formData.state,
			postalCode: formData.postalCode,
			country: formData.country,
			phone: formData.phone || undefined,
			isDefault: formData.isDefault,
		});
	}

	function handleUpdate(id: string, formData: AddressFormData) {
		setError("");
		updateMutation.mutate({
			params: { id },
			type: formData.type,
			firstName: formData.firstName,
			lastName: formData.lastName,
			company: formData.company || null,
			line1: formData.line1,
			line2: formData.line2 || null,
			city: formData.city,
			state: formData.state,
			postalCode: formData.postalCode,
			country: formData.country,
			phone: formData.phone || null,
			isDefault: formData.isDefault,
		});
	}

	function handleDelete(id: string) {
		setDeletingId(id);
		setError("");
		deleteMutation.mutate({ params: { id } });
	}

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h2 className="font-bold font-display text-foreground text-xl tracking-tight sm:text-2xl">
						Addresses
					</h2>
					<p className="mt-1 text-muted-foreground text-sm">
						Manage your shipping and billing addresses.
					</p>
				</div>
				{mode === "list" && (
					<button
						type="button"
						onClick={() => setMode("add")}
						className="rounded-lg bg-foreground px-4 py-2 font-semibold text-background text-sm transition-opacity hover:opacity-90"
					>
						Add address
					</button>
				)}
			</div>

			{error && (
				<div
					className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive text-sm"
					role="alert"
				>
					{error}
				</div>
			)}

			{mode === "add" && (
				<AddressForm
					initial={EMPTY_FORM}
					onSubmit={handleCreate}
					onCancel={() => setMode("list")}
					saving={saving}
				/>
			)}

			{typeof mode === "object" && "editing" in mode && (
				<AddressForm
					initial={{
						type: mode.editing.type as "billing" | "shipping",
						firstName: mode.editing.firstName,
						lastName: mode.editing.lastName,
						company: mode.editing.company ?? "",
						line1: mode.editing.line1,
						line2: mode.editing.line2 ?? "",
						city: mode.editing.city,
						state: mode.editing.state,
						postalCode: mode.editing.postalCode,
						country: mode.editing.country,
						phone: mode.editing.phone ?? "",
						isDefault: mode.editing.isDefault ?? false,
					}}
					onSubmit={(data) => handleUpdate(mode.editing.id, data)}
					onCancel={() => setMode("list")}
					saving={saving}
				/>
			)}

			{mode === "list" &&
				(isError ? (
					<div
						className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive text-sm"
						role="alert"
					>
						<p>Failed to load your addresses.</p>
						<button
							type="button"
							onClick={() => refetch()}
							className="mt-1 font-medium underline"
						>
							Try again
						</button>
					</div>
				) : isLoading ? (
					<div className="flex flex-col gap-3">
						{[1, 2].map((n) => (
							<Skeleton key={n} className="h-32 rounded-xl" />
						))}
					</div>
				) : addresses.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<MapPinIcon />
							</EmptyMedia>
							<EmptyTitle>No addresses yet</EmptyTitle>
							<EmptyDescription>
								Add a shipping or billing address to speed up checkout.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<div className="flex flex-col gap-3">
						{addresses.map((addr) => (
							<div
								key={addr.id}
								className="rounded-xl border border-border p-4"
							>
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0 flex-1">
										<div className="mb-1 flex items-center gap-2">
											<span className="inline-block rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs capitalize">
												{addr.type}
											</span>
											{addr.isDefault && (
												<StatusBadge
													status="default"
													label="Default"
													variant="success"
												/>
											)}
										</div>
										<p className="font-medium text-foreground text-sm">
											{addr.firstName} {addr.lastName}
										</p>
										{addr.company && (
											<p className="text-muted-foreground text-sm">
												{addr.company}
											</p>
										)}
										<p className="text-muted-foreground text-sm">
											{addr.line1}
										</p>
										{addr.line2 && (
											<p className="text-muted-foreground text-sm">
												{addr.line2}
											</p>
										)}
										<p className="text-muted-foreground text-sm">
											{addr.city}, {addr.state} {addr.postalCode}
										</p>
										<p className="text-muted-foreground text-sm">
											{addr.country}
										</p>
										{addr.phone && (
											<p className="mt-1 text-muted-foreground text-sm">
												{addr.phone}
											</p>
										)}
									</div>
									<div className="flex shrink-0 gap-2">
										<button
											type="button"
											onClick={() => setMode({ editing: addr })}
											className="rounded-lg border border-border px-3 py-1.5 text-foreground text-sm transition-colors hover:bg-muted"
										>
											Edit
										</button>
										<Button
											variant="destructive"
											size="sm"
											disabled={deletingId === addr.id}
											onClick={() => handleDelete(addr.id)}
										>
											{deletingId === addr.id ? "Deleting..." : "Delete"}
										</Button>
									</div>
								</div>
							</div>
						))}
					</div>
				))}
		</div>
	);
}
