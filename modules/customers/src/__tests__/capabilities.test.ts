import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import { customerContactResolveProvider } from "../capabilities";
import { createCustomerController } from "../service-impl";

describe("customers.contact.resolve capability", () => {
	it("returns a bounded contact decision", async () => {
		const data = createMockDataService();
		const customer = await createCustomerController(data).create({
			email: "alice@example.com",
			firstName: "Alice",
			lastName: "A",
			phone: "+15550000000",
		});

		await expect(
			customerContactResolveProvider.handle(
				{ data, storeId: "store-1", options: {} },
				{ customerId: customer.id },
			),
		).resolves.toEqual({
			ok: true,
			decision: {
				email: "alice@example.com",
				firstName: "Alice",
				lastName: "A",
				phone: "+15550000000",
			},
		});
	});
});
