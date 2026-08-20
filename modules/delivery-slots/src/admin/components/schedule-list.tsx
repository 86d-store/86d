"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import ScheduleListTemplate from "./schedule-list.mdx";

const PAGE_SIZE = 50;

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
}

interface SummaryData {
	totalSchedules: number;
	activeSchedules: number;
	totalBookings: number;
	confirmedBookings: number;
	cancelledBookings: number;
	totalSurchargeRevenue: number;
	blackoutDates: number;
}

function extractError(err: unknown, fallback = "Something went wrong"): string {
	const e = err as { message?: string } | null;
	return typeof e?.message === "string" ? e.message : fallback;
}

function useDeliverySlotsApi() {
	const client = useModuleClient();
	return {
		list: client.module("delivery-slots").admin["/admin/delivery-slots"],
		summary:
			client.module("delivery-slots").admin["/admin/delivery-slots/summary"],
		create:
			client.module("delivery-slots").admin["/admin/delivery-slots/create"],
		delete:
			client.module("delivery-slots").admin["/admin/delivery-slots/:id/delete"],
	};
}

const EMPTY_FORM = {
	name: "",
	dayOfWeek: 1,
	startTime: "09:00",
	endTime: "17:00",
	capacity: 10,
	surchargeInCents: 0,
	active: true,
};

export function ScheduleList() {
	const api = useDeliverySlotsApi();
	const [activeFilter, setActiveFilter] = useState("");
	const [showCreate, setShowCreate] = useState(false);
	const [form, setForm] = useState({ ...EMPTY_FORM });
	const [formError, setFormError] = useState("");

	const queryInput: Record<string, string> = {
		take: String(PAGE_SIZE),
	};
	if (activeFilter) queryInput.active = activeFilter;

	const { data: listData, isLoading: loading } = api.list.useQuery(
		queryInput,
	) as {
		data: { schedules: ScheduleItem[] } | undefined;
		isLoading: boolean;
	};

	const { data: summaryData } = api.summary.useQuery({}) as {
		data: { summary: SummaryData } | undefined;
	};

	const createMutation = api.create.useMutation({
		onSuccess: () => {
			setShowCreate(false);
			setForm({ ...EMPTY_FORM });
			setFormError("");
			void api.list.invalidate();
			void api.summary.invalidate();
		},
		onError: (err: Error) =>
			setFormError(extractError(err, "Failed to create schedule.")),
	});

	const deleteMutation = api.delete.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			void api.summary.invalidate();
		},
	});

	const schedules = listData?.schedules ?? [];
	const summaryInfo = summaryData?.summary;

	const handleCreate = (e: React.FormEvent) => {
		e.preventDefault();
		setFormError("");
		createMutation.mutate({
			name: form.name,
			dayOfWeek: form.dayOfWeek,
			startTime: form.startTime,
			endTime: form.endTime,
			capacity: form.capacity,
			surchargeInCents: form.surchargeInCents,
			active: form.active,
		});
	};

	return (
		<ScheduleListTemplate
			schedules={schedules}
			summary={summaryInfo}
			loading={loading}
			activeFilter={activeFilter}
			onActiveChange={setActiveFilter}
			dayNames={DAY_NAMES}
			showCreate={showCreate}
			onShowCreate={() => setShowCreate(true)}
			onHideCreate={() => {
				setShowCreate(false);
				setFormError("");
			}}
			form={form}
			onFormChange={(key: string, value: unknown) =>
				setForm((f) => ({ ...f, [key]: value }))
			}
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
