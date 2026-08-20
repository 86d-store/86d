"use client";

import {
	type Appointment,
	formatDateTime,
	STATUS_COLORS,
	useAppointmentsApi,
} from "./_shared";

export function AppointmentDetail({ params }: { params: { id: string } }) {
	const api = useAppointmentsApi();

	const { data, isLoading } = api.getAppointment.useQuery({
		params: { id: params.id },
	}) as {
		data: { appointment?: Appointment; error?: string } | undefined;
		isLoading: boolean;
	};

	const updateMutation = api.updateAppointment.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => Promise<unknown>;
		isPending: boolean;
	};

	const appointment = data?.appointment;

	const handleStatusChange = async (newStatus: string) => {
		try {
			await updateMutation.mutateAsync({
				params: { id: params.id },
				body: { status: newStatus },
			});
			window.location.reload();
		} catch {
			// silently handled
		}
	};

	if (isLoading) {
		return (
			<div className="space-y-4">
				<div className="h-8 w-48 animate-pulse rounded bg-muted/30" />
				<div className="h-48 animate-pulse rounded-lg border border-border bg-muted/30" />
			</div>
		);
	}

	if (!appointment) {
		return (
			<div className="rounded-lg border border-border bg-card p-8 text-center">
				<p className="text-muted-foreground text-sm">Appointment not found.</p>
				<a
					href="/admin/appointments"
					className="mt-2 inline-block text-sm underline"
				>
					Back to appointments
				</a>
			</div>
		);
	}

	return (
		<div>
			<div className="mb-6">
				<a
					href="/admin/appointments"
					className="text-muted-foreground text-sm hover:underline"
				>
					&larr; Back to appointments
				</a>
				<div className="mt-2 flex items-center gap-3">
					<h1 className="font-bold text-foreground text-xl">
						Appointment Details
					</h1>
					<span
						className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[appointment.status] ?? "bg-muted text-muted-foreground"}`}
					>
						{appointment.status}
					</span>
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<div className="rounded-lg border border-border bg-card p-5">
					<h2 className="mb-4 font-semibold text-foreground text-sm">
						Details
					</h2>
					<dl className="space-y-3 text-sm">
						<div className="flex justify-between">
							<dt className="text-muted-foreground">Start</dt>
							<dd className="text-foreground">
								{formatDateTime(appointment.startsAt)}
							</dd>
						</div>
						<div className="flex justify-between">
							<dt className="text-muted-foreground">End</dt>
							<dd className="text-foreground">
								{formatDateTime(appointment.endsAt)}
							</dd>
						</div>
						<div className="flex justify-between">
							<dt className="text-muted-foreground">Customer</dt>
							<dd className="text-foreground text-xs">
								{appointment.customerName}{" "}
								<span className="text-muted-foreground">
									({appointment.customerEmail})
								</span>
							</dd>
						</div>
						{appointment.customerPhone ? (
							<div className="flex justify-between">
								<dt className="text-muted-foreground">Phone</dt>
								<dd className="text-foreground text-xs">
									{appointment.customerPhone}
								</dd>
							</div>
						) : null}
						<div className="flex justify-between">
							<dt className="text-muted-foreground">Service ID</dt>
							<dd className="font-mono text-foreground text-xs">
								{appointment.serviceId}
							</dd>
						</div>
						{appointment.staffId ? (
							<div className="flex justify-between">
								<dt className="text-muted-foreground">Staff ID</dt>
								<dd className="font-mono text-foreground text-xs">
									{appointment.staffId}
								</dd>
							</div>
						) : null}
						{appointment.notes ? (
							<div className="flex justify-between">
								<dt className="text-muted-foreground">Notes</dt>
								<dd className="text-foreground">{appointment.notes}</dd>
							</div>
						) : null}
						<div className="flex justify-between">
							<dt className="text-muted-foreground">Created</dt>
							<dd className="text-foreground">
								{formatDateTime(appointment.createdAt)}
							</dd>
						</div>
					</dl>
				</div>

				<div className="rounded-lg border border-border bg-card p-5">
					<h2 className="mb-4 font-semibold text-foreground text-sm">
						Update Status
					</h2>
					<div className="space-y-2">
						<label className="block text-sm">
							<span className="mb-1 block text-muted-foreground">Status</span>
							<select
								value={appointment.status}
								onChange={(e) => handleStatusChange(e.target.value)}
								disabled={updateMutation.isPending}
								className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
							>
								<option value="pending">Pending</option>
								<option value="confirmed">Confirmed</option>
								<option value="cancelled">Cancelled</option>
								<option value="completed">Completed</option>
								<option value="no-show">No Show</option>
							</select>
						</label>
					</div>
				</div>
			</div>
		</div>
	);
}
