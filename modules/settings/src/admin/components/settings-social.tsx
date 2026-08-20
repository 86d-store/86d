"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import SettingsSocialTemplate from "./settings-social.mdx";

interface StoreSetting {
	id: string;
	key: string;
	value: string;
	group: string;
	updatedAt: string;
}

const SOCIAL_FIELDS = [
	{
		key: "social.facebook",
		label: "Facebook",
		placeholder: "https://facebook.com/yourstore",
	},
	{
		key: "social.instagram",
		label: "Instagram",
		placeholder: "https://instagram.com/yourstore",
	},
	{
		key: "social.twitter",
		label: "X (Twitter)",
		placeholder: "https://x.com/yourstore",
	},
	{
		key: "social.tiktok",
		label: "TikTok",
		placeholder: "https://tiktok.com/@yourstore",
	},
	{
		key: "social.youtube",
		label: "YouTube",
		placeholder: "https://youtube.com/@yourstore",
	},
	{
		key: "social.pinterest",
		label: "Pinterest",
		placeholder: "https://pinterest.com/yourstore",
	},
] as const;

function useSettingsApi() {
	const client = useModuleClient();
	return {
		list: client.module("settings").admin["/admin/settings"],
		updateBulk: client.module("settings").admin["/admin/settings/update-bulk"],
	};
}

export function SettingsSocial() {
	const api = useSettingsApi();
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [edits, setEdits] = useState<Record<string, string>>({});

	const { data, isLoading } = api.list.useQuery({
		group: "social",
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
			settings: SOCIAL_FIELDS.map((f) => ({
				key: f.key,
				value: getValue(f.key),
				group: "social" as const,
			})),
		});
	};

	const fields = SOCIAL_FIELDS.map((f) => ({
		...f,
		value: getValue(f.key),
		onChange: (v: string) => setEdits((prev) => ({ ...prev, [f.key]: v })),
	}));

	return (
		<SettingsSocialTemplate
			loading={isLoading}
			saving={saving}
			saved={saved}
			fields={fields}
			onSave={handleSave}
		/>
	);
}
