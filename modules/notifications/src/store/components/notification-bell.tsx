"use client";

import { useNotificationsApi } from "./_hooks";
import NotificationBellTemplate from "./notification-bell.mdx";

export interface NotificationBellProps {
	href?: string | undefined;
}

export function NotificationBell({
	href = "/account/notifications",
}: NotificationBellProps) {
	const api = useNotificationsApi();

	const { data } = api.unreadCount.useQuery({}) as {
		data: { count: number } | undefined;
	};

	const count = data?.count ?? 0;

	return <NotificationBellTemplate count={count} href={href} />;
}
