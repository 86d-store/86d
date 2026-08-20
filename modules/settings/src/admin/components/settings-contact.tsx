"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import SettingsContactTemplate from "./settings-contact.mdx";

interface StoreSetting {
	id: string;
	key: string;
	value: string;
	group: string;
	updatedAt: string;
}

function useSettingsApi() {
	const client = useModuleClient();
	return {
		list: client.module("settings").admin["/admin/settings"],
		updateBulk: client.module("settings").admin["/admin/settings/update-bulk"],
	};
}

export function SettingsContact() {
	const api = useSettingsApi();
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);

	const { data, isLoading } = api.list.useQuery({
		group: "contact",
	}) as {
		data: { settings: StoreSetting[] } | undefined;
		isLoading: boolean;
	};

	const updateBulk = api.updateBulk.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			setSaving(false);
			setSaved(true);
			setTimeout(() => setSaved(false), 2000);
		},
		onError: () => setSaving(false),
	});

	const settings = data?.settings ?? [];
	const getValue = (key: string) =>
		settings.find((s) => s.key === key)?.value ?? "";

	const [email, setEmail] = useState<string | null>(null);
	const [phone, setPhone] = useState<string | null>(null);
	const [address, setAddress] = useState<string | null>(null);
	const [city, setCity] = useState<string | null>(null);
	const [state, setState] = useState<string | null>(null);
	const [postalCode, setPostalCode] = useState<string | null>(null);
	const [country, setCountry] = useState<string | null>(null);

	const handleSave = () => {
		setSaving(true);
		updateBulk.mutate({
			settings: [
				{
					key: "contact.support_email",
					value: email ?? getValue("contact.support_email"),
					group: "contact",
				},
				{
					key: "contact.support_phone",
					value: phone ?? getValue("contact.support_phone"),
					group: "contact",
				},
				{
					key: "contact.business_address",
					value: address ?? getValue("contact.business_address"),
					group: "contact",
				},
				{
					key: "contact.business_city",
					value: city ?? getValue("contact.business_city"),
					group: "contact",
				},
				{
					key: "contact.business_state",
					value: state ?? getValue("contact.business_state"),
					group: "contact",
				},
				{
					key: "contact.business_postal_code",
					value: postalCode ?? getValue("contact.business_postal_code"),
					group: "contact",
				},
				{
					key: "contact.business_country",
					value: country ?? getValue("contact.business_country"),
					group: "contact",
				},
			],
		});
	};

	return (
		<SettingsContactTemplate
			loading={isLoading}
			saving={saving}
			saved={saved}
			email={email ?? getValue("contact.support_email")}
			onEmailChange={(v: string) => setEmail(v)}
			phone={phone ?? getValue("contact.support_phone")}
			onPhoneChange={(v: string) => setPhone(v)}
			address={address ?? getValue("contact.business_address")}
			onAddressChange={(v: string) => setAddress(v)}
			city={city ?? getValue("contact.business_city")}
			onCityChange={(v: string) => setCity(v)}
			state={state ?? getValue("contact.business_state")}
			onStateChange={(v: string) => setState(v)}
			postalCode={postalCode ?? getValue("contact.business_postal_code")}
			onPostalCodeChange={(v: string) => setPostalCode(v)}
			country={country ?? getValue("contact.business_country")}
			onCountryChange={(v: string) => setCountry(v)}
			onSave={handleSave}
		/>
	);
}
