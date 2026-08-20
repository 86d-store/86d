/**
 * Builds affiliate application status emails for submitted, approved, and rejected states.
 */

type AffiliateStatusType = "submitted" | "approved" | "rejected";

interface AffiliateStatusEmailData {
	status: AffiliateStatusType;
	name: string;
}

function esc(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

const STATUS_CONFIG: Record<
	AffiliateStatusType,
	{
		subject: string;
		heading: string;
		message: string;
		bgColor: string;
		textColor: string;
	}
> = {
	submitted: {
		subject: "Affiliate Application Received",
		heading: "Application Received",
		message:
			"Thank you for applying to our affiliate program! We'll review your application and get back to you soon.",
		bgColor: "#dbeafe",
		textColor: "#1e40af",
	},
	approved: {
		subject: "Welcome to Our Affiliate Program!",
		heading: "Application Approved",
		message:
			"Congratulations! Your affiliate application has been approved. Sign in to your account to access your dashboard, referral links, and commission tracking.",
		bgColor: "#d1fae5",
		textColor: "#065f46",
	},
	rejected: {
		subject: "Affiliate Application Update",
		heading: "Application Not Approved",
		message:
			"After reviewing your application, we're unable to approve it at this time. You're welcome to reapply in the future.",
		bgColor: "#fee2e2",
		textColor: "#991b1b",
	},
};

export function buildAffiliateStatusEmail(data: AffiliateStatusEmailData): {
	subject: string;
	html: string;
	text: string;
} {
	const config = STATUS_CONFIG[data.status];

	const text = [
		`Hi ${data.name},`,
		"",
		config.heading,
		"",
		config.message,
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
			<p style="margin:0 0 8px;color:#111;font-size:15px">Hi ${esc(data.name)},</p>
			<p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6">${esc(config.message)}</p>
		</div>
	</div>
</body>
</html>`;

	return { subject: config.subject, html, text };
}
