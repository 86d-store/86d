"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useAppointmentsApi() {
	const client = useModuleClient();
	return {
		listAppointments:
			client.module("appointments").admin["/admin/appointments"],
		getAppointment:
			client.module("appointments").admin["/admin/appointments/:id"],
		updateAppointment:
			client.module("appointments").admin["/admin/appointments/:id/update"],
		stats: client.module("appointments").admin["/admin/appointments/stats"],
		listServices:
			client.module("appointments").admin["/admin/appointments/services"],
		createService:
			client.module("appointments").admin[
				"/admin/appointments/services/create"
			],
		updateService:
			client.module("appointments").admin[
				"/admin/appointments/services/:id/update"
			],
		deleteService:
			client.module("appointments").admin[
				"/admin/appointments/services/:id/delete"
			],
		listStaff: client.module("appointments").admin["/admin/appointments/staff"],
		createStaff:
			client.module("appointments").admin["/admin/appointments/staff/create"],
		updateStaff:
			client.module("appointments").admin[
				"/admin/appointments/staff/:id/update"
			],
		deleteStaff:
			client.module("appointments").admin[
				"/admin/appointments/staff/:id/delete"
			],
	};
}

export interface Appointment {
	id: string;
	customerId?: string;
	customerName: string;
	customerEmail: string;
	customerPhone?: string;
	serviceId: string;
	staffId?: string;
	status: string;
	startsAt: string;
	endsAt: string;
	notes?: string;
	price: number;
	currency: string;
	createdAt: string;
	updatedAt: string;
}

export function formatDateTime(dateStr: string) {
	return new Date(dateStr).toLocaleString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export const STATUS_COLORS: Record<string, string> = {
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	completed:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	"no-show": "bg-muted text-muted-foreground",
};

export function extractError(err: unknown): string {
	if (err && typeof err === "object" && "message" in err) {
		return String((err as { message: string }).message);
	}
	return "An unexpected error occurred";
}
