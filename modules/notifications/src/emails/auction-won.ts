/**
 * Builds the auction won notification email for the winning bidder.
 */

interface AuctionWonEmailData {
	auctionTitle: string;
	winningBid: number;
	currency?: string | undefined;
	checkoutUrl?: string | undefined;
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

export function buildAuctionWonEmail(data: AuctionWonEmailData): {
	subject: string;
	html: string;
	text: string;
} {
	const subject = `Congratulations! You won the auction for ${data.auctionTitle}`;
	const priceStr = cents(data.winningBid, data.currency);

	const text = [
		"Congratulations!",
		"",
		`You won the auction for ${data.auctionTitle}.`,
		`Winning bid: ${priceStr}`,
		...(data.checkoutUrl
			? ["", "Complete your purchase:", data.checkoutUrl]
			: []),
	].join("\n");

	const ctaHtml = data.checkoutUrl
		? `<div style="margin-top:24px;text-align:center">
				<a href="${esc(data.checkoutUrl)}" style="display:inline-block;background:#111;color:#fff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">Complete Purchase</a>
			</div>`
		: "";

	const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
	<div style="max-width:560px;margin:0 auto;padding:40px 20px">
		<div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e7eb">
			<div style="background:#d1fae5;border-radius:6px;padding:12px 16px;margin-bottom:24px">
				<p style="margin:0;font-weight:600;font-size:14px;color:#065f46">You Won! 🎉</p>
			</div>
			<h1 style="margin:0 0 8px;font-size:20px;font-weight:600">Congratulations!</h1>
			<p style="margin:0 0 8px;color:#374151;font-size:15px">You won the auction for <strong>${esc(data.auctionTitle)}</strong>.</p>
			<p style="margin:0 0 24px;color:#6b7280;font-size:15px">Winning bid: <strong style="color:#111">${esc(priceStr)}</strong></p>
			${ctaHtml}
			<p style="margin:24px 0 0;color:#9ca3af;font-size:13px;text-align:center">Please complete your purchase to claim your item.</p>
		</div>
	</div>
</body>
</html>`;

	return { subject, html, text };
}
