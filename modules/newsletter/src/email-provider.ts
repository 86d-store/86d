/**
 * Email delivery provider for newsletter campaigns.
 * Calls Resend's batch send endpoint to deliver campaign emails.
 * Falls back gracefully when not configured.
 */

const BATCH_SIZE = 100;

interface ResendBatchRequest {
	from: string;
	to: string;
	subject: string;
	html: string;
	tags?: Array<{ name: string; value: string }>;
}

interface ResendBatchResponse {
	data: Array<{ id: string }>;
}

interface ResendErrorResponse {
	statusCode: number;
	message: string;
	name: string;
}

export interface CampaignEmailRequest {
	to: string;
	subject: string;
	html: string;
}

export interface BatchSendResult {
	sent: number;
	failed: number;
}

export interface NewsletterEmailProvider {
	sendBatch(
		emails: CampaignEmailRequest[],
		campaignId: string,
	): Promise<BatchSendResult>;
}

export class ResendNewsletterProvider implements NewsletterEmailProvider {
	private readonly apiKey: string;
	private readonly fromAddress: string;

	constructor(apiKey: string, fromAddress: string) {
		this.apiKey = apiKey;
		this.fromAddress = fromAddress;
	}

	async sendBatch(
		emails: CampaignEmailRequest[],
		campaignId: string,
	): Promise<BatchSendResult> {
		let sent = 0;
		let failed = 0;

		for (let i = 0; i < emails.length; i += BATCH_SIZE) {
			const chunk = emails.slice(i, i + BATCH_SIZE);
			const payload: ResendBatchRequest[] = chunk.map((e) => ({
				from: this.fromAddress,
				to: e.to,
				subject: e.subject,
				html: e.html,
				tags: [{ name: "campaign_id", value: campaignId }],
			}));

			try {
				const res = await fetch("https://api.resend.com/emails/batch", {
					method: "POST",
					headers: {
						Authorization: `Bearer ${this.apiKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(payload),
				});

				if (res.ok) {
					const body = (await res.json()) as ResendBatchResponse;
					sent += body.data.length;
					failed += chunk.length - body.data.length;
				} else {
					const err = (await res
						.json()
						.catch(() => null)) as ResendErrorResponse | null;
					console.error(
						`Resend batch error: ${err?.message ?? `HTTP ${res.status}`}`,
					);
					failed += chunk.length;
				}
			} catch (err) {
				console.error("Resend batch request failed:", err);
				failed += chunk.length;
			}
		}

		return { sent, failed };
	}
}
