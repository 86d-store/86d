import { createMockDataService } from "@86d-app/core/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResendProvider, TwilioProvider } from "../provider";
import { createNotificationsController } from "../service-impl";

function createMockResendProvider(): ResendProvider {
	return {
		sendEmail: vi.fn().mockResolvedValue({
			success: true,
			messageId: "resend-msg-001",
		}),
	} as unknown as ResendProvider;
}

function createMockTwilioProvider(): TwilioProvider {
	return {
		sendSms: vi.fn().mockResolvedValue({
			success: true,
			messageId: "SM-twilio-001",
		}),
	} as unknown as TwilioProvider;
}

function createMockCustomerResolver() {
	return vi.fn().mockResolvedValue({
		email: "customer@example.com",
		phone: "+15558675310",
	});
}

describe("notification delivery integration", () => {
	let mockData: ReturnType<typeof createMockDataService>;

	beforeEach(() => {
		mockData = createMockDataService();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("email delivery", () => {
		it("sends email via Resend when channel is 'email'", async () => {
			const emailProvider = createMockResendProvider();
			const resolver = createMockCustomerResolver();

			const controller = createNotificationsController(mockData, undefined, {
				emailProvider,
				customerResolver: resolver,
			});

			await controller.create({
				customerId: "cust-1",
				channel: "email",
				title: "Order Confirmed",
				body: "Your order #1234 has been confirmed.",
				actionUrl: "https://store.com/orders/1234",
			});

			// Allow the fire-and-forget delivery to complete
			await new Promise((r) => setTimeout(r, 10));

			expect(resolver).toHaveBeenCalledWith("cust-1");
			expect(emailProvider.sendEmail).toHaveBeenCalledOnce();

			const call = vi.mocked(emailProvider.sendEmail).mock.calls[0][0];
			expect(call.to).toBe("customer@example.com");
			expect(call.subject).toBe("Order Confirmed");
			expect(call.html).toContain("Order Confirmed");
			expect(call.html).toContain("Your order #1234 has been confirmed.");
			expect(call.html).toContain("View details");
			expect(call.text).toContain("Order Confirmed");
			expect(call.text).toContain("https://store.com/orders/1234");
			expect(call.tags).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ name: "type" }),
					expect.objectContaining({ name: "notification_id" }),
				]),
			);
		});

		it("does not send email when channel is 'in_app'", async () => {
			const emailProvider = createMockResendProvider();
			const resolver = createMockCustomerResolver();

			const controller = createNotificationsController(mockData, undefined, {
				emailProvider,
				customerResolver: resolver,
			});

			await controller.create({
				customerId: "cust-1",
				channel: "in_app",
				title: "Info",
				body: "Just FYI",
			});

			await new Promise((r) => setTimeout(r, 10));

			expect(emailProvider.sendEmail).not.toHaveBeenCalled();
			expect(resolver).not.toHaveBeenCalled();
		});

		it("does not crash when emailProvider is not configured", async () => {
			const controller = createNotificationsController(mockData);

			const n = await controller.create({
				customerId: "cust-1",
				channel: "email",
				title: "Order Shipped",
				body: "Your order has shipped.",
			});

			expect(n.id).toBeDefined();
			expect(n.channel).toBe("email");
		});

		it("does not crash when customerResolver returns no email", async () => {
			const emailProvider = createMockResendProvider();
			const resolver = vi
				.fn()
				.mockResolvedValue({ email: undefined, phone: undefined });

			const controller = createNotificationsController(mockData, undefined, {
				emailProvider,
				customerResolver: resolver,
			});

			const n = await controller.create({
				customerId: "cust-1",
				channel: "email",
				title: "Test",
				body: "No email on file",
			});

			await new Promise((r) => setTimeout(r, 10));

			expect(n.id).toBeDefined();
			expect(emailProvider.sendEmail).not.toHaveBeenCalled();
		});

		it("handles email provider failure gracefully", async () => {
			const emailProvider = {
				sendEmail: vi.fn().mockRejectedValue(new Error("Network timeout")),
			} as unknown as ResendProvider;
			const resolver = createMockCustomerResolver();

			const controller = createNotificationsController(mockData, undefined, {
				emailProvider,
				customerResolver: resolver,
			});

			const n = await controller.create({
				customerId: "cust-1",
				channel: "email",
				title: "Order",
				body: "Details",
			});

			await new Promise((r) => setTimeout(r, 10));

			// Notification is still created even though delivery failed
			expect(n.id).toBeDefined();
			expect(n.title).toBe("Order");
		});
	});

	describe("SMS delivery", () => {
		it("sends SMS via Twilio when channel is 'both'", async () => {
			const emailProvider = createMockResendProvider();
			const smsProvider = createMockTwilioProvider();
			const resolver = createMockCustomerResolver();

			const controller = createNotificationsController(mockData, undefined, {
				emailProvider,
				smsProvider,
				customerResolver: resolver,
			});

			await controller.create({
				customerId: "cust-1",
				channel: "both",
				title: "Delivery Update",
				body: "Your package is out for delivery.",
			});

			await new Promise((r) => setTimeout(r, 10));

			expect(emailProvider.sendEmail).toHaveBeenCalledOnce();
			expect(smsProvider.sendSms).toHaveBeenCalledOnce();

			const smsCall = vi.mocked(smsProvider.sendSms).mock.calls[0][0];
			expect(smsCall.to).toBe("+15558675310");
			expect(smsCall.body).toContain("Delivery Update");
			expect(smsCall.body).toContain("Your package is out for delivery.");
		});

		it("does not send SMS when channel is 'email'", async () => {
			const emailProvider = createMockResendProvider();
			const smsProvider = createMockTwilioProvider();
			const resolver = createMockCustomerResolver();

			const controller = createNotificationsController(mockData, undefined, {
				emailProvider,
				smsProvider,
				customerResolver: resolver,
			});

			await controller.create({
				customerId: "cust-1",
				channel: "email",
				title: "Test",
				body: "Email only",
			});

			await new Promise((r) => setTimeout(r, 10));

			expect(emailProvider.sendEmail).toHaveBeenCalledOnce();
			expect(smsProvider.sendSms).not.toHaveBeenCalled();
		});
	});

	describe("batch and template delivery", () => {
		it("delivers email for each customer in batchSend", async () => {
			const emailProvider = createMockResendProvider();
			const resolver = createMockCustomerResolver();

			const controller = createNotificationsController(mockData, undefined, {
				emailProvider,
				customerResolver: resolver,
			});

			const result = await controller.batchSend({
				customerIds: ["cust-1", "cust-2", "cust-3"],
				channel: "email",
				title: "Sale!",
				body: "50% off everything.",
			});

			await new Promise((r) => setTimeout(r, 50));

			expect(result.sent).toBe(3);
			expect(result.failed).toBe(0);
			// Each customer should trigger a delivery attempt
			expect(emailProvider.sendEmail).toHaveBeenCalledTimes(3);
		});

		it("delivers email for template-based send", async () => {
			const emailProvider = createMockResendProvider();
			const resolver = createMockCustomerResolver();

			const controller = createNotificationsController(mockData, undefined, {
				emailProvider,
				customerResolver: resolver,
			});

			const template = await controller.createTemplate({
				slug: "order-shipped",
				name: "Order Shipped",
				channel: "email",
				titleTemplate: "Order {{orderNumber}} shipped",
				bodyTemplate:
					"Your order {{orderNumber}} has been shipped via {{carrier}}.",
				variables: ["orderNumber", "carrier"],
			});

			const result = await controller.sendFromTemplate({
				templateId: template.id,
				customerIds: ["cust-1"],
				variables: { orderNumber: "5678", carrier: "FedEx" },
			});

			await new Promise((r) => setTimeout(r, 10));

			expect(result.sent).toBe(1);
			expect(emailProvider.sendEmail).toHaveBeenCalledOnce();

			const call = vi.mocked(emailProvider.sendEmail).mock.calls[0][0];
			expect(call.subject).toBe("Order 5678 shipped");
		});
	});

	describe("batch send error tracking", () => {
		it("tracks per-customer failures in batchSend result", async () => {
			const emailProvider = createMockResendProvider();
			const resolver = createMockCustomerResolver();

			// Simulate a data service that fails on the second customer
			const failingData = createMockDataService();
			let callCount = 0;
			const origUpsert = failingData.upsert.bind(failingData);
			failingData.upsert = async (entity, id, data) => {
				callCount++;
				if (callCount === 2) {
					throw new Error("Database write failed");
				}
				return origUpsert(entity, id, data);
			};

			const controller = createNotificationsController(failingData, undefined, {
				emailProvider,
				customerResolver: resolver,
			});

			const result = await controller.batchSend({
				customerIds: ["cust-1", "cust-2", "cust-3"],
				channel: "email",
				title: "Promo",
				body: "Flash sale!",
			});

			expect(result.sent).toBe(2);
			expect(result.failed).toBe(1);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0].customerId).toBe("cust-2");
			expect(result.errors[0].error).toBe("Database write failed");
		});

		it("tracks per-customer failures in sendFromTemplate result", async () => {
			const emailProvider = createMockResendProvider();
			const resolver = createMockCustomerResolver();

			const failingData = createMockDataService();
			let upsertCount = 0;
			const origUpsert = failingData.upsert.bind(failingData);
			failingData.upsert = async (entity, id, data) => {
				// The first upsert creates the template; fail on the third (second customer notification)
				upsertCount++;
				if (upsertCount === 3) {
					throw new Error("Constraint violation");
				}
				return origUpsert(entity, id, data);
			};

			const controller = createNotificationsController(failingData, undefined, {
				emailProvider,
				customerResolver: resolver,
			});

			const template = await controller.createTemplate({
				slug: "test-promo",
				name: "Test Promo",
				channel: "email",
				titleTemplate: "Hello {{name}}",
				bodyTemplate: "Welcome, {{name}}!",
				variables: ["name"],
			});

			const result = await controller.sendFromTemplate({
				templateId: template.id,
				customerIds: ["cust-1", "cust-2", "cust-3"],
				variables: { name: "Customer" },
			});

			expect(result.sent).toBe(2);
			expect(result.failed).toBe(1);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0].customerId).toBe("cust-2");
			expect(result.errors[0].error).toBe("Constraint violation");
		});
	});

	describe("graceful degradation", () => {
		it("still stores notification when no resolver is configured", async () => {
			const emailProvider = createMockResendProvider();

			const controller = createNotificationsController(mockData, undefined, {
				emailProvider,
			});

			const n = await controller.create({
				customerId: "cust-1",
				channel: "email",
				title: "Test",
				body: "No resolver",
			});

			await new Promise((r) => setTimeout(r, 10));

			expect(n.id).toBeDefined();
			expect(emailProvider.sendEmail).not.toHaveBeenCalled();
		});

		it("handles resolver throwing error", async () => {
			const emailProvider = createMockResendProvider();
			const resolver = vi
				.fn()
				.mockRejectedValue(new Error("DB connection error"));

			const controller = createNotificationsController(mockData, undefined, {
				emailProvider,
				customerResolver: resolver,
			});

			const n = await controller.create({
				customerId: "cust-1",
				channel: "email",
				title: "Test",
				body: "Resolver fails",
			});

			await new Promise((r) => setTimeout(r, 10));

			// Notification still created; no crash
			expect(n.id).toBeDefined();
			expect(emailProvider.sendEmail).not.toHaveBeenCalled();
		});
	});
});
