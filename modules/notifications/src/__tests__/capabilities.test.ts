import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import { notificationCreateProvider } from "../capabilities";

describe("notifications.create capability", () => {
	it("creates an in-app notification using notification-owned data", async () => {
		const data = createMockDataService();
		const result = await notificationCreateProvider.handle(
			{ data, storeId: "store-1", options: {} },
			{
				customerId: "customer-1",
				title: "Order update",
				body: "Your order shipped.",
			},
		);

		expect(result).toMatchObject({
			ok: true,
			decision: { notificationId: expect.any(String) },
		});
	});
});
