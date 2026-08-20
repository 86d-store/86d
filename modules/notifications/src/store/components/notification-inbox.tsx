"use client";

import { useState } from "react";
import { useNotificationsApi } from "./_hooks";
import { timeAgo } from "./_utils";
import NotificationInboxTemplate from "./notification-inbox.mdx";

interface NotificationItem {
	id: string;
	type: string;
	title: string;
	body: string;
	actionUrl?: string | null;
	read: boolean;
	createdAt: string;
}

const TYPE_ICONS: Record<string, string> = {
	info: "circle-info",
	success: "circle-check",
	warning: "triangle-alert",
	error: "circle-x",
	order: "package",
	shipping: "truck",
	promotion: "tag",
};

export interface NotificationInboxProps {
	title?: string | undefined;
	emptyMessage?: string | undefined;
}

export function NotificationInbox({
	title = "Notifications",
	emptyMessage = "You're all caught up! No notifications right now.",
}: NotificationInboxProps) {
	const api = useNotificationsApi();
	const [readFilter, setReadFilter] = useState<string>("");

	const queryInput: Record<string, string> = { limit: "50" };
	if (readFilter) queryInput.read = readFilter;

	const { data, isLoading: loading } = api.list.useQuery(queryInput) as {
		data: { notifications: NotificationItem[]; total: number } | undefined;
		isLoading: boolean;
	};

	const markReadMutation = api.markRead.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			void api.unreadCount.invalidate();
		},
	});

	const markAllReadMutation = api.markAllRead.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			void api.unreadCount.invalidate();
		},
	});

	const notifications = data?.notifications ?? [];
	const hasUnread = notifications.some((n) => !n.read);

	const handleMarkRead = (id: string) => {
		markReadMutation.mutate({ params: { id } });
	};

	const handleMarkAllRead = () => {
		markAllReadMutation.mutate({});
	};

	const items = notifications.map((n) => ({
		...n,
		timeAgo: timeAgo(n.createdAt),
		iconType: TYPE_ICONS[n.type] ?? "circle-info",
	}));

	return (
		<NotificationInboxTemplate
			title={title}
			emptyMessage={emptyMessage}
			loading={loading}
			notifications={items}
			hasUnread={hasUnread}
			readFilter={readFilter}
			onReadFilterChange={setReadFilter}
			onMarkRead={handleMarkRead}
			onMarkAllRead={handleMarkAllRead}
			markAllReadPending={markAllReadMutation.isPending}
		/>
	);
}
