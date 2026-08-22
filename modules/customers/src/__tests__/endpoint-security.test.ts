import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createCustomerController } from "../service-impl";

/**
 * Security tests for customers module endpoints.
 *
 * These tests verify:
 * - Address ownership: getAddress returns any address by ID (documents missing ownership check)
 * - Address isolation: listAddresses scoped to customerId
 * - Default address: setDefaultAddress rejects wrong customer's address
 * - Loyalty isolation: customer A's points don't affect customer B
 * - Redeem validation: cannot redeem more than balance
 * - Email uniqueness: getByEmail returns correct customer
 * - Delete cascade: deleting customer works independently
 */

describe("customers endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createCustomerController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createCustomerController(mockData);
	});

	// -- Address Ownership ------------------------------------------------

	describe("address ownership", () => {
		it("getAddress returns any address by ID without ownership check", async () => {
			const customerA = await controller.create({
				email: "alice@test.com",
				firstName: "Alice",
				lastName: "A",
			});
			const customerB = await controller.create({
				email: "bob@test.com",
				firstName: "Bob",
				lastName: "B",
			});

			const addressA = await controller.createAddress({
				customerId: customerA.id,
				firstName: "Alice",
				lastName: "A",
				line1: "123 Main St",
				city: "Springfield",
				state: "IL",
				postalCode: "62701",
				country: "US",
			});

			// Customer B's controller can fetch customer A's address by ID
			// This documents that the endpoint layer must enforce ownership
			const fetched = await controller.getAddress(addressA.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.customerId).toBe(customerA.id);
			expect(fetched?.customerId).not.toBe(customerB.id);
		});

		it("deleteAddress removes any address by ID without ownership check", async () => {
			const customerA = await controller.create({
				email: "alice@test.com",
				firstName: "Alice",
				lastName: "A",
			});
			await controller.create({
				email: "bob@test.com",
				firstName: "Bob",
				lastName: "B",
			});

			const addressA = await controller.createAddress({
				customerId: customerA.id,
				firstName: "Alice",
				lastName: "A",
				line1: "123 Main St",
				city: "Springfield",
				state: "IL",
				postalCode: "62701",
				country: "US",
			});

			// Delete succeeds without any customer validation
			await controller.deleteAddress(addressA.id);
			const fetched = await controller.getAddress(addressA.id);
			expect(fetched).toBeNull();
		});
	});

	// -- Address Isolation ------------------------------------------------

	describe("address isolation", () => {
		it("listAddresses returns only the specified customer's addresses", async () => {
			const customerA = await controller.create({
				email: "alice@test.com",
				firstName: "Alice",
				lastName: "A",
			});
			const customerB = await controller.create({
				email: "bob@test.com",
				firstName: "Bob",
				lastName: "B",
			});

			await controller.createAddress({
				customerId: customerA.id,
				firstName: "Alice",
				lastName: "A",
				line1: "123 Main St",
				city: "Springfield",
				state: "IL",
				postalCode: "62701",
				country: "US",
			});
			await controller.createAddress({
				customerId: customerA.id,
				firstName: "Alice",
				lastName: "A",
				line1: "456 Oak Ave",
				city: "Springfield",
				state: "IL",
				postalCode: "62702",
				country: "US",
			});
			await controller.createAddress({
				customerId: customerB.id,
				firstName: "Bob",
				lastName: "B",
				line1: "789 Elm Rd",
				city: "Shelbyville",
				state: "IL",
				postalCode: "62703",
				country: "US",
			});

			const addressesA = await controller.listAddresses(customerA.id);
			const addressesB = await controller.listAddresses(customerB.id);

			expect(addressesA).toHaveLength(2);
			expect(addressesB).toHaveLength(1);
			for (const addr of addressesA) {
				expect(addr.customerId).toBe(customerA.id);
			}
			for (const addr of addressesB) {
				expect(addr.customerId).toBe(customerB.id);
			}
		});

		it("listAddresses returns empty array for customer with no addresses", async () => {
			const customer = await controller.create({
				email: "noaddr@test.com",
				firstName: "No",
				lastName: "Addr",
			});

			const addresses = await controller.listAddresses(customer.id);
			expect(addresses).toHaveLength(0);
		});
	});

	// -- Default Address Security -----------------------------------------

	describe("default address security", () => {
		it("setDefaultAddress rejects address belonging to another customer", async () => {
			const customerA = await controller.create({
				email: "alice@test.com",
				firstName: "Alice",
				lastName: "A",
			});
			const customerB = await controller.create({
				email: "bob@test.com",
				firstName: "Bob",
				lastName: "B",
			});

			const addressB = await controller.createAddress({
				customerId: customerB.id,
				firstName: "Bob",
				lastName: "B",
				line1: "789 Elm Rd",
				city: "Shelbyville",
				state: "IL",
				postalCode: "62703",
				country: "US",
			});

			// Attempting to set customer B's address as customer A's default
			const result = await controller.setDefaultAddress(
				customerA.id,
				addressB.id,
			);
			expect(result).toBeNull();
		});

		it("setDefaultAddress succeeds for the correct customer", async () => {
			const customer = await controller.create({
				email: "alice@test.com",
				firstName: "Alice",
				lastName: "A",
			});

			const address = await controller.createAddress({
				customerId: customer.id,
				firstName: "Alice",
				lastName: "A",
				line1: "123 Main St",
				city: "Springfield",
				state: "IL",
				postalCode: "62701",
				country: "US",
			});

			const result = await controller.setDefaultAddress(
				customer.id,
				address.id,
			);
			expect(result).not.toBeNull();
			expect(result?.isDefault).toBe(true);
		});

		it("setDefaultAddress clears previous default of the same type", async () => {
			const customer = await controller.create({
				email: "alice@test.com",
				firstName: "Alice",
				lastName: "A",
			});

			const addr1 = await controller.createAddress({
				customerId: customer.id,
				firstName: "Alice",
				lastName: "A",
				line1: "123 Main St",
				city: "Springfield",
				state: "IL",
				postalCode: "62701",
				country: "US",
				isDefault: true,
			});

			const addr2 = await controller.createAddress({
				customerId: customer.id,
				firstName: "Alice",
				lastName: "A",
				line1: "456 Oak Ave",
				city: "Springfield",
				state: "IL",
				postalCode: "62702",
				country: "US",
			});

			await controller.setDefaultAddress(customer.id, addr2.id);

			const refreshed1 = await controller.getAddress(addr1.id);
			const refreshed2 = await controller.getAddress(addr2.id);
			expect(refreshed1?.isDefault).toBe(false);
			expect(refreshed2?.isDefault).toBe(true);
		});

		it("setDefaultAddress returns null for non-existent address", async () => {
			const customer = await controller.create({
				email: "alice@test.com",
				firstName: "Alice",
				lastName: "A",
			});

			const result = await controller.setDefaultAddress(
				customer.id,
				"nonexistent-address-id",
			);
			expect(result).toBeNull();
		});
	});

	// -- Loyalty quarantine ------------------------------------------------

	describe("loyalty quarantine", () => {
		it("loyalty writes refuse across customers", async () => {
			const customerA = await controller.create({
				email: "alice@test.com",
				firstName: "Alice",
				lastName: "A",
			});
			const customerB = await controller.create({
				email: "bob@test.com",
				firstName: "Bob",
				lastName: "B",
			});

			await expect(
				controller.earnPoints({
					customerId: customerA.id,
					points: 500,
					reason: "Order reward",
				}),
			).rejects.toThrow("Loyalty writes belong to the Loyalty module.");

			const balanceA = await controller.getLoyaltyBalance(customerA.id);
			const balanceB = await controller.getLoyaltyBalance(customerB.id);
			expect(balanceA.balance).toBe(0);
			expect(balanceB.balance).toBe(0);
		});

		it("redeem and adjust also refuse", async () => {
			const customer = await controller.create({
				email: "alice@test.com",
				firstName: "Alice",
				lastName: "A",
			});
			await expect(
				controller.redeemPoints({
					customerId: customer.id,
					points: 10,
					reason: "Redeem",
				}),
			).rejects.toThrow("Loyalty writes belong to the Loyalty module.");
			await expect(
				controller.adjustPoints({
					customerId: customer.id,
					points: -5,
					reason: "Adjust",
				}),
			).rejects.toThrow("Loyalty writes belong to the Loyalty module.");
		});
	});

	// -- Email Uniqueness -------------------------------------------------

	describe("email uniqueness", () => {
		it("getByEmail returns the correct customer", async () => {
			await controller.create({
				email: "alice@test.com",
				firstName: "Alice",
				lastName: "A",
			});
			await controller.create({
				email: "bob@test.com",
				firstName: "Bob",
				lastName: "B",
			});

			const alice = await controller.getByEmail("alice@test.com");
			const bob = await controller.getByEmail("bob@test.com");

			expect(alice).not.toBeNull();
			expect(alice?.email).toBe("alice@test.com");
			expect(alice?.firstName).toBe("Alice");

			expect(bob).not.toBeNull();
			expect(bob?.email).toBe("bob@test.com");
			expect(bob?.firstName).toBe("Bob");
		});

		it("getByEmail returns null for non-existent email", async () => {
			await controller.create({
				email: "alice@test.com",
				firstName: "Alice",
				lastName: "A",
			});

			const result = await controller.getByEmail("nonexistent@test.com");
			expect(result).toBeNull();
		});
	});

	// -- Delete Independence ----------------------------------------------

	describe("delete independence", () => {
		it("deleting one customer does not affect another", async () => {
			const customerA = await controller.create({
				email: "alice@test.com",
				firstName: "Alice",
				lastName: "A",
			});
			const customerB = await controller.create({
				email: "bob@test.com",
				firstName: "Bob",
				lastName: "B",
			});

			await controller.delete(customerA.id);

			const deletedA = await controller.getById(customerA.id);
			const survivingB = await controller.getById(customerB.id);

			expect(deletedA).toBeNull();
			expect(survivingB).not.toBeNull();
			expect(survivingB?.email).toBe("bob@test.com");
		});

		it("getById returns null for non-existent customer", async () => {
			const result = await controller.getById("nonexistent-id");
			expect(result).toBeNull();
		});

		it("update returns null for deleted customer", async () => {
			const customer = await controller.create({
				email: "alice@test.com",
				firstName: "Alice",
				lastName: "A",
			});

			await controller.delete(customer.id);

			const result = await controller.update(customer.id, {
				firstName: "Updated",
			});
			expect(result).toBeNull();
		});
	});
});
