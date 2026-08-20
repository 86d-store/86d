/**
 * Builds appointment status emails for created, confirmed, and cancelled states.
 */

type AppointmentStatusType = "created" | "confirmed" | "cancelled";

interface AppointmentStatusEmailData {
	status: AppointmentStatusType;
	customerName: string;
	serviceName: string;
	staffName?: string | undefined;
	startsAt: Date;
	locationName?: string | undefined;
	notes?: string | undefined;
}

function esc(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function formatDate(date: Date): string {
	return new Intl.DateTimeFormat("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(date);
}

const STATUS_CONFIG: Record<
	AppointmentStatusType,
	{
		subject: string;
		heading: string;
		message: string;
		bgColor: string;
	}
> = {
	created: {
		subject: "Appointment Request Received",
		heading: "Appointment Request Received",
		message:
			"We've received your appointment request. You'll hear from us shortly to confirm.",
		bgColor: "#dbeafe",
	},
	confirmed: {
		subject: "Appointment Confirmed",
		heading: "Your Appointment is Confirmed",
		message:
			"Great news! Your appointment has been confirmed. We look forward to seeing you.",
		bgColor: "#d1fae5",
	},
	cancelled: {
		subject: "Appointment Cancelled",
		heading: "Appointment Cancelled",
		message:
			"Your appointment has been cancelled. Please contact us if you'd like to reschedule.",
		bgColor: "#fee2e2",
	},
};

export function buildAppointmentStatusEmail(data: AppointmentStatusEmailData): {
	subject: string;
	html: string;
	text: string;
} {
	const config = STATUS_CONFIG[data.status];
	const dateStr = formatDate(data.startsAt);

	const text = [
		config.heading,
		"",
		`Dear ${data.customerName},`,
		"",
		config.message,
		"",
		"Appointment Details:",
		`  Service: ${data.serviceName}`,
		...(data.staffName ? [`  Staff: ${data.staffName}`] : []),
		`  Date & Time: ${dateStr}`,
		...(data.locationName ? [`  Location: ${data.locationName}`] : []),
		...(data.notes ? ["", `Notes: ${data.notes}`] : []),
	].join("\n");

	const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
	<div style="max-width:560px;margin:0 auto;padding:40px 20px">
		<div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e7eb">
			<div style="background:${config.bgColor};border-radius:6px;padding:12px 16px;margin-bottom:24px">
				<p style="margin:0;font-weight:600;font-size:14px;color:#111">${esc(config.heading)}</p>
			</div>
			<p style="margin:0 0 16px;color:#374151;font-size:15px">Dear ${esc(data.customerName)},</p>
			<p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6">${esc(config.message)}</p>
			<div style="border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin-bottom:24px">
				<p style="margin:0 0 12px;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280">Appointment Details</p>
				<table style="width:100%;border-collapse:collapse;font-size:14px">
					<tr>
						<td style="padding:4px 0;color:#6b7280;width:100px">Service</td>
						<td style="padding:4px 0;color:#111;font-weight:500">${esc(data.serviceName)}</td>
					</tr>
					${data.staffName ? `<tr><td style="padding:4px 0;color:#6b7280">Staff</td><td style="padding:4px 0;color:#111">${esc(data.staffName)}</td></tr>` : ""}
					<tr>
						<td style="padding:4px 0;color:#6b7280">Date &amp; Time</td>
						<td style="padding:4px 0;color:#111;font-weight:500">${esc(dateStr)}</td>
					</tr>
					${data.locationName ? `<tr><td style="padding:4px 0;color:#6b7280">Location</td><td style="padding:4px 0;color:#111">${esc(data.locationName)}</td></tr>` : ""}
				</table>
			</div>
			${data.notes ? `<p style="margin:0;color:#6b7280;font-size:13px;font-style:italic">${esc(data.notes)}</p>` : ""}
		</div>
	</div>
</body>
</html>`;

	return { subject: config.subject, html, text };
}
