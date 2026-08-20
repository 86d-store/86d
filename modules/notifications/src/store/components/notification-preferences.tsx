"use client";

import { useNotificationsApi } from "./_hooks";
import NotificationPreferencesTemplate from "./notification-preferences.mdx";

interface Preferences {
	orderUpdates: boolean;
	promotions: boolean;
	shippingAlerts: boolean;
	accountAlerts: boolean;
}

export function NotificationPreferences() {
	const api = useNotificationsApi();

	const { data, isLoading: loading } = api.preferences.useQuery({}) as {
		data: { preferences: Preferences } | undefined;
		isLoading: boolean;
	};

	const updateMutation = api.updatePreferences.useMutation({
		onSuccess: () => {
			void api.preferences.invalidate();
		},
	});

	const prefs = data?.preferences;

	const handleToggle = (key: keyof Preferences) => {
		if (!prefs) return;
		updateMutation.mutate({ [key]: !prefs[key] });
	};

	return (
		<NotificationPreferencesTemplate
			loading={loading}
			prefs={prefs}
			onToggle={handleToggle}
			saving={updateMutation.isPending}
		/>
	);
}
