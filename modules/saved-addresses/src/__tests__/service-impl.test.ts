import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createSavedAddressesController } from "../service-impl";

describe("createSavedAddressesController", () => {
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

	// ── create ──────────────────────────────────────────────────────────

	describe("create", () => {
		it("creates a new address", async () => {
			const address = await controller.create("cust_1", baseInput);
			expect(address.id).toBeDefined();
			expect(address.customerId).toBe("cust_1");
			expect(address.firstName).toBe("John");
			expect(address.lastName).toBe("Doe");
			expect(address.line1).toBe("123 Main St");
			expect(address.city).toBe("Springfield");
			expect(address.postalCode).toBe("62701");
			expect(address.country).toBe("US");
			expect(address.createdAt).toBeInstanceOf(Date);
			expect(address.updatedAt).toBeInstanceOf(Date);
		});

		it("stores optional fields", async () => {
			const address = await controller.create("cust_1", {
				...baseInput,
				label: "Home",
				company: "Acme Inc",
				line2: "Apt 4B",
				state: "IL",
				phone: "+1-555-0100",
			});
			expect(address.label).toBe("Home");
			expect(address.company).toBe("Acme Inc");
			expect(address.line2).toBe("Apt 4B");
			expect(address.state).toBe("IL");
			expect(address.phone).toBe("+1-555-0100");
		});

		it("sets first address as default automatically", async () => {
			const address = await controller.create("cust_1", baseInput);
			expect(address.isDefault).toBe(true);
			expect(address.isDefaultBilling).toBe(true);
		});

		it("does not set subsequent addresses as default", async () => {
			await controller.create("cust_1", baseInput);
			const second = await controller.create("cust_1", {
				...baseInput,
				line1: "456 Oak Ave",
			});
			expect(second.isDefault).toBe(false);
			expect(second.isDefaultBilling).toBe(false);
		});

		it("respects explicit isDefault flag", async () => {
			await controller.create("cust_1", baseInput);
			const second = await controller.create("cust_1", {
				...baseInput,
				line1: "456 Oak Ave",
				isDefault: true,
			});
			expect(second.isDefault).toBe(true);
		});

		it("clears previous default when setting new default", async () => {
			const first = await controller.create("cust_1", baseInput);
			expect(first.isDefault).toBe(true);

			await controller.create("cust_1", {
				...baseInput,
				line1: "456 Oak Ave",
				isDefault: true,
			});

			const defaultAddr = await controller.getDefault("cust_1");
			expect(defaultAddr).not.toBeNull();
			expect(defaultAddr?.line1).toBe("456 Oak Ave");
		});

		it("enforces maxAddresses limit", async () => {
			const limited = createSavedAddressesController(mockData, {
				maxAddresses: 2,
			});
			await limited.create("cust_1", baseInput);
			await limited.create("cust_1", {
				...baseInput,
				line1: "456 Oak Ave",
			});
			await expect(
				limited.create("cust_1", {
					...baseInput,
					line1: "789 Pine Rd",
				}),
			).rejects.toThrow("Address limit reached");
		});

		it("limit applies per customer", async () => {
			const limited = createSavedAddressesController(mockData, {
				maxAddresses: 1,
			});
			await limited.create("cust_1", baseInput);
			const addr2 = await limited.create("cust_2", baseInput);
			expect(addr2.customerId).toBe("cust_2");
		});
	});

	// ── update ──────────────────────────────────────────────────────────

	describe("update", () => {
		it("updates address fields", async () => {
			const addr = await controller.create("cust_1", baseInput);
			const updated = await controller.update("cust_1", addr.id, {
				firstName: "Jane",
				city: "Chicago",
			});
			expect(updated).not.toBeNull();
			expect(updated?.firstName).toBe("Jane");
			expect(updated?.city).toBe("Chicago");
			expect(updated?.lastName).toBe("Doe");
		});

		it("returns null for nonexistent address", async () => {
			const result = await controller.update("cust_1", "nonexistent", {
				firstName: "Jane",
			});
			expect(result).toBeNull();
		});

		it("returns null when customerId does not match", async () => {
			const addr = await controller.create("cust_1", baseInput);
			const result = await controller.update("cust_2", addr.id, {
				firstName: "Jane",
			});
			expect(result).toBeNull();
		});

		it("updates updatedAt timestamp", async () => {
			const addr = await controller.create("cust_1", baseInput);
			const updated = await controller.update("cust_1", addr.id, {
				city: "Chicago",
			});
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				addr.updatedAt.getTime(),
			);
		});

		it("clears other defaults when setting isDefault", async () => {
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

	// ── delete ──────────────────────────────────────────────────────────

	describe("delete", () => {
		it("deletes an address", async () => {
			const addr = await controller.create("cust_1", baseInput);
			const result = await controller.delete("cust_1", addr.id);
			expect(result).toBe(true);

			const found = await controller.getById("cust_1", addr.id);
			expect(found).toBeNull();
		});

		it("returns false for nonexistent address", async () => {
			const result = await controller.delete("cust_1", "nonexistent");
			expect(result).toBe(false);
		});

		it("returns false when customerId does not match", async () => {
			const addr = await controller.create("cust_1", baseInput);
			const result = await controller.delete("cust_2", addr.id);
			expect(result).toBe(false);
		});
	});

	// ── getById ─────────────────────────────────────────────────────────

	describe("getById", () => {
		it("returns address by id", async () => {
			const addr = await controller.create("cust_1", baseInput);
			const found = await controller.getById("cust_1", addr.id);
			expect(found).not.toBeNull();
			expect(found?.id).toBe(addr.id);
		});

		it("returns null for wrong customer", async () => {
			const addr = await controller.create("cust_1", baseInput);
			const found = await controller.getById("cust_2", addr.id);
			expect(found).toBeNull();
		});

		it("returns null for nonexistent id", async () => {
			const found = await controller.getById("cust_1", "nonexistent");
			expect(found).toBeNull();
		});
	});

	// ── listByCustomer ──────────────────────────────────────────────────

	describe("listByCustomer", () => {
		it("returns addresses for a customer", async () => {
			await controller.create("cust_1", baseInput);
			await controller.create("cust_1", {
				...baseInput,
				line1: "456 Oak Ave",
			});
			await controller.create("cust_2", baseInput);

			const list = await controller.listByCustomer("cust_1");
			expect(list).toHaveLength(2);
			expect(list.every((a) => a.customerId === "cust_1")).toBe(true);
		});

		it("returns empty array for customer with no addresses", async () => {
			const list = await controller.listByCustomer("cust_1");
			expect(list).toHaveLength(0);
		});

		it("supports pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.create("cust_1", {
					...baseInput,
					line1: `${i} Main St`,
				});
			}
			const page = await controller.listByCustomer("cust_1", {
				take: 2,
				skip: 1,
			});
			expect(page).toHaveLength(2);
		});
	});

	// ── getDefault / getDefaultBilling ───────────────────────────────────

	describe("getDefault", () => {
		it("returns the default shipping address", async () => {
			const addr = await controller.create("cust_1", baseInput);
			const defaultAddr = await controller.getDefault("cust_1");
			expect(defaultAddr?.id).toBe(addr.id);
		});

		it("returns null when no default exists", async () => {
			const result = await controller.getDefault("cust_1");
			expect(result).toBeNull();
		});
	});

	describe("getDefaultBilling", () => {
		it("returns the default billing address", async () => {
			const addr = await controller.create("cust_1", baseInput);
			const defaultAddr = await controller.getDefaultBilling("cust_1");
			expect(defaultAddr?.id).toBe(addr.id);
		});

		it("returns null when no default billing exists", async () => {
			const result = await controller.getDefaultBilling("cust_1");
			expect(result).toBeNull();
		});
	});

	// ── setDefault / setDefaultBilling ───────────────────────────────────

	describe("setDefault", () => {
		it("sets a new default address", async () => {
			await controller.create("cust_1", baseInput);
			const second = await controller.create("cust_1", {
				...baseInput,
				line1: "456 Oak Ave",
			});

			const result = await controller.setDefault("cust_1", second.id);
			expect(result).toBe(true);

			const defaultAddr = await controller.getDefault("cust_1");
			expect(defaultAddr?.id).toBe(second.id);
		});

		it("returns false for nonexistent address", async () => {
			const result = await controller.setDefault("cust_1", "nonexistent");
			expect(result).toBe(false);
		});

		it("returns false for wrong customer", async () => {
			const addr = await controller.create("cust_1", baseInput);
			const result = await controller.setDefault("cust_2", addr.id);
			expect(result).toBe(false);
		});
	});

	describe("setDefaultBilling", () => {
		it("sets a new default billing address", async () => {
			await controller.create("cust_1", baseInput);
			const second = await controller.create("cust_1", {
				...baseInput,
				line1: "456 Oak Ave",
			});

			const result = await controller.setDefaultBilling("cust_1", second.id);
			expect(result).toBe(true);

			const defaultBilling = await controller.getDefaultBilling("cust_1");
			expect(defaultBilling?.id).toBe(second.id);
		});

		it("returns false for nonexistent address", async () => {
			const result = await controller.setDefaultBilling(
				"cust_1",
				"nonexistent",
			);
			expect(result).toBe(false);
		});
	});

	// ── countByCustomer ─────────────────────────────────────────────────

	describe("countByCustomer", () => {
		it("returns zero for new customer", async () => {
			const count = await controller.countByCustomer("cust_1");
			expect(count).toBe(0);
		});

		it("returns correct count", async () => {
			await controller.create("cust_1", baseInput);
			await controller.create("cust_1", {
				...baseInput,
				line1: "456 Oak Ave",
			});
			const count = await controller.countByCustomer("cust_1");
			expect(count).toBe(2);
		});
	});

	// ── listAll (admin) ─────────────────────────────────────────────────

	describe("listAll", () => {
		it("returns all addresses", async () => {
			await controller.create("cust_1", baseInput);
			await controller.create("cust_2", {
				...baseInput,
				country: "CA",
			});
			const result = await controller.listAll();
			expect(result.total).toBe(2);
			expect(result.items).toHaveLength(2);
		});

		it("filters by customerId", async () => {
			await controller.create("cust_1", baseInput);
			await controller.create("cust_2", baseInput);
			const result = await controller.listAll({ customerId: "cust_1" });
			expect(result.total).toBe(1);
			expect(result.items[0].customerId).toBe("cust_1");
		});

		it("filters by country", async () => {
			await controller.create("cust_1", baseInput);
			await controller.create("cust_2", {
				...baseInput,
				country: "CA",
			});
			const result = await controller.listAll({ country: "CA" });
			expect(result.total).toBe(1);
			expect(result.items[0].country).toBe("CA");
		});
	});

	// ── getSummary (admin) ──────────────────────────────────────────────

	describe("getSummary", () => {
		it("returns empty summary when no addresses", async () => {
			const summary = await controller.getSummary();
			expect(summary.totalAddresses).toBe(0);
			expect(summary.countryCounts).toHaveLength(0);
		});

		it("returns country counts sorted by frequency", async () => {
			await controller.create("cust_1", baseInput);
			await controller.create("cust_2", baseInput);
			await controller.create("cust_3", {
				...baseInput,
				country: "CA",
			});

			const summary = await controller.getSummary();
			expect(summary.totalAddresses).toBe(3);
			expect(summary.countryCounts[0]).toEqual({ country: "US", count: 2 });
			expect(summary.countryCounts[1]).toEqual({ country: "CA", count: 1 });
		});
	});
});
