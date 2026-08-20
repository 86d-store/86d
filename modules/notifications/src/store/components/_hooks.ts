"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useNotificationsApi() {
	const client = useModuleClient();
	return {
		list: client.module("notifications").store["/notifications"],
		unreadCount:
			client.module("notifications").store["/notifications/unread-count"],
		markRead: client.module("notifications").store["/notifications/:id/read"],
		markAllRead:
			client.module("notifications").store["/notifications/read-all"],
		preferences:
			client.module("notifications").store["/notifications/preferences"],
		updatePreferences:
			client.module("notifications").store["/notifications/preferences/update"],
	};
}
