/**
 * Builds the back-in-stock notification email sent when an item becomes available.
 */

interface BackInStockEmailData {
	productName: string;
	productUrl?: string | undefined;
}

function esc(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export function buildBackInStockEmail(data: BackInStockEmailData): {
	subject: string;
	html: string;
	text: string;
} {
	const subject = `${data.productName} is back in stock!`;

	const text = [
		"Good news!",
		"",
		`${data.productName} is back in stock.`,
		"",
		"Don't wait — stock is limited!",
		...(data.productUrl ? ["", "Shop now:", data.productUrl] : []),
	].join("\n");

	const ctaHtml = data.productUrl
		? `<div style="margin-top:32px;text-align:center">
				<a href="${esc(data.productUrl)}" style="display:inline-block;background:#111;color:#fff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">Shop Now</a>
			</div>`
		: "";

	const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
	<div style="max-width:560px;margin:0 auto;padding:40px 20px">
		<div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e7eb">
			<div style="background:#d1fae5;border-radius:6px;padding:12px 16px;margin-bottom:24px">
				<p style="margin:0;font-weight:600;font-size:14px;color:#065f46">Back in Stock!</p>
			</div>
			<h1 style="margin:0 0 8px;font-size:20px;font-weight:600">Good news!</h1>
			<p style="margin:0 0 24px;color:#6b7280;font-size:15px">
				<strong style="color:#111">${esc(data.productName)}</strong> is back in stock. Don&apos;t wait — stock is limited!
			</p>
			${ctaHtml}
			<p style="margin:24px 0 0;color:#9ca3af;font-size:13px;text-align:center">You subscribed to back-in-stock alerts for this item.</p>
		</div>
	</div>
</body>
</html>`;

	return { subject, html, text };
}
