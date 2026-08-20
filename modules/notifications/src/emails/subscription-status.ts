/**
 * Builds subscription status emails for created, cancelled, and renewed states.
 */

type SubscriptionStatusType = "created" | "cancelled" | "renewed";

interface SubscriptionStatusEmailData {
	status: SubscriptionStatusType;
	customerEmail: string;
	planName: string;
	price?: number | undefined;
	currency?: string | undefined;
	nextBillingDate?: Date | undefined;
}

function esc(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function cents(amount: number, currency: string): string {
	return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

function formatDate(date: Date): string {
	return new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	}).format(date);
}

const STATUS_CONFIG: Record<
	SubscriptionStatusType,
	{ subject: string; heading: string; message: string; bgColor: string }
> = {
	created: {
		subject: "Subscription Confirmed",
		heading: "Welcome to Your Subscription",
		message: "Your subscription is now active. Thank you for subscribing!",
		bgColor: "#d1fae5",
	},
	cancelled: {
		subject: "Subscription Cancelled",
		heading: "Subscription Cancelled",
		message:
			"Your subscription has been cancelled. You will continue to have access until the end of your current billing period.",
		bgColor: "#fee2e2",
	},
	renewed: {
		subject: "Subscription Renewed",
		heading: "Subscription Renewed",
		message:
			"Your subscription has been renewed. Thank you for your continued support!",
		bgColor: "#dbeafe",
	},
};

export function buildSubscriptionStatusEmail(
	data: SubscriptionStatusEmailData,
): { subject: string; html: string; text: string } {
	const config = STATUS_CONFIG[data.status];

	const text = [
		config.heading,
		"",
		config.message,
		"",
		`Plan: ${data.planName}`,
		...(data.price !== undefined && data.currency
			? [`Amount: ${cents(data.price, data.currency)}`]
			: []),
		...(data.nextBillingDate
			? [`Next billing: ${formatDate(data.nextBillingDate)}`]
			: []),
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
			<p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6">${esc(config.message)}</p>
			<div style="border:1px solid #e5e7eb;border-radius:6px;padding:16px">
				<p style="margin:0 0 12px;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280">Subscription Details</p>
				<table style="width:100%;border-collapse:collapse;font-size:14px">
					<tr>
						<td style="padding:4px 0;color:#6b7280;width:120px">Plan</td>
						<td style="padding:4px 0;color:#111;font-weight:500">${esc(data.planName)}</td>
					</tr>
					${data.price !== undefined && data.currency ? `<tr><td style="padding:4px 0;color:#6b7280">Amount</td><td style="padding:4px 0;color:#111">${cents(data.price, data.currency)}</td></tr>` : ""}
					${data.nextBillingDate ? `<tr><td style="padding:4px 0;color:#6b7280">Next billing</td><td style="padding:4px 0;color:#111">${esc(formatDate(data.nextBillingDate))}</td></tr>` : ""}
				</table>
			</div>
		</div>
	</div>
</body>
</html>`;

	return { subject: config.subject, html, text };
}
