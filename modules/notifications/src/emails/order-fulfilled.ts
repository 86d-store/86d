/**
 * Builds the order fulfilled email sent when an admin marks an order as completed.
 * Returns subject, html, and plain-text versions.
 */

interface OrderFulfilledData {
	orderNumber: string;
	customerName: string;
}

function esc(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export function buildOrderFulfilledEmail(data: OrderFulfilledData): {
	subject: string;
	html: string;
	text: string;
} {
	const subject = `Order ${data.orderNumber} has been fulfilled`;

	const text = [
		`Order Fulfilled — ${data.orderNumber}`,
		"",
		`Hi ${data.customerName},`,
		"",
		"Great news! Your order has been fulfilled and is on its way.",
		"",
		"If you have any questions about your order, please don't hesitate to reach out.",
		"",
		"Thank you for shopping with us!",
	].join("\n");

	const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
	<div style="max-width:560px;margin:0 auto;padding:40px 20px">
		<div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e7eb">
			<div style="text-align:center;margin-bottom:24px">
				<div style="display:inline-block;width:48px;height:48px;background:#dcfce7;border-radius:50%;line-height:48px;font-size:24px">&#10003;</div>
			</div>
			<h1 style="margin:0 0 4px;font-size:20px;font-weight:600;text-align:center">Order Fulfilled</h1>
			<p style="margin:0 0 24px;color:#6b7280;font-size:14px;text-align:center">${esc(data.orderNumber)}</p>
			<p style="margin:0 0 16px;font-size:15px">Hi ${esc(data.customerName)},</p>
			<p style="margin:0 0 16px;font-size:15px">Great news! Your order has been fulfilled and is on its way.</p>
			<p style="margin:0 0 24px;font-size:15px;color:#6b7280">If you have any questions about your order, please don't hesitate to reach out.</p>
			<p style="margin:0;font-size:15px">Thank you for shopping with us!</p>
		</div>
	</div>
</body>
</html>`;

	return { subject, html, text };
}
