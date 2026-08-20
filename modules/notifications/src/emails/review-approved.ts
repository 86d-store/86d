/**
 * Builds the review approved notification email.
 */

interface ReviewApprovedEmailData {
	productName?: string | undefined;
	rating: number;
}

function esc(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function starRating(rating: number): string {
	const filled = Math.round(Math.max(1, Math.min(5, rating)));
	return "★".repeat(filled) + "☆".repeat(5 - filled);
}

export function buildReviewApprovedEmail(data: ReviewApprovedEmailData): {
	subject: string;
	html: string;
	text: string;
} {
	const subject = data.productName
		? `Your review of ${data.productName} has been approved`
		: "Your review has been approved";

	const stars = starRating(data.rating);

	const text = [
		"Great news!",
		"",
		subject,
		"",
		`Rating: ${stars} (${data.rating}/5)`,
		"",
		"Thank you for sharing your feedback. Your review is now live and will help other customers make informed decisions.",
	].join("\n");

	const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
	<div style="max-width:560px;margin:0 auto;padding:40px 20px">
		<div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e7eb">
			<div style="background:#d1fae5;border-radius:6px;padding:12px 16px;margin-bottom:24px">
				<p style="margin:0;font-weight:600;font-size:14px;color:#065f46">Review Approved!</p>
			</div>
			<h1 style="margin:0 0 8px;font-size:20px;font-weight:600">Your review is live!</h1>
			<p style="margin:0 0 8px;color:#374151;font-size:15px">
				${data.productName ? `Your review of <strong>${esc(data.productName)}</strong> has been approved and is now visible to other shoppers.` : "Your review has been approved and is now visible to other shoppers."}
			</p>
			<p style="margin:0 0 24px;font-size:24px">${stars}</p>
			<p style="margin:0;color:#6b7280;font-size:14px">Thank you for sharing your feedback. Your honest opinion helps other customers make informed decisions.</p>
		</div>
	</div>
</body>
</html>`;

	return { subject, html, text };
}
