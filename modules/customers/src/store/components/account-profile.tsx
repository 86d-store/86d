"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import { useCustomerApi } from "./_hooks";
import AccountProfileTemplate from "./account-profile.mdx";

interface CustomerData {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	phone?: string;
}

export function AccountProfile() {
	const api = useCustomerApi();
	const { data, isLoading, isError, refetch } = api.getMe.useQuery() as {
		data: { customer: CustomerData } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};
	const client = useModuleClient();

	const [editing, setEditing] = useState(false);
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [phone, setPhone] = useState("");
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState("");

	const customer = data?.customer;

	function startEdit() {
		if (!customer) return;
		setFirstName(customer.firstName);
		setLastName(customer.lastName);
		setPhone(customer.phone ?? "");
		setEditing(true);
		setMessage("");
	}

	async function handleSave() {
		setSaving(true);
		setMessage("");
		try {
			await client.module("customers").store["/customers/me/update"].mutate({
				firstName: firstName.trim(),
				lastName: lastName.trim(),
				phone: phone.trim() || null,
			});
			setEditing(false);
			setMessage("Profile updated");
			refetch();
		} catch {
			setMessage("Failed to update profile");
		} finally {
			setSaving(false);
		}
	}

	return (
		<AccountProfileTemplate
			customer={customer}
			isLoading={isLoading}
			isError={isError}
			onRetry={() => refetch()}
			editing={editing}
			firstName={firstName}
			lastName={lastName}
			phone={phone}
			saving={saving}
			message={message}
			onEdit={startEdit}
			onCancel={() => setEditing(false)}
			onSave={handleSave}
			onFirstNameChange={setFirstName}
			onLastNameChange={setLastName}
			onPhoneChange={setPhone}
		/>
	);
}
