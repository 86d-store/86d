import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createSavedAddressesController } from "../service-impl";

describe("saved-addresses endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createSavedAddressesController>;

	const baseInput = {
		firstName: "John",
		lastName: "Doe",
		line1: "123 Main St",
		city: "Springfield",
		postalCode: "62701",
		country: "US",
	};

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createSavedAddressesController(mockData);
	});

	// ── ownership isolation ─────────────────────────────────────────────

	describe("ownership isolation", () => {
		it("cannot read another customer's address", async () => {
			const addr = await controller.create("cust_1", baseInput);
			const found = await controller.getById("cust_2", addr.id);
			expect(found).toBeNull();
		});

		it("cannot update another customer's address", async () => {
			const addr = await controller.create("cust_1", baseInput);
			const updated = await controller.update("cust_2", addr.id, {
				firstName: "Hacker",
			});
			expect(updated).toBeNull();
		});

		it("cannot delete another customer's address", async () => {
			const addr = await controller.create("cust_1", baseInput);
			const deleted = await controller.delete("cust_2", addr.id);
			expect(deleted).toBe(false);
		});

		it("cannot set default on another customer's address", async () => {
			const addr = await controller.create("cust_1", baseInput);
			const result = await controller.setDefault("cust_2", addr.id);
			expect(result).toBe(false);
		});

		it("cannot set default billing on another customer's address", async () => {
			const addr = await controller.create("cust_1", baseInput);
			const result = await controller.setDefaultBilling("cust_2", addr.id);
			expect(result).toBe(false);
		});

		it("listing only returns own addresses", async () => {
			await controller.create("cust_1", baseInput);
			await controller.create("cust_2", {
				...baseInput,
				line1: "456 Oak Ave",
			});

			const list1 = await controller.listByCustomer("cust_1");
			expect(list1).toHaveLength(1);
			expect(list1[0].customerId).toBe("cust_1");

			const list2 = await controller.listByCustomer("cust_2");
			expect(list2).toHaveLength(1);
			expect(list2[0].customerId).toBe("cust_2");
		});

		it("getDefault only returns own default", async () => {
			await controller.create("cust_1", baseInput);
			const result = await controller.getDefault("cust_2");
			expect(result).toBeNull();
		});
	});

	// ── default address integrity ────────────────────────────────────────

	describe("default address integrity", () => {
		it("only one default shipping address per customer", async () => {
			await controller.create("cust_1", baseInput);
			await controller.create("cust_1", {
				...baseInput,
				line1: "456 Oak Ave",
				isDefault: true,
			});
			const third = await controller.create("cust_1", {
				...baseInput,
				line1: "789 Pine Rd",
				isDefault: true,
			});

			const defaultAddr = await controller.getDefault("cust_1");
			expect(defaultAddr?.id).toBe(third.id);
		});

		it("only one default billing address per customer", async () => {
			await controller.create("cust_1", baseInput);
			await controller.create("cust_1", {
				...baseInput,
				line1: "456 Oak Ave",
				isDefaultBilling: true,
			});
			const third = await controller.create("cust_1", {
				...baseInput,
				line1: "789 Pine Rd",
				isDefaultBilling: true,
			});

			const defaultBilling = await controller.getDefaultBilling("cust_1");
			expect(defaultBilling?.id).toBe(third.id);
		});

		it("default addresses are per-customer", async () => {
			const addr1 = await controller.create("cust_1", baseInput);
			const addr2 = await controller.create("cust_2", baseInput);

			const default1 = await controller.getDefault("cust_1");
			const default2 = await controller.getDefault("cust_2");

			expect(default1?.id).toBe(addr1.id);
			expect(default2?.id).toBe(addr2.id);
		});

		it("setting default via update clears other defaults", async () => {
			await controller.create("cust_1", baseInput);
			const second = await controller.create("cust_1", {
				...baseInput,
				line1: "456 Oak Ave",
			});

			await controller.update("cust_1", second.id, { isDefault: true });

			const defaultAddr = await controller.getDefault("cust_1");
			expect(defaultAddr?.id).toBe(second.id);
		});
	});

	// ── limit enforcement ────────────────────────────────────────────────

	describe("limit enforcement", () => {
		it("enforces address limit per customer", async () => {
			const limited = createSavedAddressesController(mockData, {
				maxAddresses: 3,
			});

			await limited.create("cust_1", baseInput);
			await limited.create("cust_1", {
				...baseInput,
				line1: "456 Oak Ave",
			});
			await limited.create("cust_1", {
				...baseInput,
				line1: "789 Pine Rd",
			});

			await expect(
				limited.create("cust_1", {
					...baseInput,
					line1: "999 Elm St",
				}),
			).rejects.toThrow("Address limit reached (max 3 addresses)");
		});

		it("limit does not affect other customers", async () => {
			const limited = createSavedAddressesController(mockData, {
				maxAddresses: 1,
			});

			await limited.create("cust_1", baseInput);
			await expect(
				limited.create("cust_1", {
					...baseInput,
					line1: "456 Oak Ave",
				}),
			).rejects.toThrow("Address limit reached");

			const addr = await limited.create("cust_2", baseInput);
			expect(addr.customerId).toBe("cust_2");
		});

		it("uses default limit of 20", async () => {
			const defaultController = createSavedAddressesController(mockData);
			for (let i = 0; i < 20; i++) {
				await defaultController.create("cust_1", {
					...baseInput,
					line1: `${i} Main St`,
				});
			}
			await expect(
				defaultController.create("cust_1", {
					...baseInput,
					line1: "21 Main St",
				}),
			).rejects.toThrow("Address limit reached (max 20 addresses)");
		});
	});
});
