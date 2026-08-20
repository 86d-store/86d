/**
 * Builds quote status emails for submitted, reviewed, accepted, rejected, and converted states.
 */

type QuoteStatusType =
	| "submitted"
	| "reviewed"
	| "accepted"
	| "rejected"
	| "converted";

interface QuoteStatusEmailData {
	status: QuoteStatusType;
	quoteId: string;
	total?: number | undefined;
	currency?: string | undefined;
	reason?: string | undefined;
}

function esc(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function cents(amount: number, currency?: string): string {
	const code = (currency ?? "USD").toUpperCase();
	return `${(amount / 100).toFixed(2)} ${code}`;
}

const STATUS_CONFIG: Record<
	QuoteStatusType,
	{
		subject: string;
		heading: string;
		message: string;
		bgColor: string;
		textColor: string;
	}
> = {
	submitted: {
		subject: "Quote Request Received",
		heading: "Quote Request Received",
		message:
			"We've received your quote request and our team will review it shortly. You'll be notified when your quote is ready.",
		bgColor: "#dbeafe",
		textColor: "#1e40af",
	},
	reviewed: {
		subject: "Your Quote Is Ready",
		heading: "Your Quote Is Ready",
		message:
			"Your quote has been reviewed and is ready for your consideration. Sign in to your account to view the details and accept or decline.",
		bgColor: "#d1fae5",
		textColor: "#065f46",
	},
	accepted: {
		subject: "Quote Accepted",
		heading: "Quote Accepted",
		message:
			"You've accepted your quote. We're processing your order and will be in touch shortly.",
		bgColor: "#d1fae5",
		textColor: "#065f46",
	},
	rejected: {
		subject: "Quote Declined",
		heading: "Quote Declined",
		message:
			"Your quote request has been declined. If you have questions, please contact us.",
		bgColor: "#fee2e2",
		textColor: "#991b1b",
	},
	converted: {
		subject: "Quote Converted to Order",
		heading: "Your Order Is Confirmed",
		message:
			"Your accepted quote has been converted to an order. Thank you for your business!",
		bgColor: "#d1fae5",
		textColor: "#065f46",
	},
};

export function buildQuoteStatusEmail(data: QuoteStatusEmailData): {
	subject: string;
	html: string;
	text: string;
} {
	const config = STATUS_CONFIG[data.status];

	const text = [
		config.heading,
		"",
		config.message,
		"",
		`Quote ID: ${data.quoteId}`,
		...(data.total !== undefined
			? [`Total: ${cents(data.total, data.currency)}`]
			: []),
		...(data.reason ? [`Reason: ${data.reason}`] : []),
	].join("\n");

	const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
	<div style="max-width:560px;margin:0 auto;padding:40px 20px">
		<div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e7eb">
			<div style="background:${config.bgColor};border-radius:6px;padding:12px 16px;margin-bottom:24px">
				<p style="margin:0;font-weight:600;font-size:14px;color:${config.textColor}">${esc(config.heading)}</p>
			</div>
			<p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6">${esc(config.message)}</p>
			<div style="border:1px solid #e5e7eb;border-radius:6px;padding:16px">
				<p style="margin:0 0 12px;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280">Quote Details</p>
				<table style="width:100%;border-collapse:collapse;font-size:14px">
					<tr>
						<td style="padding:4px 0;color:#6b7280;width:80px">Quote ID</td>
						<td style="padding:4px 0;color:#111;font-family:monospace;font-size:13px">${esc(data.quoteId)}</td>
					</tr>
					${data.total !== undefined ? `<tr><td style="padding:4px 0;color:#6b7280">Total</td><td style="padding:4px 0;color:#111;font-weight:500">${esc(cents(data.total, data.currency))}</td></tr>` : ""}
					${data.reason ? `<tr><td style="padding:4px 0;color:#6b7280">Reason</td><td style="padding:4px 0;color:#111">${esc(data.reason)}</td></tr>` : ""}
				</table>
			</div>
		</div>
	</div>
</body>
</html>`;

	return { subject: config.subject, html, text };
}
