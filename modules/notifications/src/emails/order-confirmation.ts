/**
 * Builds the order confirmation email sent after checkout.completed.
 * Returns subject, html, and plain-text versions.
 */

interface OrderEmailData {
	orderNumber: string;
	customerName: string;
	items: Array<{ name: string; quantity: number; price: number }>;
	subtotal: number;
	taxAmount: number;
	shippingAmount: number;
	discountAmount: number;
	giftCardAmount: number;
	total: number;
	currency: string;
	shippingAddress?: {
		firstName?: string;
		lastName?: string;
		line1?: string;
		line2?: string;
		city?: string;
		state?: string;
		postalCode?: string;
		country?: string;
	};
}

function esc(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function cents(amount: number, currency: string): string {
	const code = currency.toUpperCase();
	const value = (amount / 100).toFixed(2);
	return `${value} ${code}`;
}

export function buildOrderConfirmationEmail(data: OrderEmailData): {
	subject: string;
	html: string;
	text: string;
} {
	const subject = `Order ${data.orderNumber} confirmed`;

	// ── Plain text version ──────────────────────────────────────────────
	const textLines: string[] = [
		`Order Confirmed — ${data.orderNumber}`,
		"",
		`Hi ${data.customerName},`,
		"",
		"Thank you for your order! Here's your summary:",
		"",
	];

	for (const item of data.items) {
		textLines.push(
			`  ${item.name} x${item.quantity} — ${cents(item.price * item.quantity, data.currency)}`,
		);
	}

	textLines.push("", `Subtotal: ${cents(data.subtotal, data.currency)}`);
	if (data.shippingAmount > 0) {
		textLines.push(`Shipping: ${cents(data.shippingAmount, data.currency)}`);
	}
	if (data.taxAmount > 0) {
		textLines.push(`Tax: ${cents(data.taxAmount, data.currency)}`);
	}
	if (data.discountAmount > 0) {
		textLines.push(`Discount: -${cents(data.discountAmount, data.currency)}`);
	}
	if (data.giftCardAmount > 0) {
		textLines.push(`Gift card: -${cents(data.giftCardAmount, data.currency)}`);
	}
	textLines.push(`Total: ${cents(data.total, data.currency)}`);

	if (data.shippingAddress) {
		const a = data.shippingAddress;
		textLines.push("", "Shipping to:");
		const nameLine = [a.firstName, a.lastName].filter(Boolean).join(" ");
		if (nameLine) textLines.push(`  ${nameLine}`);
		if (a.line1) textLines.push(`  ${a.line1}`);
		if (a.line2) textLines.push(`  ${a.line2}`);
		const cityLine = [a.city, a.state, a.postalCode].filter(Boolean).join(", ");
		if (cityLine) textLines.push(`  ${cityLine}`);
		if (a.country) textLines.push(`  ${a.country}`);
	}

	const text = textLines.join("\n");

	// ── HTML version ────────────────────────────────────────────────────
	const itemRowsHtml = data.items
		.map(
			(item) =>
				`<tr>
					<td style="padding:8px 0;border-bottom:1px solid #eee">${esc(item.name)}</td>
					<td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
					<td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${cents(item.price * item.quantity, data.currency)}</td>
				</tr>`,
		)
		.join("\n");

	const summaryRows: string[] = [];
	summaryRows.push(row("Subtotal", cents(data.subtotal, data.currency)));
	if (data.shippingAmount > 0) {
		summaryRows.push(
			row("Shipping", cents(data.shippingAmount, data.currency)),
		);
	}
	if (data.taxAmount > 0) {
		summaryRows.push(row("Tax", cents(data.taxAmount, data.currency)));
	}
	if (data.discountAmount > 0) {
		summaryRows.push(
			row("Discount", `-${cents(data.discountAmount, data.currency)}`),
		);
	}
	if (data.giftCardAmount > 0) {
		summaryRows.push(
			row("Gift card", `-${cents(data.giftCardAmount, data.currency)}`),
		);
	}

	let addressHtml = "";
	if (data.shippingAddress) {
		const a = data.shippingAddress;
		const lines: string[] = [];
		const nameLine = [a.firstName, a.lastName].filter(Boolean).join(" ");
		if (nameLine) lines.push(esc(nameLine));
		if (a.line1) lines.push(esc(a.line1));
		if (a.line2) lines.push(esc(a.line2));
		const cityLine = [a.city, a.state, a.postalCode].filter(Boolean).join(", ");
		if (cityLine) lines.push(esc(cityLine));
		if (a.country) lines.push(esc(a.country));

		addressHtml = `
			<div style="margin-top:24px">
				<h3 style="margin:0 0 8px;font-size:14px;color:#666">Shipping to</h3>
				<p style="margin:0;line-height:1.6">${lines.join("<br>")}</p>
			</div>`;
	}

	const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
	<div style="max-width:560px;margin:0 auto;padding:40px 20px">
		<div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e7eb">
			<h1 style="margin:0 0 4px;font-size:20px;font-weight:600">Order Confirmed</h1>
			<p style="margin:0 0 24px;color:#6b7280;font-size:14px">${esc(data.orderNumber)}</p>
			<p style="margin:0 0 24px;font-size:15px">Hi ${esc(data.customerName)}, thank you for your order!</p>
			<table style="width:100%;border-collapse:collapse;font-size:14px">
				<thead>
					<tr style="border-bottom:2px solid #e5e7eb">
						<th style="padding:8px 0;text-align:left;font-weight:600">Item</th>
						<th style="padding:8px 0;text-align:center;font-weight:600">Qty</th>
						<th style="padding:8px 0;text-align:right;font-weight:600">Price</th>
					</tr>
				</thead>
				<tbody>${itemRowsHtml}</tbody>
			</table>
			<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:16px">
				<tbody>
					${summaryRows.join("\n")}
					<tr>
						<td style="padding:12px 0 0;font-weight:700;font-size:16px">Total</td>
						<td style="padding:12px 0 0;text-align:right;font-weight:700;font-size:16px">${cents(data.total, data.currency)}</td>
					</tr>
				</tbody>
			</table>
			${addressHtml}
		</div>
	</div>
</body>
</html>`;

	return { subject, html, text };
}

function row(label: string, value: string): string {
	return `<tr>
		<td style="padding:4px 0;color:#6b7280">${label}</td>
		<td style="padding:4px 0;text-align:right">${value}</td>
	</tr>`;
}
