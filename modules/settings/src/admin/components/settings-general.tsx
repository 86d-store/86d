"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import SettingsGeneralTemplate from "./settings-general.mdx";

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

export function SettingsGeneral() {
	const api = useSettingsApi();
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);

	const { data, isLoading } = api.list.useQuery({
		group: "general",
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

	const [storeName, setStoreName] = useState<string | null>(null);
	const [storeDescription, setStoreDescription] = useState<string | null>(null);
	const [storeTagline, setStoreTagline] = useState<string | null>(null);
	const [timezone, setTimezone] = useState<string | null>(null);
	const [locale, setLocale] = useState<string | null>(null);

	const currentStoreName = storeName ?? getValue("general.store_name");
	const currentDescription =
		storeDescription ?? getValue("general.store_description");
	const currentTagline = storeTagline ?? getValue("general.store_tagline");
	const currentTimezone = timezone ?? getValue("general.timezone");
	const currentLocale = locale ?? getValue("general.locale");

	const handleSave = () => {
		setSaving(true);
		updateBulk.mutate({
			settings: [
				{
					key: "general.store_name",
					value: currentStoreName,
					group: "general",
				},
				{
					key: "general.store_description",
					value: currentDescription,
					group: "general",
				},
				{
					key: "general.store_tagline",
					value: currentTagline,
					group: "general",
				},
				{ key: "general.timezone", value: currentTimezone, group: "general" },
				{ key: "general.locale", value: currentLocale, group: "general" },
			],
		});
	};

	return (
		<SettingsGeneralTemplate
			loading={isLoading}
			saving={saving}
			saved={saved}
			storeName={currentStoreName}
			onStoreNameChange={(v: string) => setStoreName(v)}
			storeDescription={currentDescription}
			onStoreDescriptionChange={(v: string) => setStoreDescription(v)}
			storeTagline={currentTagline}
			onStoreTaglineChange={(v: string) => setStoreTagline(v)}
			timezone={currentTimezone}
			onTimezoneChange={(v: string) => setTimezone(v)}
			locale={currentLocale}
			onLocaleChange={(v: string) => setLocale(v)}
			onSave={handleSave}
		/>
	);
}
