/**
 * Builds the order shipped email sent when a fulfillment ships.
 * Includes optional carrier, tracking number, and tracking URL.
 * Returns subject, html, and plain-text versions.
 */

interface OrderShippedData {
	orderNumber: string;
	customerName: string;
	carrier?: string | undefined;
	trackingNumber?: string | undefined;
	trackingUrl?: string | undefined;
}

function esc(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export function buildOrderShippedEmail(data: OrderShippedData): {
	subject: string;
	html: string;
	text: string;
} {
	const subject = `Order ${data.orderNumber} has shipped`;

	// ── Plain text ───────────────────────────────────────────────────────
	const textLines: string[] = [
		`Order Shipped — ${data.orderNumber}`,
		"",
		`Hi ${data.customerName},`,
		"",
		"Your order has shipped!",
	];

	if (data.carrier || data.trackingNumber || data.trackingUrl) {
		textLines.push("");
		if (data.carrier) textLines.push(`Carrier: ${data.carrier}`);
		if (data.trackingNumber)
			textLines.push(`Tracking number: ${data.trackingNumber}`);
		if (data.trackingUrl)
			textLines.push(`Track your order: ${data.trackingUrl}`);
	}

	textLines.push(
		"",
		"If you have any questions about your shipment, just reply to this email.",
		"",
		"Thank you for shopping with us!",
	);

	const text = textLines.join("\n");

	// ── Tracking section for HTML ────────────────────────────────────────
	let trackingHtml = "";

	if (data.carrier || data.trackingNumber) {
		const rows: string[] = [];
		if (data.carrier) {
			rows.push(
				`<tr><td style="padding:4px 0;color:#6b7280;font-size:14px">Carrier</td><td style="padding:4px 0;font-size:14px;text-align:right">${esc(data.carrier)}</td></tr>`,
			);
		}
		if (data.trackingNumber) {
			rows.push(
				`<tr><td style="padding:4px 0;color:#6b7280;font-size:14px">Tracking</td><td style="padding:4px 0;font-size:14px;font-family:monospace;text-align:right">${esc(data.trackingNumber)}</td></tr>`,
			);
		}
		trackingHtml = `
			<div style="background:#f3f4f6;border-radius:6px;padding:16px;margin:24px 0">
				<table style="width:100%;border-collapse:collapse">${rows.join("")}</table>
			</div>`;
	}

	let ctaHtml = "";
	if (data.trackingUrl) {
		ctaHtml = `
			<div style="margin-top:24px;text-align:center">
				<a href="${esc(data.trackingUrl)}" style="display:inline-block;background:#111;color:#fff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">Track Your Order</a>
			</div>`;
	}

	// ── HTML ─────────────────────────────────────────────────────────────
	const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
	<div style="max-width:560px;margin:0 auto;padding:40px 20px">
		<div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e7eb">
			<div style="text-align:center;margin-bottom:24px">
				<div style="display:inline-block;width:48px;height:48px;background:#dbeafe;border-radius:50%;line-height:48px;font-size:24px">&#128230;</div>
			</div>
			<h1 style="margin:0 0 4px;font-size:20px;font-weight:600;text-align:center">Order Shipped</h1>
			<p style="margin:0 0 24px;color:#6b7280;font-size:14px;text-align:center">${esc(data.orderNumber)}</p>
			<p style="margin:0 0 16px;font-size:15px">Hi ${esc(data.customerName)},</p>
			<p style="margin:0 0 16px;font-size:15px">Your order has shipped!</p>${trackingHtml}${ctaHtml}
			<p style="margin:24px 0 0;color:#9ca3af;font-size:13px;text-align:center">If you have any questions, just reply to this email.</p>
		</div>
	</div>
</body>
</html>`;

	return { subject, html, text };
}
