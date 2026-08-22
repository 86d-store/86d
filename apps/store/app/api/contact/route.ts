import { getStoreConfig } from "@86d-app/sdk/get-store-config";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logger } from "utils/logger";
import { createRateLimiter } from "utils/rate-limit";
import { sanitizeText } from "utils/sanitize";
import { resolveTemplatePath } from "~/lib/template-path";

const contactLimiter = createRateLimiter({ limit: 5, window: 600_000 });

interface ContactBody {
	name: string;
	email: string;
	subject: string;
	message: string;
}

function validateContactBody(
	body: unknown,
): { ok: true; data: ContactBody } | { ok: false; error: string } {
	if (!body || typeof body !== "object") {
		return { ok: false, error: "Invalid request body" };
	}
	const b = body as Record<string, unknown>;
	if (typeof b.name !== "string" || b.name.trim().length === 0) {
		return { ok: false, error: "Name is required" };
	}
	if (typeof b.email !== "string" || !b.email.includes("@")) {
		return { ok: false, error: "Valid email is required" };
	}
	if (typeof b.subject !== "string" || b.subject.trim().length === 0) {
		return { ok: false, error: "Subject is required" };
	}
	if (typeof b.message !== "string" || b.message.trim().length === 0) {
		return { ok: false, error: "Message is required" };
	}
	return {
		ok: true,
		data: {
			name: sanitizeText(b.name.trim().slice(0, 200)),
			email: b.email.trim().slice(0, 320),
			subject: sanitizeText(b.subject.trim().slice(0, 500)),
			message: sanitizeText(b.message.trim().slice(0, 5000)),
		},
	};
}

export async function POST(req: NextRequest) {
	const ip =
		req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
		req.headers.get("x-real-ip") ??
		"unknown";

	const result = contactLimiter.check(`contact:${ip}`);
	if (!result.allowed) {
		return NextResponse.json(
			{
				error: {
					code: "TOO_MANY_REQUESTS",
					message: "Too many contact submissions. Please try again later.",
				},
			},
			{ status: 429 },
		);
	}

	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json(
			{ error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
			{ status: 400 },
		);
	}

	const validation = validateContactBody(body);
	if (!validation.ok) {
		return NextResponse.json(
			{ error: { code: "BAD_REQUEST", message: validation.error } },
			{ status: 400 },
		);
	}

	const { data } = validation;

	// Fetch store name for email branding
	const config = await getStoreConfig({
		templatePath: resolveTemplatePath(),
	});
	const storeName = config.name;

	// Send confirmation email to the submitter
	try {
		const [{ default: resend }, { default: ContactEmail }] = await Promise.all([
			import("emails"),
			import("emails/contact"),
		]);

		await resend.emails.send({
			from: `${storeName} <noreply@86d.app>`,
			to: [data.email],
			subject: `Re: ${data.subject} — we received your message`,
			react: ContactEmail({
				name: data.name,
				email: data.email,
				subject: data.subject,
				message: data.message,
				storeName,
			}),
		});

		logger.info("Contact form email sent", {
			to: data.email,
			subject: data.subject,
		});
	} catch (err) {
		// Log but don't fail — the message was still "received" even if email
		// delivery is unavailable (e.g., missing Resend API key in dev).
		logger.warn("Contact email failed to send", {
			error: err instanceof Error ? err.message : String(err),
		});
	}

	return NextResponse.json({ success: true });
}
