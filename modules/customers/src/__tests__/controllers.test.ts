import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCustomerController } from "../service-impl";

describe("customer controllers — edge cases & interactions", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createCustomerController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createCustomerController(mockData);
	});

	async function createTestCustomer(
		overrides: Partial<Parameters<typeof controller.create>[0]> = {},
	) {
		return controller.create({
			email: "test@example.com",
			firstName: "Test",
			lastName: "User",
			...overrides,
		});
	}

	// ── Customer CRUD cross-method interactions ──────────────────────

	describe("customer CRUD — cross-method interactions", () => {
		it("getByEmail returns the latest update after update()", async () => {
			const customer = await createTestCustomer({
				email: "alice@example.com",
			});
			await controller.update(customer.id, { firstName: "Alice2" });
			const found = await controller.getByEmail("alice@example.com");
			expect(found?.firstName).toBe("Alice2");
		});

		it("getById returns null after delete", async () => {
			const customer = await createTestCustomer();
			await controller.delete(customer.id);
			expect(await controller.getById(customer.id)).toBeNull();
		});

		it("getByEmail returns null after delete", async () => {
			const customer = await createTestCustomer({
				email: "gone@example.com",
			});
			await controller.delete(customer.id);
			expect(await controller.getByEmail("gone@example.com")).toBeNull();
		});

		it("update after delete returns null", async () => {
			const customer = await createTestCustomer();
			await controller.delete(customer.id);
			const result = await controller.update(customer.id, {
				firstName: "Ghost",
			});
			expect(result).toBeNull();
		});

		it("create with same email overwrites via upsert if same id", async () => {
			const c1 = await controller.create({
				id: "fixed-id",
				email: "same@example.com",
				firstName: "First",
				lastName: "Version",
			});
			const c2 = await controller.create({
				id: "fixed-id",
				email: "same@example.com",
				firstName: "Second",
				lastName: "Version",
			});
			const fetched = await controller.getById("fixed-id");
			expect(fetched?.firstName).toBe("Second");
			expect(c1.id).toBe(c2.id);
		});

		it("list reflects create and delete accurately", async () => {
			const c1 = await createTestCustomer({ email: "a@example.com" });
			await createTestCustomer({ email: "b@example.com" });
			await createTestCustomer({ email: "c@example.com" });

			let result = await controller.list({});
			expect(result.total).toBe(3);

			await controller.delete(c1.id);
			result = await controller.list({});
			expect(result.total).toBe(2);
		});

		it("list with zero limit returns empty array but correct total", async () => {
			await createTestCustomer({ email: "a@example.com" });
			await createTestCustomer({ email: "b@example.com" });
			const result = await controller.list({ limit: 0 });
			expect(result.customers).toHaveLength(0);
			expect(result.total).toBe(2);
		});

		it("list with offset beyond total returns empty array", async () => {
			await createTestCustomer({ email: "a@example.com" });
			const result = await controller.list({ offset: 100 });
			expect(result.customers).toHaveLength(0);
			expect(result.total).toBe(1);
		});

		it("list search combined with tag filter narrows results", async () => {
			await controller.create({
				email: "alice@example.com",
				firstName: "Alice",
				lastName: "Smith",
				tags: ["vip"],
			});
			await controller.create({
				email: "alice2@example.com",
				firstName: "Alice",
				lastName: "Jones",
				tags: ["regular"],
			});
			await controller.create({
				email: "bob@example.com",
				firstName: "Bob",
				lastName: "Smith",
				tags: ["vip"],
			});

			const result = await controller.list({ search: "Alice", tag: "vip" });
			expect(result.total).toBe(1);
			expect(result.customers[0]?.email).toBe("alice@example.com");
		});
	});

	// ── Tags — complex edge cases ────────────────────────────────────

	describe("tags — complex edge cases", () => {
		it("addTags with empty array returns customer unchanged", async () => {
			const customer = await createTestCustomer({ tags: ["existing"] });
			const result = await controller.addTags(customer.id, []);
			expect(result?.tags).toEqual(["existing"]);
		});

		it("removeTags with empty array returns customer unchanged", async () => {
			const customer = await createTestCustomer({ tags: ["keep"] });
			const result = await controller.removeTags(customer.id, []);
			expect(result?.tags).toEqual(["keep"]);
		});

		it("removeTags of all tags results in empty array", async () => {
			const customer = await createTestCustomer({
				tags: ["a", "b", "c"],
			});
			const result = await controller.removeTags(customer.id, ["a", "b", "c"]);
			expect(result?.tags).toEqual([]);
		});

		it("addTags then removeTags round-trips correctly", async () => {
			const customer = await createTestCustomer({ tags: ["original"] });
			await controller.addTags(customer.id, ["new1", "new2"]);
			const afterRemove = await controller.removeTags(customer.id, ["new1"]);
			expect(afterRemove?.tags).toEqual(["original", "new2"]);
		});

		it("removeTags with non-existent tag leaves others untouched", async () => {
			const customer = await createTestCustomer({
				tags: ["keep1", "keep2"],
			});
			const result = await controller.removeTags(customer.id, ["nonexistent"]);
			expect(result?.tags).toEqual(["keep1", "keep2"]);
		});

		it("removeTags is case-insensitive but preserves original case on remaining", async () => {
			const customer = await createTestCustomer({
				tags: ["VIP", "Premium", "Regular"],
			});
			const result = await controller.removeTags(customer.id, ["vip"]);
			expect(result?.tags).toEqual(["Premium", "Regular"]);
		});

		it("listAllTags after removing all tags from all customers returns empty", async () => {
			const c1 = await createTestCustomer({
				email: "a@example.com",
				tags: ["tag1"],
			});
			const c2 = await createTestCustomer({
				email: "b@example.com",
				tags: ["tag1"],
			});
			await controller.removeTags(c1.id, ["tag1"]);
			await controller.removeTags(c2.id, ["tag1"]);
			const tags = await controller.listAllTags();
			expect(tags).toEqual([]);
		});

		it("listAllTags counts are correct after bulk operations", async () => {
			const c1 = await createTestCustomer({
				email: "a@test.com",
				tags: ["alpha"],
			});
			const c2 = await createTestCustomer({
				email: "b@test.com",
				tags: ["alpha"],
			});
			const c3 = await createTestCustomer({
				email: "c@test.com",
				tags: ["beta"],
			});

			await controller.bulkAddTags([c1.id, c2.id, c3.id], ["gamma"]);
			const tags = await controller.listAllTags();
			const gamma = tags.find((t) => t.tag === "gamma");
			expect(gamma?.count).toBe(3);
			const alpha = tags.find((t) => t.tag === "alpha");
			expect(alpha?.count).toBe(2);
		});

		it("bulkAddTags deduplicates with existing tags", async () => {
			const c1 = await createTestCustomer({
				email: "x@test.com",
				tags: ["existing"],
			});
			await controller.bulkAddTags([c1.id], ["existing", "new"]);
			const fetched = await controller.getById(c1.id);
			expect(fetched?.tags).toEqual(["existing", "new"]);
		});

		it("bulkAddTags with empty customerIds returns zero updated", async () => {
			const result = await controller.bulkAddTags([], ["tag"]);
			expect(result.updated).toBe(0);
		});

		it("bulkRemoveTags with empty customerIds returns zero updated", async () => {
			const result = await controller.bulkRemoveTags([], ["tag"]);
			expect(result.updated).toBe(0);
		});

		it("bulkRemoveTags is case-insensitive", async () => {
			const c1 = await createTestCustomer({
				email: "a@test.com",
				tags: ["VIP", "Premium"],
			});
			const c2 = await createTestCustomer({
				email: "b@test.com",
				tags: ["vip", "Regular"],
			});
			await controller.bulkRemoveTags([c1.id, c2.id], ["VIP"]);
			const fetched1 = await controller.getById(c1.id);
			const fetched2 = await controller.getById(c2.id);
			expect(fetched1?.tags).toEqual(["Premium"]);
			expect(fetched2?.tags).toEqual(["Regular"]);
		});

		it("bulkAddTags counts only existing customers", async () => {
			const c1 = await createTestCustomer({ email: "real@test.com" });
			const result = await controller.bulkAddTags(
				[c1.id, "nonexistent-id-1", "nonexistent-id-2"],
				["tag"],
			);
			expect(result.updated).toBe(1);
		});

		it("bulkRemoveTags counts only existing customers", async () => {
			const c1 = await createTestCustomer({
				email: "real@test.com",
				tags: ["removeme"],
			});
			const result = await controller.bulkRemoveTags(
				[c1.id, "nonexistent-id"],
				["removeme"],
			);
			expect(result.updated).toBe(1);
		});
	});

	// ── Addresses — complex edge cases ───────────────────────────────

	describe("addresses — complex edge cases", () => {
		it("multiple addresses for the same customer are all listed", async () => {
			const customer = await createTestCustomer();
			await controller.createAddress({
				customerId: customer.id,
				firstName: "A",
				lastName: "B",
				line1: "123 St",
				city: "City",
				state: "ST",
				postalCode: "12345",
				country: "US",
			});
			await controller.createAddress({
				customerId: customer.id,
				firstName: "C",
				lastName: "D",
				line1: "456 Ave",
				city: "Town",
				state: "CA",
				postalCode: "67890",
				country: "US",
			});
			const addresses = await controller.listAddresses(customer.id);
			expect(addresses).toHaveLength(2);
		});

		it("setDefaultAddress clears previous default of same type", async () => {
			const customer = await createTestCustomer();
			const addr1 = await controller.createAddress({
				customerId: customer.id,
				firstName: "A",
				lastName: "B",
				line1: "111 St",
				city: "City",
				state: "ST",
				postalCode: "11111",
				country: "US",
				isDefault: true,
				type: "shipping",
			});
			const addr2 = await controller.createAddress({
				customerId: customer.id,
				firstName: "C",
				lastName: "D",
				line1: "222 St",
				city: "City",
				state: "ST",
				postalCode: "22222",
				country: "US",
				type: "shipping",
			});

			await controller.setDefaultAddress(customer.id, addr2.id);
			const refetchedAddr1 = await controller.getAddress(addr1.id);
			const refetchedAddr2 = await controller.getAddress(addr2.id);
			expect(refetchedAddr1?.isDefault).toBe(false);
			expect(refetchedAddr2?.isDefault).toBe(true);
		});

		it("setDefaultAddress does not affect different address types", async () => {
			const customer = await createTestCustomer();
			const shipping = await controller.createAddress({
				customerId: customer.id,
				firstName: "A",
				lastName: "B",
				line1: "111 St",
				city: "City",
				state: "ST",
				postalCode: "11111",
				country: "US",
				isDefault: true,
				type: "shipping",
			});
			const billing = await controller.createAddress({
				customerId: customer.id,
				firstName: "C",
				lastName: "D",
				line1: "222 St",
				city: "City",
				state: "ST",
				postalCode: "22222",
				country: "US",
				isDefault: true,
				type: "billing",
			});
			const newShipping = await controller.createAddress({
				customerId: customer.id,
				firstName: "E",
				lastName: "F",
				line1: "333 St",
				city: "City",
				state: "ST",
				postalCode: "33333",
				country: "US",
				type: "shipping",
			});

			await controller.setDefaultAddress(customer.id, newShipping.id);
			const refetchedBilling = await controller.getAddress(billing.id);
			const refetchedOrigShip = await controller.getAddress(shipping.id);
			expect(refetchedBilling?.isDefault).toBe(true);
			expect(refetchedOrigShip?.isDefault).toBe(false);
		});

		it("updateAddress setting isDefault clears only same-type siblings", async () => {
			const customer = await createTestCustomer();
			const ship1 = await controller.createAddress({
				customerId: customer.id,
				firstName: "A",
				lastName: "B",
				line1: "111 St",
				city: "City",
				state: "ST",
				postalCode: "11111",
				country: "US",
				type: "shipping",
				isDefault: true,
			});
			const bill1 = await controller.createAddress({
				customerId: customer.id,
				firstName: "C",
				lastName: "D",
				line1: "222 St",
				city: "City",
				state: "ST",
				postalCode: "22222",
				country: "US",
				type: "billing",
				isDefault: true,
			});
			const ship2 = await controller.createAddress({
				customerId: customer.id,
				firstName: "E",
				lastName: "F",
				line1: "333 St",
				city: "City",
				state: "ST",
				postalCode: "33333",
				country: "US",
				type: "shipping",
			});

			await controller.updateAddress(ship2.id, { isDefault: true });
			const refetchedShip1 = await controller.getAddress(ship1.id);
			const refetchedBill1 = await controller.getAddress(bill1.id);
			expect(refetchedShip1?.isDefault).toBe(false);
			expect(refetchedBill1?.isDefault).toBe(true);
		});

		it("deleteAddress removes it from listAddresses", async () => {
			const customer = await createTestCustomer();
			const addr = await controller.createAddress({
				customerId: customer.id,
				firstName: "A",
				lastName: "B",
				line1: "111 St",
				city: "City",
				state: "ST",
				postalCode: "11111",
				country: "US",
			});
			await controller.deleteAddress(addr.id);
			expect(await controller.getAddress(addr.id)).toBeNull();
		});

		it("listAddresses returns empty for unknown customerId", async () => {
			const addresses = await controller.listAddresses("nonexistent-customer");
			expect(addresses).toEqual([]);
		});

		it("setDefaultAddress returns null for mismatched customerId", async () => {
			const c1 = await createTestCustomer({ email: "c1@test.com" });
			const c2 = await createTestCustomer({ email: "c2@test.com" });
			const addr = await controller.createAddress({
				customerId: c1.id,
				firstName: "A",
				lastName: "B",
				line1: "111 St",
				city: "City",
				state: "ST",
				postalCode: "11111",
				country: "US",
			});
			const result = await controller.setDefaultAddress(c2.id, addr.id);
			expect(result).toBeNull();
		});

		it("setDefaultAddress returns null for nonexistent addressId", async () => {
			const customer = await createTestCustomer();
			const result = await controller.setDefaultAddress(
				customer.id,
				"no-such-address",
			);
			expect(result).toBeNull();
		});

		it("createAddress with isDefault=true clears existing defaults of same type for that customer", async () => {
			const customer = await createTestCustomer();
			const addr1 = await controller.createAddress({
				customerId: customer.id,
				firstName: "A",
				lastName: "B",
				line1: "111 St",
				city: "City",
				state: "ST",
				postalCode: "11111",
				country: "US",
				type: "billing",
				isDefault: true,
			});
			const addr2 = await controller.createAddress({
				customerId: customer.id,
				firstName: "C",
				lastName: "D",
				line1: "222 St",
				city: "City",
				state: "ST",
				postalCode: "22222",
				country: "US",
				type: "billing",
				isDefault: true,
			});

			expect(addr2.isDefault).toBe(true);
			const refetchedAddr1 = await controller.getAddress(addr1.id);
			expect(refetchedAddr1?.isDefault).toBe(false);
		});

		it("updateAddress returns null for nonexistent address", async () => {
			const result = await controller.updateAddress("no-such-id", {
				firstName: "New",
			});
			expect(result).toBeNull();
		});

		it("updateAddress preserves fields not in params", async () => {
			const customer = await createTestCustomer();
			const addr = await controller.createAddress({
				customerId: customer.id,
				firstName: "Original",
				lastName: "Name",
				line1: "111 St",
				city: "City",
				state: "ST",
				postalCode: "11111",
				country: "US",
				phone: "555-1234",
			});
			const updated = await controller.updateAddress(addr.id, {
				city: "NewCity",
			});
			expect(updated?.firstName).toBe("Original");
			expect(updated?.phone).toBe("555-1234");
			expect(updated?.city).toBe("NewCity");
		});
	});

	// ── Export — edge cases ──────────────────────────────────────────

	describe("listForExport — edge cases", () => {
		it("returns empty array when no customers exist", async () => {
			const result = await controller.listForExport({});
			expect(result).toEqual([]);
		});

		it("dateFrom and dateTo combined creates a window", async () => {
			// Create customers at different "times" — mock data service doesn't
			// control createdAt, but the controller uses new Date() at creation time.
			// We'll use the actual createdAt values for the filter.
			const c1 = await createTestCustomer({ email: "early@test.com" });
			await createTestCustomer({ email: "mid@test.com" });
			const c3 = await createTestCustomer({ email: "late@test.com" });

			// All created at approximately the same time, so all should be in range
			const from = new Date(c1.createdAt.getTime() - 1000).toISOString();
			const to = new Date(c3.createdAt.getTime() + 1000).toISOString();
			const result = await controller.listForExport({
				dateFrom: from,
				dateTo: to,
			});
			expect(result).toHaveLength(3);
		});

		it("dateTo before all createdAt returns empty", async () => {
			await createTestCustomer({ email: "future@test.com" });
			const result = await controller.listForExport({
				dateTo: "2000-01-01T00:00:00Z",
			});
			expect(result).toEqual([]);
		});

		it("dateFrom after all createdAt returns empty", async () => {
			await createTestCustomer({ email: "past@test.com" });
			const result = await controller.listForExport({
				dateFrom: "2099-01-01T00:00:00Z",
			});
			expect(result).toEqual([]);
		});

		it("combines all filters", async () => {
			await controller.create({
				email: "alice@test.com",
				firstName: "Alice",
				lastName: "Smith",
				tags: ["vip"],
			});
			await controller.create({
				email: "bob@test.com",
				firstName: "Bob",
				lastName: "Smith",
				tags: ["vip"],
			});
			await controller.create({
				email: "alice2@test.com",
				firstName: "Alice",
				lastName: "Jones",
				tags: ["regular"],
			});

			const result = await controller.listForExport({
				search: "Alice",
				tag: "vip",
			});
			expect(result).toHaveLength(1);
			expect(result[0]?.email).toBe("alice@test.com");
		});
	});

	// ── Import — complex edge cases ──────────────────────────────────

	describe("importCustomers — complex edge cases", () => {
		it("empty rows array returns zero counts and no errors", async () => {
			const result = await controller.importCustomers([]);
			expect(result.created).toBe(0);
			expect(result.updated).toBe(0);
			expect(result.errors).toEqual([]);
		});

		it("whitespace-only email is treated as missing", async () => {
			const result = await controller.importCustomers([
				{
					email: "   ",
					firstName: "Bad",
					lastName: "Email",
				},
			]);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]?.field).toBe("email");
		});

		it("empty string email is treated as missing", async () => {
			const result = await controller.importCustomers([
				{
					email: "",
					firstName: "Empty",
					lastName: "Email",
				},
			]);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]?.field).toBe("email");
		});

		it("import updates existing customer matched case-insensitively", async () => {
			await createTestCustomer({
				email: "Alice@Example.com",
				firstName: "Alice",
				lastName: "Old",
			});

			const result = await controller.importCustomers([
				{
					email: "alice@example.com",
					firstName: "Alice",
					lastName: "New",
				},
			]);
			expect(result.updated).toBe(1);
			expect(result.created).toBe(0);
		});

		it("import merges tags without losing existing ones", async () => {
			await createTestCustomer({
				email: "tagged@test.com",
				tags: ["existing"],
			});

			await controller.importCustomers([
				{
					email: "tagged@test.com",
					tags: ["existing", "newtag"],
				},
			]);

			const customer = await controller.getByEmail("tagged@test.com");
			expect(customer?.tags).toContain("existing");
			expect(customer?.tags).toContain("newtag");
			expect(customer?.tags).toHaveLength(2);
		});

		it("import multiple rows with errors continues processing valid rows", async () => {
			const result = await controller.importCustomers([
				{ email: "good@test.com", firstName: "Good", lastName: "User" },
				{ email: "", firstName: "Bad", lastName: "Email" },
				{ email: "nope", firstName: "No", lastName: "At" },
				{ email: "also-good@test.com", firstName: "Also", lastName: "Good" },
			]);
			expect(result.created).toBe(2);
			expect(result.errors).toHaveLength(2);
			expect(result.errors[0]?.row).toBe(2);
			expect(result.errors[1]?.row).toBe(3);
		});

		it("duplicate emails in same batch — second updates the first", async () => {
			const result = await controller.importCustomers([
				{
					email: "dupe@test.com",
					firstName: "First",
					lastName: "Import",
				},
				{
					email: "dupe@test.com",
					firstName: "Second",
					lastName: "Import",
				},
			]);
			// First creates, second updates
			expect(result.created).toBe(1);
			expect(result.updated).toBe(1);
		});

		it("import sets default firstName/lastName to empty string for new rows", async () => {
			await controller.importCustomers([{ email: "minimal@test.com" }]);
			const customer = await controller.getByEmail("minimal@test.com");
			expect(customer?.firstName).toBe("");
			expect(customer?.lastName).toBe("");
		});

		it("import preserves phone on update", async () => {
			await controller.importCustomers([
				{
					email: "phone@test.com",
					firstName: "Has",
					lastName: "Phone",
					phone: "555-9999",
				},
			]);
			const customer = await controller.getByEmail("phone@test.com");
			expect(customer?.phone).toBe("555-9999");
		});
	});

	// ── Loyalty Points — complex interactions ────────────────────────

	describe.skip("loyalty points — complex interactions", () => {
		it("balance starts at zero for any customer", async () => {
			const customer = await createTestCustomer();
			const balance = await controller.getLoyaltyBalance(customer.id);
			expect(balance.balance).toBe(0);
			expect(balance.totalEarned).toBe(0);
			expect(balance.totalRedeemed).toBe(0);
			expect(balance.transactionCount).toBe(0);
		});

		it("earn then redeem then balance is correct", async () => {
			const customer = await createTestCustomer();
			await controller.earnPoints({
				customerId: customer.id,
				points: 100,
				reason: "Purchase",
			});
			await controller.redeemPoints({
				customerId: customer.id,
				points: 30,
				reason: "Discount",
			});
			const balance = await controller.getLoyaltyBalance(customer.id);
			expect(balance.balance).toBe(70);
			expect(balance.totalEarned).toBe(100);
			expect(balance.totalRedeemed).toBe(30);
			expect(balance.transactionCount).toBe(2);
		});

		it("multiple earn and redeem transactions track running balance", async () => {
			const customer = await createTestCustomer();
			const t1 = await controller.earnPoints({
				customerId: customer.id,
				points: 50,
				reason: "Order 1",
			});
			expect(t1.balance).toBe(50);

			const t2 = await controller.earnPoints({
				customerId: customer.id,
				points: 30,
				reason: "Order 2",
			});
			expect(t2.balance).toBe(80);

			const t3 = await controller.redeemPoints({
				customerId: customer.id,
				points: 20,
				reason: "Reward",
			});
			expect(t3.balance).toBe(60);
		});

		it("redeem exactly the full balance succeeds", async () => {
			const customer = await createTestCustomer();
			await controller.earnPoints({
				customerId: customer.id,
				points: 100,
				reason: "Earn",
			});
			const redeem = await controller.redeemPoints({
				customerId: customer.id,
				points: 100,
				reason: "Full redeem",
			});
			expect(redeem.balance).toBe(0);
			const balance = await controller.getLoyaltyBalance(customer.id);
			expect(balance.balance).toBe(0);
		});

		it("redeem more than balance throws error", async () => {
			const customer = await createTestCustomer();
			await controller.earnPoints({
				customerId: customer.id,
				points: 50,
				reason: "Earn",
			});
			await expect(
				controller.redeemPoints({
					customerId: customer.id,
					points: 51,
					reason: "Too much",
				}),
			).rejects.toThrow("Insufficient loyalty points");
		});

		it("earnPoints with zero throws error", async () => {
			const customer = await createTestCustomer();
			await expect(
				controller.earnPoints({
					customerId: customer.id,
					points: 0,
					reason: "Zero",
				}),
			).rejects.toThrow("Points to earn must be positive");
		});

		it("earnPoints with negative throws error", async () => {
			const customer = await createTestCustomer();
			await expect(
				controller.earnPoints({
					customerId: customer.id,
					points: -10,
					reason: "Negative",
				}),
			).rejects.toThrow("Points to earn must be positive");
		});

		it("redeemPoints with zero throws error", async () => {
			const customer = await createTestCustomer();
			await expect(
				controller.redeemPoints({
					customerId: customer.id,
					points: 0,
					reason: "Zero",
				}),
			).rejects.toThrow("Points to redeem must be positive");
		});

		it("redeemPoints with negative throws error", async () => {
			const customer = await createTestCustomer();
			await expect(
				controller.redeemPoints({
					customerId: customer.id,
					points: -5,
					reason: "Negative",
				}),
			).rejects.toThrow("Points to redeem must be positive");
		});

		it("adjustPoints positive increases balance", async () => {
			const customer = await createTestCustomer();
			const txn = await controller.adjustPoints({
				customerId: customer.id,
				points: 50,
				reason: "Admin bonus",
			});
			expect(txn.type).toBe("adjust");
			expect(txn.points).toBe(50);
			expect(txn.balance).toBe(50);
		});

		it("adjustPoints negative decreases balance", async () => {
			const customer = await createTestCustomer();
			await controller.earnPoints({
				customerId: customer.id,
				points: 100,
				reason: "Earn",
			});
			const txn = await controller.adjustPoints({
				customerId: customer.id,
				points: -30,
				reason: "Correction",
			});
			expect(txn.balance).toBe(70);
		});

		it("adjustPoints with zero throws error", async () => {
			const customer = await createTestCustomer();
			await expect(
				controller.adjustPoints({
					customerId: customer.id,
					points: 0,
					reason: "Zero adjust",
				}),
			).rejects.toThrow("Adjustment points cannot be zero");
		});

		it("adjustPoints that would make balance negative throws error", async () => {
			const customer = await createTestCustomer();
			await controller.earnPoints({
				customerId: customer.id,
				points: 10,
				reason: "Earn",
			});
			await expect(
				controller.adjustPoints({
					customerId: customer.id,
					points: -11,
					reason: "Too much negative",
				}),
			).rejects.toThrow("Adjustment would result in negative balance");
		});

		it("adjustPoints exactly to zero balance succeeds", async () => {
			const customer = await createTestCustomer();
			await controller.earnPoints({
				customerId: customer.id,
				points: 50,
				reason: "Earn",
			});
			const txn = await controller.adjustPoints({
				customerId: customer.id,
				points: -50,
				reason: "Zero out",
			});
			expect(txn.balance).toBe(0);
		});

		it("positive adjustment counts as earned in balance", async () => {
			const customer = await createTestCustomer();
			await controller.adjustPoints({
				customerId: customer.id,
				points: 75,
				reason: "Bonus",
			});
			const balance = await controller.getLoyaltyBalance(customer.id);
			expect(balance.totalEarned).toBe(75);
			expect(balance.totalRedeemed).toBe(0);
			expect(balance.balance).toBe(75);
		});

		it("negative adjustment counts as redeemed in balance", async () => {
			const customer = await createTestCustomer();
			await controller.earnPoints({
				customerId: customer.id,
				points: 100,
				reason: "Earn",
			});
			await controller.adjustPoints({
				customerId: customer.id,
				points: -40,
				reason: "Correction",
			});
			const balance = await controller.getLoyaltyBalance(customer.id);
			expect(balance.totalEarned).toBe(100);
			expect(balance.totalRedeemed).toBe(40);
			expect(balance.balance).toBe(60);
		});

		it("earnPoints stores orderId when provided", async () => {
			const customer = await createTestCustomer();
			const txn = await controller.earnPoints({
				customerId: customer.id,
				points: 25,
				reason: "Purchase",
				orderId: "order-123",
			});
			expect(txn.orderId).toBe("order-123");
		});

		it("redeemPoints stores orderId when provided", async () => {
			const customer = await createTestCustomer();
			await controller.earnPoints({
				customerId: customer.id,
				points: 100,
				reason: "Earn",
			});
			const txn = await controller.redeemPoints({
				customerId: customer.id,
				points: 10,
				reason: "Discount",
				orderId: "order-456",
			});
			expect(txn.orderId).toBe("order-456");
		});
	});

	// ── Loyalty History ──────────────────────────────────────────────

	describe.skip("loyalty history — edge cases", () => {
		it("history is empty for customer with no transactions", async () => {
			const customer = await createTestCustomer();
			const history = await controller.getLoyaltyHistory(customer.id);
			expect(history.transactions).toEqual([]);
			expect(history.total).toBe(0);
		});

		it("history default limit is 20", async () => {
			const customer = await createTestCustomer();
			for (let i = 0; i < 25; i++) {
				await controller.earnPoints({
					customerId: customer.id,
					points: 1,
					reason: `Earn ${i}`,
				});
			}
			const history = await controller.getLoyaltyHistory(customer.id);
			expect(history.transactions).toHaveLength(20);
			expect(history.total).toBe(25);
		});

		it("history pagination with offset works", async () => {
			const customer = await createTestCustomer();
			for (let i = 0; i < 5; i++) {
				await controller.earnPoints({
					customerId: customer.id,
					points: 1,
					reason: `Earn ${i}`,
				});
			}
			const page2 = await controller.getLoyaltyHistory(customer.id, {
				limit: 2,
				offset: 2,
			});
			expect(page2.transactions).toHaveLength(2);
			expect(page2.total).toBe(5);
		});

		it("history with offset beyond total returns empty", async () => {
			const customer = await createTestCustomer();
			await controller.earnPoints({
				customerId: customer.id,
				points: 10,
				reason: "Test",
			});
			const result = await controller.getLoyaltyHistory(customer.id, {
				offset: 100,
			});
			expect(result.transactions).toEqual([]);
			expect(result.total).toBe(1);
		});

		it("history includes all transaction types", async () => {
			const customer = await createTestCustomer();
			await controller.earnPoints({
				customerId: customer.id,
				points: 100,
				reason: "Earn",
			});
			await controller.redeemPoints({
				customerId: customer.id,
				points: 20,
				reason: "Redeem",
			});
			await controller.adjustPoints({
				customerId: customer.id,
				points: 5,
				reason: "Adjust",
			});
			const history = await controller.getLoyaltyHistory(customer.id);
			const types = history.transactions.map((t) => t.type);
			expect(types).toContain("earn");
			expect(types).toContain("redeem");
			expect(types).toContain("adjust");
		});

		it("history only returns transactions for the specified customer", async () => {
			const c1 = await createTestCustomer({ email: "c1@test.com" });
			const c2 = await createTestCustomer({ email: "c2@test.com" });
			await controller.earnPoints({
				customerId: c1.id,
				points: 50,
				reason: "C1 earn",
			});
			await controller.earnPoints({
				customerId: c2.id,
				points: 30,
				reason: "C2 earn",
			});
			const history = await controller.getLoyaltyHistory(c1.id);
			expect(history.total).toBe(1);
			expect(history.transactions[0]?.customerId).toBe(c1.id);
		});
	});

	// ── Loyalty Stats — complex scenarios ────────────────────────────

	describe.skip("loyalty stats — complex scenarios", () => {
		it("stats are zero when no transactions exist", async () => {
			const stats = await controller.getLoyaltyStats();
			expect(stats.totalCustomersWithPoints).toBe(0);
			expect(stats.totalPointsIssued).toBe(0);
			expect(stats.totalPointsRedeemed).toBe(0);
			expect(stats.totalPointsOutstanding).toBe(0);
			expect(stats.averageBalance).toBe(0);
			expect(stats.topCustomers).toEqual([]);
		});

		it("stats reflect multiple customers with different balances", async () => {
			const c1 = await createTestCustomer({ email: "c1@test.com" });
			const c2 = await createTestCustomer({ email: "c2@test.com" });

			await controller.earnPoints({
				customerId: c1.id,
				points: 100,
				reason: "Earn",
			});
			await controller.earnPoints({
				customerId: c2.id,
				points: 200,
				reason: "Earn",
			});
			await controller.redeemPoints({
				customerId: c1.id,
				points: 30,
				reason: "Redeem",
			});

			const stats = await controller.getLoyaltyStats();
			expect(stats.totalPointsIssued).toBe(300);
			expect(stats.totalPointsRedeemed).toBe(30);
			expect(stats.totalPointsOutstanding).toBe(270);
			expect(stats.totalCustomersWithPoints).toBe(2);
		});

		it("topCustomers sorted by balance desc, limited to 10", async () => {
			const customers: Awaited<ReturnType<typeof createTestCustomer>>[] = [];
			for (let i = 0; i < 12; i++) {
				const c = await createTestCustomer({
					email: `top${i}@test.com`,
					firstName: `Customer`,
					lastName: `${i}`,
				});
				customers.push(c);
				await controller.earnPoints({
					customerId: c.id,
					points: (i + 1) * 10,
					reason: `Earn ${i}`,
				});
			}

			const stats = await controller.getLoyaltyStats();
			expect(stats.topCustomers).toHaveLength(10);
			expect(stats.topCustomers[0]?.balance).toBe(120);
			expect(stats.topCustomers[9]?.balance).toBe(30);
		});

		it("topCustomers includes email and name", async () => {
			const c = await controller.create({
				email: "loyal@test.com",
				firstName: "Loyal",
				lastName: "Customer",
			});
			await controller.earnPoints({
				customerId: c.id,
				points: 100,
				reason: "Earn",
			});

			const stats = await controller.getLoyaltyStats();
			expect(stats.topCustomers[0]?.email).toBe("loyal@test.com");
			expect(stats.topCustomers[0]?.name).toBe("Loyal Customer");
		});

		it("customer with fully redeemed balance not counted in customersWithPoints", async () => {
			const c = await createTestCustomer({ email: "zeroed@test.com" });
			await controller.earnPoints({
				customerId: c.id,
				points: 50,
				reason: "Earn",
			});
			await controller.redeemPoints({
				customerId: c.id,
				points: 50,
				reason: "Redeem all",
			});

			const stats = await controller.getLoyaltyStats();
			expect(stats.totalCustomersWithPoints).toBe(0);
		});

		it("averageBalance is rounded to nearest integer", async () => {
			const c1 = await createTestCustomer({ email: "c1@test.com" });
			const c2 = await createTestCustomer({ email: "c2@test.com" });

			await controller.earnPoints({
				customerId: c1.id,
				points: 10,
				reason: "Earn",
			});
			await controller.earnPoints({
				customerId: c2.id,
				points: 13,
				reason: "Earn",
			});

			// Outstanding = 23, customers with points = 2, average = 11.5 → rounded = 12
			const stats = await controller.getLoyaltyStats();
			expect(stats.averageBalance).toBe(12);
		});

		it("stats with adjustments counts positive as issued and negative as redeemed", async () => {
			const c = await createTestCustomer({ email: "adj@test.com" });
			await controller.adjustPoints({
				customerId: c.id,
				points: 100,
				reason: "Positive adjust",
			});
			await controller.adjustPoints({
				customerId: c.id,
				points: -25,
				reason: "Negative adjust",
			});

			const stats = await controller.getLoyaltyStats();
			expect(stats.totalPointsIssued).toBe(100);
			expect(stats.totalPointsRedeemed).toBe(25);
			expect(stats.totalPointsOutstanding).toBe(75);
		});
	});

	// ── Event emission ───────────────────────────────────────────────

	describe("event emission — edge cases", () => {
		it("emits customer.created event with correct payload", async () => {
			const events = { emit: vi.fn(), on: vi.fn(), off: vi.fn() };
			const ctrl = createCustomerController(mockData, events);
			const customer = await ctrl.create({
				email: "event@test.com",
				firstName: "Event",
				lastName: "Test",
			});
			expect(events.emit).toHaveBeenCalledWith("customer.created", {
				customerId: customer.id,
				email: "event@test.com",
				firstName: "Event",
				lastName: "Test",
			});
		});

		it("does not emit event when events is undefined", async () => {
			const ctrl = createCustomerController(mockData);
			// This should not throw
			await ctrl.create({
				email: "no-event@test.com",
				firstName: "No",
				lastName: "Event",
			});
		});

		it("emits event for each create call", async () => {
			const events = { emit: vi.fn(), on: vi.fn(), off: vi.fn() };
			const ctrl = createCustomerController(mockData, events);
			await ctrl.create({
				email: "first@test.com",
				firstName: "First",
				lastName: "User",
			});
			await ctrl.create({
				email: "second@test.com",
				firstName: "Second",
				lastName: "User",
			});
			expect(events.emit).toHaveBeenCalledTimes(2);
		});
	});

	// ── Cross-domain interactions ────────────────────────────────────

	describe("cross-domain interactions", () => {
		it("deleting customer does not affect other customers' tags", async () => {
			const c1 = await createTestCustomer({
				email: "c1@test.com",
				tags: ["shared"],
			});
			const c2 = await createTestCustomer({
				email: "c2@test.com",
				tags: ["shared"],
			});
			await controller.delete(c1.id);

			const tags = await controller.listAllTags();
			expect(tags).toHaveLength(1);
			expect(tags[0]?.count).toBe(1);

			const fetched = await controller.getById(c2.id);
			expect(fetched?.tags).toEqual(["shared"]);
		});

		it("deleting customer does not affect other customers' addresses", async () => {
			const c1 = await createTestCustomer({ email: "c1@test.com" });
			const c2 = await createTestCustomer({ email: "c2@test.com" });
			await controller.createAddress({
				customerId: c1.id,
				firstName: "A",
				lastName: "B",
				line1: "111 St",
				city: "City",
				state: "ST",
				postalCode: "11111",
				country: "US",
			});
			const addr2 = await controller.createAddress({
				customerId: c2.id,
				firstName: "C",
				lastName: "D",
				line1: "222 St",
				city: "City",
				state: "ST",
				postalCode: "22222",
				country: "US",
			});
			await controller.delete(c1.id);

			const c2Addrs = await controller.listAddresses(c2.id);
			expect(c2Addrs).toHaveLength(1);
			expect(c2Addrs[0]?.id).toBe(addr2.id);
		});

		it("updating customer tags does not invoke a Customers loyalty ledger", async () => {
			const c = await createTestCustomer({ tags: ["old"] });
			await expect(
				controller.earnPoints({
					customerId: c.id,
					points: 100,
					reason: "Earn",
				}),
			).rejects.toThrow("Loyalty writes belong to the Loyalty module.");
			await controller.update(c.id, { tags: ["new"] });
			const balance = await controller.getLoyaltyBalance(c.id);
			expect(balance.balance).toBe(0);
		});

		it("import creates customers without a Customers loyalty ledger", async () => {
			await controller.importCustomers([
				{
					email: "imported@test.com",
					firstName: "Imported",
					lastName: "User",
				},
			]);
			const customer = await controller.getByEmail("imported@test.com");
			expect(customer).not.toBeNull();

			await expect(
				controller.earnPoints({
					customerId: customer?.id ?? "",
					points: 50,
					reason: "Welcome bonus",
				}),
			).rejects.toThrow("Loyalty writes belong to the Loyalty module.");
			const balance = await controller.getLoyaltyBalance(customer?.id ?? "");
			expect(balance.balance).toBe(0);
		});

		it("list and export give consistent results for same data", async () => {
			await controller.create({
				email: "consistent@test.com",
				firstName: "Consistent",
				lastName: "User",
				tags: ["test"],
			});

			const listed = await controller.list({ search: "Consistent" });
			const exported = await controller.listForExport({
				search: "Consistent",
			});
			expect(listed.total).toBe(exported.length);
		});
	});
});
