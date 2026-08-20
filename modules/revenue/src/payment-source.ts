import type { CapabilityInvoker } from "@86d-app/core/capabilities";
import { paymentIntentCapability } from "@86d-app/core/commerce-capabilities";
import type { RevenueIntent } from "./service";

export async function listRevenueIntents(
	capabilities: CapabilityInvoker,
	params: {
		customerId?: string | undefined;
		status?:
			| "pending"
			| "processing"
			| "succeeded"
			| "failed"
			| "cancelled"
			| "refunded"
			| undefined;
		orderId?: string | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	},
): Promise<
	| { ok: true; intents: RevenueIntent[] }
	| { ok: false; code: "REVENUE_SOURCE_UNAVAILABLE" }
> {
	const result = await capabilities.invoke(paymentIntentCapability, {
		operation: "list",
		...params,
	});
	if (!result.ok || result.decision.operation !== "list") {
		return { ok: false, code: "REVENUE_SOURCE_UNAVAILABLE" };
	}
	return { ok: true, intents: result.decision.intents };
}
