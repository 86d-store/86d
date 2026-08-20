/**
 * Builds the order cancelled email sent when an order is cancelled
 * (by admin or customer). Returns subject, html, and plain-text versions.
 */

interface OrderCancelledData {
	orderNumber: string;
	customerName: string;
	reason?: string | undefined;
}

function esc(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export function buildOrderCancelledEmail(data: OrderCancelledData): {
	subject: string;
	html: string;
	text: string;
} {
	const subject = `Order ${data.orderNumber} has been cancelled`;

	const textLines = [
		`Order Cancelled — ${data.orderNumber}`,
		"",
		`Hi ${data.customerName},`,
		"",
		"Your order has been cancelled.",
	];

	if (data.reason) {
		textLines.push("", `Reason: ${data.reason}`);
	}

	textLines.push(
		"",
		"If a payment was collected, a refund will be processed automatically. Please allow a few business days for the refund to appear on your statement.",
		"",
		"If you have any questions, please contact our support team.",
	);

	const text = textLines.join("\n");

	const reasonHtml = data.reason
		? `<div style="margin:16px 0;padding:12px 16px;background:#f9fafb;border-radius:6px;border-left:3px solid #d1d5db">
				<p style="margin:0;font-size:14px;color:#6b7280"><strong style="color:#374151">Reason:</strong> ${esc(data.reason)}</p>
			</div>`
		: "";

	const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
	<div style="max-width:560px;margin:0 auto;padding:40px 20px">
		<div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e7eb">
			<h1 style="margin:0 0 4px;font-size:20px;font-weight:600">Order Cancelled</h1>
			<p style="margin:0 0 24px;color:#6b7280;font-size:14px">${esc(data.orderNumber)}</p>
			<p style="margin:0 0 16px;font-size:15px">Hi ${esc(data.customerName)},</p>
			<p style="margin:0 0 16px;font-size:15px">Your order has been cancelled.</p>
			${reasonHtml}
			<p style="margin:16px 0 0;font-size:14px;color:#6b7280">If a payment was collected, a refund will be processed automatically. Please allow a few business days for the refund to appear on your statement.</p>
		</div>
	</div>
</body>
</html>`;

	return { subject, html, text };
}
