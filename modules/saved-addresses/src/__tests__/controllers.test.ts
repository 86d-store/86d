import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createSavedAddressesController } from "../service-impl";

describe("saved-addresses controllers — edge cases & interactions", () => {
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

	// ── Default recovery after deletion ─────────────────────────────────

	describe("default recovery after deletion", () => {
		it("getDefault returns null after deleting the only (default) address", async () => {
			const addr = await controller.create("cust_1", baseInput);
			expect(addr.isDefault).toBe(true);

			await controller.delete("cust_1", addr.id);
			const result = await controller.getDefault("cust_1");
			expect(result).toBeNull();
		});

		it("getDefaultBilling returns null after deleting the only address", async () => {
			const addr = await controller.create("cust_1", baseInput);
			expect(addr.isDefaultBilling).toBe(true);

			await controller.delete("cust_1", addr.id);
			const result = await controller.getDefaultBilling("cust_1");
			expect(result).toBeNull();
		});

		it("new address auto-defaults after all addresses are deleted", async () => {
			const first = await controller.create("cust_1", baseInput);
			await controller.delete("cust_1", first.id);

			const second = await controller.create("cust_1", {
				...baseInput,
				line1: "456 Oak Ave",
			});
			expect(second.isDefault).toBe(true);
			expect(second.isDefaultBilling).toBe(true);
		});

		it("deleting non-default address preserves existing default", async () => {
			const first = await controller.create("cust_1", baseInput);
			const second = await controller.create("cust_1", {
				...baseInput,
				line1: "456 Oak Ave",
			});

			await controller.delete("cust_1", second.id);
			const defaultAddr = await controller.getDefault("cust_1");
			expect(defaultAddr?.id).toBe(first.id);
		});

		it("deleting default leaves other addresses without a default", async () => {
			const first = await controller.create("cust_1", baseInput);
			await controller.create("cust_1", {
				...baseInput,
				line1: "456 Oak Ave",
			});

			await controller.delete("cust_1", first.id);

			const defaultAddr = await controller.getDefault("cust_1");
			expect(defaultAddr).toBeNull();

			const list = await controller.listByCustomer("cust_1");
			expect(list).toHaveLength(1);
		});
	});

	// ── Independent shipping vs billing defaults ────────────────────────

	describe("independent shipping and billing defaults", () => {
		it("can set different addresses as shipping and billing default", async () => {
			const home = await controller.create("cust_1", baseInput);
			const office = await controller.create("cust_1", {
				...baseInput,
				label: "Office",
				line1: "789 Corp Blvd",
			});

			await controller.setDefault("cust_1", home.id);
			await controller.setDefaultBilling("cust_1", office.id);

			const shippingDefault = await controller.getDefault("cust_1");
			const billingDefault = await controller.getDefaultBilling("cust_1");

			expect(shippingDefault?.id).toBe(home.id);
			expect(billingDefault?.id).toBe(office.id);
		});

		it("setDefault does not change billing default", async () => {
			await controller.create("cust_1", baseInput);
			const second = await controller.create("cust_1", {
				...baseInput,
				line1: "456 Oak Ave",
				isDefaultBilling: true,
			});

			const third = await controller.create("cust_1", {
				...baseInput,
				line1: "789 Pine Rd",
			});
			await controller.setDefault("cust_1", third.id);

			const billingDefault = await controller.getDefaultBilling("cust_1");
			expect(billingDefault?.id).toBe(second.id);
		});

		it("setDefaultBilling does not change shipping default", async () => {
			const first = await controller.create("cust_1", baseInput);
			await controller.create("cust_1", {
				...baseInput,
				line1: "456 Oak Ave",
			});

			const third = await controller.create("cust_1", {
				...baseInput,
				line1: "789 Pine Rd",
			});
			await controller.setDefaultBilling("cust_1", third.id);

			const shippingDefault = await controller.getDefault("cust_1");
			expect(shippingDefault?.id).toBe(first.id);
		});
	});

	// ── Explicit default overrides ──────────────────────────────────────

	describe("explicit default overrides", () => {
		it("first address with explicit isDefault: false is not default", async () => {
			const addr = await controller.create("cust_1", {
				...baseInput,
				isDefault: false,
			});
			expect(addr.isDefault).toBe(false);
			const result = await controller.getDefault("cust_1");
			expect(result).toBeNull();
		});

		it("first address with explicit isDefaultBilling: false is not billing default", async () => {
			const addr = await controller.create("cust_1", {
				...baseInput,
				isDefaultBilling: false,
			});
			expect(addr.isDefaultBilling).toBe(false);
			const result = await controller.getDefaultBilling("cust_1");
			expect(result).toBeNull();
		});

		it("update with isDefault: false removes default status", async () => {
			const addr = await controller.create("cust_1", baseInput);
			expect(addr.isDefault).toBe(true);

			const updated = await controller.update("cust_1", addr.id, {
				isDefault: false,
			});
			expect(updated?.isDefault).toBe(false);

			const result = await controller.getDefault("cust_1");
			expect(result).toBeNull();
		});

		it("update with isDefaultBilling: false removes billing default status", async () => {
			const addr = await controller.create("cust_1", baseInput);
			expect(addr.isDefaultBilling).toBe(true);

			const updated = await controller.update("cust_1", addr.id, {
				isDefaultBilling: false,
			});
			expect(updated?.isDefaultBilling).toBe(false);

			const result = await controller.getDefaultBilling("cust_1");
			expect(result).toBeNull();
		});
	});

	// ── setDefault vs update consistency ─────────────────────────────────

	describe("setDefault vs update consistency", () => {
		it("setDefault and update with isDefault produce the same result", async () => {
			const a1 = await controller.create("cust_1", baseInput);
			const a2 = await controller.create("cust_1", {
				...baseInput,
				line1: "456 Oak Ave",
			});

			await controller.setDefault("cust_1", a2.id);
			const defaultAfterSet = await controller.getDefault("cust_1");
			expect(defaultAfterSet?.id).toBe(a2.id);

			await controller.update("cust_1", a1.id, { isDefault: true });
			const defaultAfterUpdate = await controller.getDefault("cust_1");
			expect(defaultAfterUpdate?.id).toBe(a1.id);
		});

		it("setDefault clears previous default on the old address", async () => {
			const a1 = await controller.create("cust_1", baseInput);
			const a2 = await controller.create("cust_1", {
				...baseInput,
				line1: "456 Oak Ave",
			});

			await controller.setDefault("cust_1", a2.id);

			const a1After = await controller.getById("cust_1", a1.id);
			expect(a1After?.isDefault).toBe(false);
		});
	});

	// ── Multi-step update sequences ─────────────────────────────────────

	describe("multi-step update sequences", () => {
		it("sequential updates preserve untouched fields", async () => {
			const addr = await controller.create("cust_1", {
				...baseInput,
				label: "Home",
				phone: "+1-555-0100",
			});

			await controller.update("cust_1", addr.id, { firstName: "Jane" });
			await controller.update("cust_1", addr.id, { city: "Chicago" });

			const final = await controller.getById("cust_1", addr.id);
			expect(final?.firstName).toBe("Jane");
			expect(final?.city).toBe("Chicago");
			expect(final?.label).toBe("Home");
			expect(final?.phone).toBe("+1-555-0100");
			expect(final?.lastName).toBe("Doe");
		});

		it("update advances updatedAt each time", async () => {
			const addr = await controller.create("cust_1", baseInput);
			const t0 = addr.updatedAt.getTime();

			const u1 = await controller.update("cust_1", addr.id, {
				firstName: "Alice",
			});
			const t1 = u1?.updatedAt.getTime() ?? 0;
			expect(t1).toBeGreaterThanOrEqual(t0);

			const u2 = await controller.update("cust_1", addr.id, {
				firstName: "Bob",
			});
			const t2 = u2?.updatedAt.getTime() ?? 0;
			expect(t2).toBeGreaterThanOrEqual(t1);
		});
	});

	// ── List reflects mutations ─────────────────────────────────────────

	describe("list reflects mutations", () => {
		it("listByCustomer reflects create and delete accurately", async () => {
			const a1 = await controller.create("cust_1", baseInput);
			await controller.create("cust_1", {
				...baseInput,
				line1: "456 Oak Ave",
			});
			await controller.create("cust_1", {
				...baseInput,
				line1: "789 Pine Rd",
			});

			let list = await controller.listByCustomer("cust_1");
			expect(list).toHaveLength(3);

			await controller.delete("cust_1", a1.id);
			list = await controller.listByCustomer("cust_1");
			expect(list).toHaveLength(2);
			expect(list.find((a) => a.id === a1.id)).toBeUndefined();
		});

		it("listByCustomer reflects updates", async () => {
			const addr = await controller.create("cust_1", baseInput);
			await controller.update("cust_1", addr.id, { firstName: "Updated" });

			const list = await controller.listByCustomer("cust_1");
			expect(list[0].firstName).toBe("Updated");
		});

		it("countByCustomer decrements after delete", async () => {
			const a1 = await controller.create("cust_1", baseInput);
			await controller.create("cust_1", {
				...baseInput,
				line1: "456 Oak Ave",
			});

			expect(await controller.countByCustomer("cust_1")).toBe(2);

			await controller.delete("cust_1", a1.id);
			expect(await controller.countByCustomer("cust_1")).toBe(1);
		});
	});

	// ── Admin operations reflect customer changes ────────────────────────

	describe("admin operations reflect customer changes", () => {
		it("listAll reflects cross-customer create and delete", async () => {
			const a1 = await controller.create("cust_1", baseInput);
			await controller.create("cust_2", {
				...baseInput,
				country: "CA",
			});

			let result = await controller.listAll();
			expect(result.total).toBe(2);

			await controller.delete("cust_1", a1.id);
			result = await controller.listAll();
			expect(result.total).toBe(1);
			expect(result.items[0].customerId).toBe("cust_2");
		});

		it("getSummary updates after address country changes", async () => {
			const addr = await controller.create("cust_1", baseInput);

			let summary = await controller.getSummary();
			expect(summary.countryCounts).toEqual([{ country: "US", count: 1 }]);

			await controller.update("cust_1", addr.id, { country: "CA" });
			summary = await controller.getSummary();
			expect(summary.countryCounts).toEqual([{ country: "CA", count: 1 }]);
		});

		it("getSummary reflects deletion", async () => {
			const addr = await controller.create("cust_1", baseInput);
			await controller.create("cust_2", baseInput);

			await controller.delete("cust_1", addr.id);

			const summary = await controller.getSummary();
			expect(summary.totalAddresses).toBe(1);
		});
	});

	// ── Pagination edge cases ───────────────────────────────────────────

	describe("pagination edge cases", () => {
		it("skip beyond total returns empty array", async () => {
			await controller.create("cust_1", baseInput);

			const list = await controller.listByCustomer("cust_1", {
				take: 10,
				skip: 100,
			});
			expect(list).toHaveLength(0);
		});

		it("take of zero returns empty array", async () => {
			await controller.create("cust_1", baseInput);

			const list = await controller.listByCustomer("cust_1", {
				take: 0,
				skip: 0,
			});
			expect(list).toHaveLength(0);
		});

		it("admin listAll pagination works correctly", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.create(`cust_${i}`, {
					...baseInput,
					line1: `${i} Main St`,
				});
			}

			const page1 = await controller.listAll({ take: 2, skip: 0 });
			expect(page1.items).toHaveLength(2);
			expect(page1.total).toBe(5);

			const page2 = await controller.listAll({ take: 2, skip: 2 });
			expect(page2.items).toHaveLength(2);
			expect(page2.total).toBe(5);

			const page3 = await controller.listAll({ take: 2, skip: 4 });
			expect(page3.items).toHaveLength(1);
			expect(page3.total).toBe(5);
		});
	});

	// ── Limit boundary with deletion ────────────────────────────────────

	describe("limit boundary with deletion", () => {
		it("can create after deleting when at limit", async () => {
			const limited = createSavedAddressesController(mockData, {
				maxAddresses: 2,
			});

			const a1 = await limited.create("cust_1", baseInput);
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

			await limited.delete("cust_1", a1.id);

			const newAddr = await limited.create("cust_1", {
				...baseInput,
				line1: "789 Pine Rd",
			});
			expect(newAddr.line1).toBe("789 Pine Rd");
		});

		it("new address after clearing at-limit does not auto-default", async () => {
			const limited = createSavedAddressesController(mockData, {
				maxAddresses: 2,
			});

			await limited.create("cust_1", baseInput);
			const a2 = await limited.create("cust_1", {
				...baseInput,
				line1: "456 Oak Ave",
			});

			await limited.delete("cust_1", a2.id);

			const newAddr = await limited.create("cust_1", {
				...baseInput,
				line1: "789 Pine Rd",
			});
			expect(newAddr.isDefault).toBe(false);
		});
	});
});
