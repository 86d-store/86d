"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import SettingsLegalTemplate from "./settings-legal.mdx";

interface StoreSetting {
	id: string;
	key: string;
	value: string;
	group: string;
	updatedAt: string;
}

const LEGAL_FIELDS = [
	{ key: "legal.return_policy", label: "Return Policy" },
	{ key: "legal.privacy_policy", label: "Privacy Policy" },
	{ key: "legal.terms_of_service", label: "Terms of Service" },
	{ key: "legal.shipping_policy", label: "Shipping Policy" },
] as const;

function useSettingsApi() {
	const client = useModuleClient();
	return {
		list: client.module("settings").admin["/admin/settings"],
		updateBulk: client.module("settings").admin["/admin/settings/update-bulk"],
	};
}

export function SettingsLegal() {
	const api = useSettingsApi();
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [edits, setEdits] = useState<Record<string, string>>({});

	const { data, isLoading } = api.list.useQuery({
		group: "legal",
	}) as {
		data: { settings: StoreSetting[] } | undefined;
		isLoading: boolean;
	};

	const updateBulk = api.updateBulk.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			setSaving(false);
			setSaved(true);
			setEdits({});
			setTimeout(() => setSaved(false), 2000);
		},
		onError: () => setSaving(false),
	});

	const settings = data?.settings ?? [];
	const getValue = (key: string) =>
		edits[key] ?? settings.find((s) => s.key === key)?.value ?? "";

	const handleSave = () => {
		setSaving(true);
		updateBulk.mutate({
			settings: LEGAL_FIELDS.map((f) => ({
				key: f.key,
				value: getValue(f.key),
				group: "legal" as const,
			})),
		});
	};

	const fields = LEGAL_FIELDS.map((f) => ({
		...f,
		value: getValue(f.key),
		onChange: (v: string) => setEdits((prev) => ({ ...prev, [f.key]: v })),
	}));

	return (
		<SettingsLegalTemplate
			loading={isLoading}
			saving={saving}
			saved={saved}
			fields={fields}
			onSave={handleSave}
		/>
	);
}
