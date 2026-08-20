"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import ScheduleDetailTemplate from "./schedule-detail.mdx";

const DAY_NAMES = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

interface ScheduleItem {
	id: string;
	name: string;
	dayOfWeek: number;
	startTime: string;
	endTime: string;
	capacity: number;
	surchargeInCents: number;
	active: boolean;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

function extractError(err: unknown, fallback = "Update failed"): string {
	const e = err as { message?: string } | null;
	return typeof e?.message === "string" ? e.message : fallback;
}

function useScheduleApi() {
	const client = useModuleClient();
	return {
		get: client.module("delivery-slots").admin["/admin/delivery-slots/:id"],
		update:
			client.module("delivery-slots").admin["/admin/delivery-slots/:id/update"],
	};
}

export function ScheduleDetail({ id }: { id: string }) {
	const api = useScheduleApi();
	const [editing, setEditing] = useState(false);
	const [form, setForm] = useState<Partial<ScheduleItem>>({});
	const [updateError, setUpdateError] = useState("");

	const {
		data,
		isLoading: loading,
		refetch,
	} = api.get.useQuery({ id }) as {
		data: { schedule: ScheduleItem } | undefined;
		isLoading: boolean;
		refetch: () => void;
	};

	const schedule = data?.schedule;

	const updateMutation = api.update.useMutation({
		onSuccess: () => {
			setEditing(false);
			setUpdateError("");
			void refetch();
		},
		onError: (err: Error) => setUpdateError(extractError(err)),
	});

	const startEdit = () => {
		if (!schedule) return;
		setForm({
			name: schedule.name,
			dayOfWeek: schedule.dayOfWeek,
			startTime: schedule.startTime,
			endTime: schedule.endTime,
			capacity: schedule.capacity,
			surchargeInCents: schedule.surchargeInCents,
			active: schedule.active,
		});
		setUpdateError("");
		setEditing(true);
	};

	const handleUpdate = (e: React.FormEvent) => {
		e.preventDefault();
		setUpdateError("");
		updateMutation.mutate({
			params: { id },
			...form,
		});
	};

	return (
		<ScheduleDetailTemplate
			schedule={schedule}
			loading={loading}
			dayNames={DAY_NAMES}
			editing={editing}
			form={form}
			onFormChange={(key: string, value: unknown) =>
				setForm((f) => ({ ...f, [key]: value }))
			}
			onStartEdit={startEdit}
			onCancelEdit={() => {
				setEditing(false);
				setUpdateError("");
			}}
			onUpdate={handleUpdate}
			isUpdating={updateMutation.isPending}
			updateError={updateError}
		/>
	);
}
