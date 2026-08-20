/**
 * Builds the cart recovery email sent when an admin triggers recovery
 * for an abandoned cart. Returns subject, html, and plain-text versions.
 */

interface CartRecoveryEmailData {
	items: Array<{
		name: string;
		quantity: number;
		price: number;
		imageUrl?: string | undefined;
	}>;
	cartTotal: number;
	currency: string;
	recoveryUrl: string;
	subject?: string | undefined;
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

export function buildCartRecoveryEmail(data: CartRecoveryEmailData): {
	subject: string;
	html: string;
	text: string;
} {
	const subject = data.subject ?? "You left something behind!";

	// ── Plain text version ──────────────────────────────────────────────
	const textLines: string[] = [
		"You left something behind!",
		"",
		"It looks like you didn't finish checking out. Here's what's in your cart:",
		"",
	];

	for (const item of data.items) {
		textLines.push(
			`  ${item.name} x${item.quantity} — ${cents(item.price * item.quantity, data.currency)}`,
		);
	}

	textLines.push(
		"",
		`Cart total: ${cents(data.cartTotal, data.currency)}`,
		"",
		"Complete your purchase:",
		data.recoveryUrl,
	);

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

	const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
	<div style="max-width:560px;margin:0 auto;padding:40px 20px">
		<div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e7eb">
			<h1 style="margin:0 0 8px;font-size:20px;font-weight:600">You left something behind!</h1>
			<p style="margin:0 0 24px;color:#6b7280;font-size:15px">It looks like you didn't finish checking out. Here's what's still in your cart:</p>
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
					<tr>
						<td style="padding:12px 0 0;font-weight:700;font-size:16px">Cart Total</td>
						<td style="padding:12px 0 0;text-align:right;font-weight:700;font-size:16px">${cents(data.cartTotal, data.currency)}</td>
					</tr>
				</tbody>
			</table>
			<div style="margin-top:32px;text-align:center">
				<a href="${esc(data.recoveryUrl)}" style="display:inline-block;background:#111;color:#fff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">Complete Your Purchase</a>
			</div>
			<p style="margin:24px 0 0;color:#9ca3af;font-size:13px;text-align:center">If you have any questions, just reply to this email.</p>
		</div>
	</div>
</body>
</html>`;

	return { subject, html, text };
}
