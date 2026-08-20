/**
 * Builds return status emails for each transition in the return lifecycle:
 * requested, approved, rejected, completed.
 * Returns subject, html, and plain-text versions.
 */

type ReturnStatusType = "requested" | "approved" | "rejected" | "completed";

interface ReturnStatusEmailData {
	status: ReturnStatusType;
	orderNumber: string;
	customerName: string;
	reason?: string | undefined;
	adminNotes?: string | undefined;
}

function esc(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

const STATUS_CONFIG: Record<
	ReturnStatusType,
	{
		subjectSuffix: string;
		heading: string;
		emoji: string;
		bgColor: string;
		message: string;
	}
> = {
	requested: {
		subjectSuffix: "received",
		heading: "Return Request Received",
		emoji: "&#128230;",
		bgColor: "#dbeafe",
		message:
			"We've received your return request and will review it shortly. You'll receive an update once we've made a decision.",
	},
	approved: {
		subjectSuffix: "approved",
		heading: "Return Request Approved",
		emoji: "&#10003;",
		bgColor: "#dcfce7",
		message:
			"Your return request has been approved. Please follow the return instructions provided and ship the items back at your earliest convenience.",
	},
	rejected: {
		subjectSuffix: "update",
		heading: "Return Request Update",
		emoji: "&#10007;",
		bgColor: "#fee2e2",
		message:
			"Unfortunately, we were unable to approve your return request at this time.",
	},
	completed: {
		subjectSuffix: "completed",
		heading: "Return Completed",
		emoji: "&#10003;",
		bgColor: "#dcfce7",
		message:
			"Your return has been fully processed. If a refund was issued, it may take a few business days to appear in your account.",
	},
};

export function buildReturnStatusEmail(data: ReturnStatusEmailData): {
	subject: string;
	html: string;
	text: string;
} {
	const config = STATUS_CONFIG[data.status];
	const subject = `Return for order ${data.orderNumber} — ${config.subjectSuffix}`;

	// ── Plain text ───────────────────────────────────────────────────────
	const textLines: string[] = [
		`${config.heading} — ${data.orderNumber}`,
		"",
		`Hi ${data.customerName},`,
		"",
		config.message,
	];

	if (data.reason && data.status === "requested") {
		textLines.push("", `Reason: ${data.reason}`);
	}

	if (data.adminNotes && data.status === "rejected") {
		textLines.push("", `Note: ${data.adminNotes}`);
	}

	textLines.push(
		"",
		"If you have any questions, just reply to this email.",
		"",
		"Thank you for your patience!",
	);

	const text = textLines.join("\n");

	// ── Optional detail block for HTML ───────────────────────────────────
	let detailHtml = "";

	if (data.reason && data.status === "requested") {
		detailHtml = `
			<div style="background:#f3f4f6;border-radius:6px;padding:16px;margin:16px 0">
				<p style="margin:0;font-size:14px;color:#6b7280"><strong>Reason:</strong> ${esc(data.reason)}</p>
			</div>`;
	}

	if (data.adminNotes && data.status === "rejected") {
		detailHtml = `
			<div style="background:#f3f4f6;border-radius:6px;padding:16px;margin:16px 0">
				<p style="margin:0;font-size:14px;color:#6b7280"><strong>Note:</strong> ${esc(data.adminNotes)}</p>
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
				<div style="display:inline-block;width:48px;height:48px;background:${config.bgColor};border-radius:50%;line-height:48px;font-size:24px">${config.emoji}</div>
			</div>
			<h1 style="margin:0 0 4px;font-size:20px;font-weight:600;text-align:center">${config.heading}</h1>
			<p style="margin:0 0 24px;color:#6b7280;font-size:14px;text-align:center">${esc(data.orderNumber)}</p>
			<p style="margin:0 0 16px;font-size:15px">Hi ${esc(data.customerName)},</p>
			<p style="margin:0 0 16px;font-size:15px">${config.message}</p>${detailHtml}
			<p style="margin:24px 0 0;color:#9ca3af;font-size:13px;text-align:center">If you have any questions, just reply to this email.</p>
		</div>
	</div>
</body>
</html>`;

	return { subject, html, text };
}
