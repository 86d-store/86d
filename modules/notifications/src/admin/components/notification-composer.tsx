"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import NotificationComposerTemplate from "./notification-composer.mdx";

function useNotificationsAdminApi() {
	const client = useModuleClient();
	return {
		create: client.module("notifications").admin["/admin/notifications/create"],
		list: client.module("notifications").admin["/admin/notifications"],
		stats: client.module("notifications").admin["/admin/notifications/stats"],
	};
}

export function NotificationComposer() {
	const api = useNotificationsAdminApi();
	const [customerId, setCustomerId] = useState("");
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [type, setType] = useState("info");
	const [channel, setChannel] = useState("in_app");
	const [actionUrl, setActionUrl] = useState("");

	const createMutation = api.create.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			void api.stats.invalidate();
			setCustomerId("");
			setTitle("");
			setBody("");
			setType("info");
			setChannel("in_app");
			setActionUrl("");
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		createMutation.mutate({
			customerId,
			title,
			body,
			type,
			channel,
			...(actionUrl.trim() ? { actionUrl: actionUrl.trim() } : {}),
		});
	};

	const error = createMutation.isError
		? "Failed to send notification. Please try again."
		: "";

	return (
		<NotificationComposerTemplate
			customerId={customerId}
			onCustomerIdChange={setCustomerId}
			title={title}
			onTitleChange={setTitle}
			body={body}
			onBodyChange={setBody}
			type={type}
			onTypeChange={setType}
			channel={channel}
			onChannelChange={setChannel}
			actionUrl={actionUrl}
			onActionUrlChange={setActionUrl}
			onSubmit={handleSubmit}
			isLoading={createMutation.isPending}
			success={createMutation.isSuccess}
			error={error}
		/>
	);
}
