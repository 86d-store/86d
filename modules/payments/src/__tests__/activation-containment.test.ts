import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import payments from "../index";
import { createPaymentController } from "../service-impl";

describe("payment activation containment", () => {
	it("does not expose generic shopper payment-intent routes", () => {
		const routes = payments().endpoints?.store ?? {};

		expect(
			Object.keys(routes).filter((path) =>
				path.startsWith("/payments/intents"),
			),
		).toEqual([]);
		expect(routes).toHaveProperty("/payments/methods");
	});

	it("cannot confirm a positive payment without a configured provider", async () => {
		const controller = createPaymentController(createMockDataService());
		const intent = await controller.createIntent({ amount: 2500 });

		await expect(controller.confirmIntent(intent.id)).rejects.toThrow(
			"Payment provider is not configured",
		);
		expect((await controller.getIntent(intent.id))?.status).toBe("pending");
	});

	it("keeps managed tokenization contained without returning browser configuration", async () => {
		const route = payments().endpoints?.store?.["/payments/managed/prepare"];
		expect(route).toBeDefined();
		const endpoint = route as unknown as Record<string, unknown>;
		const handler =
			typeof endpoint.handler === "function" ? endpoint.handler : route;
		const response = (await (handler as CallableFunction)({
			body: {
				bindingId: "binding_1",
				merchantPaymentAccountId: "account_1",
				mode: "sandbox",
				option: "card",
			},
			context: {},
		})) as Response;

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			code: "PAYMENT_ACTIVATION_REQUIRED",
			error:
				"Managed Payment tokenization remains contained until production evidence exists.",
		});
	});

	it("cannot record a refund without a configured provider", async () => {
		const data = createMockDataService();
		const controller = createPaymentController(data);
		const intent = await controller.createIntent({ amount: 2500 });
		await data.upsert("paymentIntent", intent.id, {
			...intent,
			status: "succeeded",
		});

		await expect(
			controller.createRefund({ intentId: intent.id }),
		).rejects.toThrow("Payment provider is not configured");
		expect(await controller.listRefunds(intent.id)).toEqual([]);
	});

	it("never enables explicit offline development mode in production", async () => {
		const previousNodeEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "production";
		try {
			const controller = createPaymentController(
				createMockDataService(),
				undefined,
				{ allowOfflineForDevelopment: true },
			);
			const intent = await controller.createIntent({ amount: 2500 });

			await expect(controller.confirmIntent(intent.id)).rejects.toThrow(
				"Payment provider is not configured",
			);
		} finally {
			if (previousNodeEnv === undefined) {
				delete process.env.NODE_ENV;
			} else {
				process.env.NODE_ENV = previousNodeEnv;
			}
		}
	});
});
