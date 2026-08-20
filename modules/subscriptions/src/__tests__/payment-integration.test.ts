import { describe, expect, it, vi } from "vitest";
import { storeEndpoints } from "../store/endpoints/routes";

type Endpoint = (input: Record<string, unknown>) => Promise<unknown>;

const subscribeEndpoint = storeEndpoints[
	"/subscriptions/subscribe"
] as unknown as Endpoint;

const session = {
	user: { id: "customer-1", email: "one@example.com" },
};

function plan(overrides?: Partial<Record<string, unknown>>) {
	return {
		id: "plan-1",
		isActive: true,
		price: 0,
		currency: "USD",
		...overrides,
	};
}

describe("subscribe endpoint payment containment", () => {
	it("allows a free plan without persisting caller-supplied payment identity", async () => {
		const subscribe = vi.fn().mockResolvedValue({
			id: "subscription-1",
			planId: "plan-1",
			status: "active",
		});
		const result = await subscribeEndpoint({
			body: { planId: "plan-1", paymentIntentId: "untrusted-intent" },
			context: {
				session,
				controllers: {
					subscriptions: {
						getPlan: vi.fn().mockResolvedValue(plan()),
						subscribe,
					},
				},
				events: { emit: vi.fn() },
			},
		});

		expect(result).toMatchObject({
			subscription: { id: "subscription-1" },
		});
		expect(subscribe).toHaveBeenCalledWith({
			planId: "plan-1",
			email: "one@example.com",
			customerId: "customer-1",
		});
	});

	it("allows a paid plan only while it is in a free trial", async () => {
		const subscribe = vi.fn().mockResolvedValue({
			id: "subscription-trial",
			planId: "plan-trial",
			status: "trialing",
		});
		const result = await subscribeEndpoint({
			body: { planId: "plan-trial" },
			context: {
				session,
				controllers: {
					subscriptions: {
						getPlan: vi
							.fn()
							.mockResolvedValue(
								plan({ id: "plan-trial", price: 2999, trialDays: 14 }),
							),
						subscribe,
					},
				},
				events: { emit: vi.fn() },
			},
		});

		expect(result).toMatchObject({
			subscription: { id: "subscription-trial" },
		});
		expect(subscribe).toHaveBeenCalledTimes(1);
	});

	it("keeps paid activation unavailable even for a reportedly succeeded intent", async () => {
		const subscribe = vi.fn();
		const invoke = vi.fn().mockResolvedValue({
			ok: true,
			decision: {
				operation: "get",
				intent: {
					id: "intent-other-customer",
					customerId: "customer-2",
					amount: 1,
					currency: "EUR",
					status: "succeeded",
				},
			},
		});
		const result = await subscribeEndpoint({
			body: { planId: "plan-pro", paymentIntentId: "intent-other-customer" },
			context: {
				session,
				controllers: {
					subscriptions: {
						getPlan: vi
							.fn()
							.mockResolvedValue(plan({ id: "plan-pro", price: 2999 })),
						subscribe,
					},
				},
				capabilities: { invoke },
			},
		});

		expect(result).toMatchObject({
			code: "SUBSCRIPTION_PAYMENT_ACTIVATION_UNAVAILABLE",
			status: 503,
		});
		expect(subscribe).not.toHaveBeenCalled();
		expect(invoke).not.toHaveBeenCalled();
	});
});
