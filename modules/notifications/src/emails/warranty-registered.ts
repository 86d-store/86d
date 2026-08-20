/**
 * Builds the warranty registration confirmation email.
 */

interface WarrantyRegisteredEmailData {
	productName: string;
	warrantyPlanName?: string | undefined;
	expiresAt?: Date | undefined;
	serialNumber?: string | undefined;
}

function esc(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function formatDate(date: Date): string {
	return new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	}).format(date);
}

export function buildWarrantyRegisteredEmail(
	data: WarrantyRegisteredEmailData,
): { subject: string; html: string; text: string } {
	const subject = `Warranty registered for ${data.productName}`;

	const text = [
		"Your warranty is registered!",
		"",
		`Product: ${data.productName}`,
		...(data.warrantyPlanName ? [`Plan: ${data.warrantyPlanName}`] : []),
		...(data.serialNumber ? [`Serial: ${data.serialNumber}`] : []),
		...(data.expiresAt ? [`Expires: ${formatDate(data.expiresAt)}`] : []),
		"",
		"Keep this email for your records. If you need to make a warranty claim, visit your account to submit a request.",
	].join("\n");

	const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
	<div style="max-width:560px;margin:0 auto;padding:40px 20px">
		<div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e7eb">
			<div style="background:#dbeafe;border-radius:6px;padding:12px 16px;margin-bottom:24px">
				<p style="margin:0;font-weight:600;font-size:14px;color:#1e40af">Warranty Registered</p>
			</div>
			<h1 style="margin:0 0 8px;font-size:20px;font-weight:600">Your warranty is active!</h1>
			<p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6">
				Your warranty for <strong style="color:#111">${esc(data.productName)}</strong> has been successfully registered.
			</p>
			<div style="border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin-bottom:24px">
				<p style="margin:0 0 12px;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280">Warranty Details</p>
				<table style="width:100%;border-collapse:collapse;font-size:14px">
					<tr>
						<td style="padding:4px 0;color:#6b7280;width:100px">Product</td>
						<td style="padding:4px 0;color:#111;font-weight:500">${esc(data.productName)}</td>
					</tr>
					${data.warrantyPlanName ? `<tr><td style="padding:4px 0;color:#6b7280">Plan</td><td style="padding:4px 0;color:#111">${esc(data.warrantyPlanName)}</td></tr>` : ""}
					${data.serialNumber ? `<tr><td style="padding:4px 0;color:#6b7280">Serial</td><td style="padding:4px 0;color:#111;font-family:monospace">${esc(data.serialNumber)}</td></tr>` : ""}
					${data.expiresAt ? `<tr><td style="padding:4px 0;color:#6b7280">Expires</td><td style="padding:4px 0;color:#111">${esc(formatDate(data.expiresAt))}</td></tr>` : ""}
				</table>
			</div>
			<p style="margin:0;color:#6b7280;font-size:13px">Keep this email for your records. To make a warranty claim, sign in to your account.</p>
		</div>
	</div>
</body>
</html>`;

	return { subject, html, text };
}
