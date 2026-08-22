"use client";

import { useState } from "react";
import {
	type Appointment,
	formatDateTime,
	STATUS_COLORS,
	useAppointmentsApi,
} from "./_shared";

interface AppointmentStats {
	totalAppointments: number;
	pendingAppointments: number;
	confirmedAppointments: number;
	completedAppointments: number;
	cancelledAppointments: number;
}

function formatDate(dateStr: string) {
	return new Date(dateStr).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function AppointmentList() {
	const api = useAppointmentsApi();
	const [statusFilter, setStatusFilter] = useState("");

	const { data, isLoading } = api.listAppointments.useQuery({
		...(statusFilter ? { status: statusFilter } : {}),
	}) as {
		data: { appointments?: Appointment[] } | undefined;
		isLoading: boolean;
	};
	const { data: statsData } = api.stats.useQuery({}) as {
		data: { stats?: AppointmentStats } | undefined;
	};

	const appointments = data?.appointments ?? [];
	const stats = statsData?.stats;

	return (
		<div>
			<div className="mb-6">
				<h1 className="font-bold text-2xl text-foreground">Appointments</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Manage customer appointments
				</p>
			</div>

			{/* Stats */}
			{stats ? (
				<div className="mb-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Total
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{stats.totalAppointments}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Pending
						</p>
						<p className="mt-1 font-bold text-2xl text-yellow-600">
							{stats.pendingAppointments}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Confirmed
						</p>
						<p className="mt-1 font-bold text-2xl text-blue-600">
							{stats.confirmedAppointments}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Completed
						</p>
						<p className="mt-1 font-bold text-2xl text-green-600">
							{stats.completedAppointments}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Cancelled
						</p>
						<p className="mt-1 font-bold text-2xl text-red-600">
							{stats.cancelledAppointments}
						</p>
					</div>
				</div>
			) : null}

			{/* Filter */}
			<div className="mb-4">
				<select
					aria-label="Filter by status"
					value={statusFilter}
					onChange={(e) => setStatusFilter(e.target.value)}
					className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
				>
					<option value="">All statuses</option>
					<option value="pending">Pending</option>
					<option value="confirmed">Confirmed</option>
					<option value="cancelled">Cancelled</option>
					<option value="completed">Completed</option>
					<option value="no-show">No Show</option>
				</select>
			</div>

			{/* Appointment list */}
			{isLoading ? (
				<div className="space-y-3">
					{(["k0", "k1", "k2", "k3"] as const).map((key) => (
						<div
							key={key}
							className="h-16 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : appointments.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">
						No appointments found.
					</p>
				</div>
			) : (
				<div className="space-y-3">
					{appointments.map((appt) => (
						<a
							key={appt.id}
							href={`/admin/appointments/${appt.id}`}
							className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/20"
						>
							<div className="flex items-start justify-between gap-4">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<p className="font-medium text-foreground text-sm">
											{formatDateTime(appt.startsAt)}
										</p>
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[appt.status] ?? "bg-muted text-muted-foreground"}`}
										>
											{appt.status}
										</span>
									</div>
									<div className="mt-1.5 flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
										<span>{appt.customerName}</span>
										<span className="text-muted-foreground/50">·</span>
										<span>{appt.customerEmail}</span>
										{appt.notes ? (
											<>
												<span className="text-muted-foreground/50">·</span>
												<span>{appt.notes}</span>
											</>
										) : null}
									</div>
								</div>
								<span className="whitespace-nowrap text-muted-foreground text-xs">
									{formatDate(appt.createdAt)}
								</span>
							</div>
						</a>
					))}
				</div>
			)}
		</div>
	);
}
