"use client";

import { useState } from "react";
import { useAppointmentsStoreApi } from "./_hooks";
import {
	extractError,
	formatCurrency,
	formatDateTime,
	STATUS_COLORS,
	STATUS_LABELS,
} from "./_utils";
import MyAppointmentsTemplate from "./my-appointments.mdx";

// ── Types ────────────────────────────────────────────────────────────────────

interface Appointment {
	id: string;
	serviceId: string;
	staffId: string;
	customerName: string;
	customerEmail: string;
	startsAt: string;
	endsAt: string;
	status: string;
	notes?: string | undefined;
	price: number;
	currency: string;
}

// ── MyAppointments ───────────────────────────────────────────────────────────

export function MyAppointments(props: {
	appointmentId?: string | undefined;
	params?: Record<string, string> | undefined;
}) {
	const appointmentId = props.appointmentId ?? props.params?.id;
	const api = useAppointmentsStoreApi();

	const [cancelError, setCancelError] = useState<string | null>(null);
	const [cancelledId, setCancelledId] = useState<string | null>(null);

	// List mode: fetch all customer appointments when no specific ID given
	const listQuery = api.listMyAppointments.useQuery(
		{},
		{ enabled: !appointmentId },
	) as {
		data:
			| { appointments: Appointment[] }
			| { error: string; status: number }
			| undefined;
		isLoading: boolean;
		error: Error | null;
	};

	// Detail mode: fetch a specific appointment by ID
	const detailQuery = api.getAppointment.useQuery(
		{ params: { id: appointmentId ?? "" } },
		{ enabled: Boolean(appointmentId) },
	) as {
		data: { appointment?: Appointment; error?: string } | undefined;
		isLoading: boolean;
		error: Error | null;
	};

	const cancelMutation = api.cancel.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: Record<string, never>;
		}) => Promise<{ appointment?: Appointment; error?: string }>;
		isPending: boolean;
	};

	const appointment = detailQuery.data?.appointment ?? null;
	const isCancellable =
		appointment &&
		(appointment.status === "pending" || appointment.status === "confirmed");

	const listData = listQuery.data as
		| { appointments: Appointment[] }
		| undefined;
	const appointments = listData?.appointments ?? [];

	const isUnauthenticated =
		!appointmentId &&
		!listQuery.isLoading &&
		(listQuery.data as { status?: number } | undefined)?.status === 401;

	async function handleCancel() {
		if (!appointment) return;
		setCancelError(null);
		try {
			const result = await cancelMutation.mutateAsync({
				params: { id: appointment.id },
				body: {},
			});
			if (result.appointment) {
				setCancelledId(result.appointment.id);
			} else {
				setCancelError(result.error ?? "Could not cancel appointment.");
			}
		} catch (err) {
			setCancelError(extractError(err, "Could not cancel appointment."));
		}
	}

	const isCancelled =
		cancelledId === appointment?.id || appointment?.status === "cancelled";

	return (
		<MyAppointmentsTemplate
			// Detail mode
			appointmentId={appointmentId}
			isLoading={appointmentId ? detailQuery.isLoading : listQuery.isLoading}
			appointment={appointment}
			fetchError={
				appointmentId
					? detailQuery.error
						? extractError(detailQuery.error, "Failed to load appointment")
						: (detailQuery.data?.error ?? null)
					: listQuery.error
						? extractError(listQuery.error, "Failed to load appointments")
						: null
			}
			isCancellable={Boolean(isCancellable) && !isCancelled}
			isCancelling={cancelMutation.isPending}
			cancelError={cancelError}
			isCancelled={isCancelled}
			onCancel={handleCancel}
			// List mode
			appointments={appointments}
			isUnauthenticated={isUnauthenticated}
			formatDateTime={formatDateTime}
			formatCurrency={formatCurrency}
			statusColors={STATUS_COLORS}
			statusLabels={STATUS_LABELS}
		/>
	);
}
