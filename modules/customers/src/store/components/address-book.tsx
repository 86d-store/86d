"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import { useCustomerApi } from "./_hooks";
import AddressBookTemplate from "./address-book.mdx";

interface Address {
	id: string;
	type: "billing" | "shipping";
	firstName: string;
	lastName: string;
	company?: string;
	line1: string;
	line2?: string;
	city: string;
	state: string;
	postalCode: string;
	country: string;
	phone?: string;
	isDefault: boolean;
}

type AddressForm = Omit<Address, "id" | "isDefault">;

const emptyForm: AddressForm = {
	type: "shipping",
	firstName: "",
	lastName: "",
	line1: "",
	city: "",
	state: "",
	postalCode: "",
	country: "",
};

export function AddressBook() {
	const api = useCustomerApi();
	const client = useModuleClient();
	const { data, isLoading, isError, refetch } =
		api.listAddresses.useQuery() as {
			data: { addresses: Address[] } | undefined;
			isLoading: boolean;
			isError: boolean;
			refetch: () => void;
		};

	const [showForm, setShowForm] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<AddressForm>(emptyForm);
	const [saving, setSaving] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	function startCreate() {
		setForm(emptyForm);
		setEditingId(null);
		setShowForm(true);
	}

	function startEdit(address: Address) {
		const next: AddressForm = {
			type: address.type,
			firstName: address.firstName,
			lastName: address.lastName,
			line1: address.line1,
			city: address.city,
			state: address.state,
			postalCode: address.postalCode,
			country: address.country,
		};
		if (address.company) next.company = address.company;
		if (address.line2) next.line2 = address.line2;
		if (address.phone) next.phone = address.phone;
		setForm(next);
		setEditingId(address.id);
		setShowForm(true);
	}

	function updateField(field: keyof AddressForm, value: string) {
		setForm((prev) => ({ ...prev, [field]: value }));
	}

	async function handleSave() {
		setSaving(true);
		try {
			if (editingId) {
				await client
					.module("customers")
					.store["/customers/me/addresses/:id"].mutate({
						params: { id: editingId },
						...form,
					});
			} else {
				await client
					.module("customers")
					.store["/customers/me/addresses/create"].mutate(form);
			}
			setShowForm(false);
			setEditingId(null);
			refetch();
		} catch {
			// Error handling is in the template
		} finally {
			setSaving(false);
		}
	}

	async function handleDelete(id: string) {
		setDeletingId(id);
		try {
			await client
				.module("customers")
				.store["/customers/me/addresses/:id/delete"].mutate({
					params: { id },
				});
			refetch();
		} catch {
			// Silently fail
		} finally {
			setDeletingId(null);
		}
	}

	return (
		<AddressBookTemplate
			addresses={data?.addresses ?? []}
			isLoading={isLoading}
			isError={isError}
			onRetry={() => refetch()}
			showForm={showForm}
			editingId={editingId}
			form={form}
			saving={saving}
			deletingId={deletingId}
			onAdd={startCreate}
			onEdit={startEdit}
			onDelete={handleDelete}
			onCancel={() => {
				setShowForm(false);
				setEditingId(null);
			}}
			onSave={handleSave}
			onFieldChange={updateField}
		/>
	);
}
