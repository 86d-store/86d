"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import BlackoutListTemplate from "./blackout-list.mdx";

interface BlackoutItem {
	id: string;
	date: string;
	reason?: string;
	createdAt: string;
}

function extractError(err: unknown, fallback = "Something went wrong"): string {
	const e = err as { message?: string } | null;
	return typeof e?.message === "string" ? e.message : fallback;
}

function useBlackoutsApi() {
	const client = useModuleClient();
	return {
		list: client.module("delivery-slots").admin[
			"/admin/delivery-slots/blackouts"
		],
		create:
			client.module("delivery-slots").admin[
				"/admin/delivery-slots/blackouts/create"
			],
		delete:
			client.module("delivery-slots").admin[
				"/admin/delivery-slots/blackouts/:id/delete"
			],
	};
}

export function BlackoutList() {
	const api = useBlackoutsApi();
	const [date, setDate] = useState("");
	const [reason, setReason] = useState("");
	const [formError, setFormError] = useState("");

	const { data, isLoading: loading } = api.list.useQuery({}) as {
		data: { blackouts: BlackoutItem[] } | undefined;
		isLoading: boolean;
	};

	const createMutation = api.create.useMutation({
		onSuccess: () => {
			setDate("");
			setReason("");
			setFormError("");
			void api.list.invalidate();
		},
		onError: (err: Error) =>
			setFormError(extractError(err, "Failed to add blackout date.")),
	});

	const deleteMutation = api.delete.useMutation({
		onSuccess: () => void api.list.invalidate(),
	});

	const blackouts = data?.blackouts ?? [];

	const handleCreate = (e: React.FormEvent) => {
		e.preventDefault();
		setFormError("");
		createMutation.mutate({
			date,
			...(reason.trim() ? { reason: reason.trim() } : {}),
		});
	};

	return (
		<BlackoutListTemplate
			blackouts={blackouts}
			loading={loading}
			date={date}
			reason={reason}
			onDateChange={setDate}
			onReasonChange={setReason}
			onSubmitCreate={handleCreate}
			formError={formError}
			isCreating={createMutation.isPending}
			onDelete={(id: string) => deleteMutation.mutate({ params: { id } })}
			isDeletingId={
				deleteMutation.isPending
					? ((
							deleteMutation.variables as { params: { id: string } } | undefined
						)?.params.id ?? null)
					: null
			}
		/>
	);
}
