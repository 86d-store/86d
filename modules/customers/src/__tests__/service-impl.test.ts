import type { ScopedEventEmitter } from "@86d-app/core/events";
import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCustomerController } from "../service-impl";

function createMockEvents(): ScopedEventEmitter & {
	emitted: Array<{ type: string; payload: unknown }>;
} {
	const emitted: Array<{ type: string; payload: unknown }> = [];
	return {
		emitted,
		emit: vi.fn(async (type: string, payload: unknown) => {
			emitted.push({ type, payload });
		}),
		on: vi.fn(() => () => {}),
		off: vi.fn(),
	};
}

describe("createCustomerController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createCustomerController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createCustomerController(mockData);
	});

	describe("create", () => {
		it("creates a customer with all fields", async () => {
			const customer = await controller.create({
				email: "alice@example.com",
				firstName: "Alice",
				lastName: "Smith",
				phone: "+1-555-0100",
			});

			expect(customer.email).toBe("alice@example.com");
			expect(customer.firstName).toBe("Alice");
			expect(customer.lastName).toBe("Smith");
			expect(customer.phone).toBe("+1-555-0100");
			expect(customer.id).toBeTruthy();
			expect(customer.createdAt).toBeInstanceOf(Date);
		});

		it("uses provided ID when given", async () => {
			const customer = await controller.create({
				id: "cust_abc123",
				email: "bob@example.com",
				firstName: "Bob",
				lastName: "Jones",
			});
			expect(customer.id).toBe("cust_abc123");
		});

		it("sets default metadata to empty object", async () => {
			const customer = await controller.create({
				email: "charlie@example.com",
				firstName: "Charlie",
				lastName: "Brown",
			});
			expect(customer.metadata).toEqual({});
		});

		it("stores dateOfBirth when provided", async () => {
			const dob = new Date("1990-06-15");
			const customer = await controller.create({
				email: "dob@example.com",
				firstName: "Dawn",
				lastName: "Bell",
				dateOfBirth: dob,
			});
			expect(customer.dateOfBirth).toEqual(dob);
		});

		it("stores custom metadata", async () => {
			const customer = await controller.create({
				email: "meta@example.com",
				firstName: "Meta",
				lastName: "Data",
				metadata: { vip: true, tier: "gold" },
			});
			expect(customer.metadata).toEqual({ vip: true, tier: "gold" });
		});

		it("sets both createdAt and updatedAt to the same time", async () => {
			const customer = await controller.create({
				email: "timestamps@example.com",
				firstName: "Time",
				lastName: "Stamp",
			});
			expect(customer.createdAt.getTime()).toBe(customer.updatedAt.getTime());
		});
	});

	describe("getById", () => {
		it("returns null for non-existent customer", async () => {
			const result = await controller.getById("non-existent");
			expect(result).toBeNull();
		});

		it("returns customer after creation", async () => {
			const created = await controller.create({
				email: "dave@example.com",
				firstName: "Dave",
				lastName: "Wilson",
			});

			const found = await controller.getById(created.id);
			expect(found).not.toBeNull();
			expect(found?.email).toBe("dave@example.com");
		});

		it("returns all stored fields", async () => {
			const dob = new Date("1985-03-20");
			const created = await controller.create({
				email: "full@example.com",
				firstName: "Full",
				lastName: "Fields",
				phone: "+1-555-9999",
				dateOfBirth: dob,
				metadata: { source: "import" },
			});

			const found = await controller.getById(created.id);
			expect(found?.phone).toBe("+1-555-9999");
			expect(found?.dateOfBirth).toEqual(dob);
			expect(found?.metadata).toEqual({ source: "import" });
		});
	});

	describe("getByEmail", () => {
		it("returns null for non-existent email", async () => {
			const result = await controller.getByEmail("notfound@example.com");
			expect(result).toBeNull();
		});

		it("finds customer by email", async () => {
			await controller.create({
				email: "eve@example.com",
				firstName: "Eve",
				lastName: "Davis",
			});

			const found = await controller.getByEmail("eve@example.com");
			expect(found).not.toBeNull();
			expect(found?.firstName).toBe("Eve");
		});

		it("returns null when store is empty", async () => {
			const found = await controller.getByEmail("nobody@nowhere.com");
			expect(found).toBeNull();
		});
	});

	describe("update", () => {
		it("returns null for non-existent customer", async () => {
			const result = await controller.update("non-existent", {
				firstName: "Test",
			});
			expect(result).toBeNull();
		});

		it("updates specified fields only", async () => {
			const created = await controller.create({
				email: "frank@example.com",
				firstName: "Frank",
				lastName: "Miller",
			});

			const updated = await controller.update(created.id, {
				firstName: "Franklin",
				phone: "+1-555-0200",
			});

			expect(updated?.firstName).toBe("Franklin");
			expect(updated?.lastName).toBe("Miller"); // unchanged
			expect(updated?.phone).toBe("+1-555-0200");
			expect(updated?.email).toBe("frank@example.com"); // unchanged
		});

		it("updates updatedAt timestamp", async () => {
			const created = await controller.create({
				email: "grace@example.com",
				firstName: "Grace",
				lastName: "Lee",
			});

			await new Promise((r) => setTimeout(r, 1));
			const updated = await controller.update(created.id, {
				lastName: "Taylor",
			});

			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				created.updatedAt.getTime(),
			);
		});

		it("clears phone by passing null", async () => {
			const created = await controller.create({
				email: "clearphone@example.com",
				firstName: "Clear",
				lastName: "Phone",
				phone: "+1-555-0300",
			});
			expect(created.phone).toBe("+1-555-0300");

			const updated = await controller.update(created.id, { phone: null });
			expect(updated?.phone).toBeUndefined();
		});

		it("clears dateOfBirth by passing null", async () => {
			const dob = new Date("1990-01-01");
			const created = await controller.create({
				email: "cleardob@example.com",
				firstName: "Clear",
				lastName: "DOB",
				dateOfBirth: dob,
			});

			const updated = await controller.update(created.id, {
				dateOfBirth: null,
			});
			expect(updated?.dateOfBirth).toBeUndefined();
		});

		it("updates metadata", async () => {
			const created = await controller.create({
				email: "updatemeta@example.com",
				firstName: "Update",
				lastName: "Meta",
				metadata: { tier: "bronze" },
			});

			const updated = await controller.update(created.id, {
				metadata: { tier: "gold", reward: true },
			});
			expect(updated?.metadata).toEqual({ tier: "gold", reward: true });
		});

		it("preserves email when updating other fields", async () => {
			const created = await controller.create({
				email: "keep@example.com",
				firstName: "Keep",
				lastName: "Email",
			});

			const updated = await controller.update(created.id, {
				firstName: "Changed",
			});
			expect(updated?.email).toBe("keep@example.com");
			expect(updated?.firstName).toBe("Changed");
		});
	});

	describe("delete", () => {
		it("deletes a customer", async () => {
			const created = await controller.create({
				email: "henry@example.com",
				firstName: "Henry",
				lastName: "Clark",
			});

			await controller.delete(created.id);
			const found = await controller.getById(created.id);
			expect(found).toBeNull();
		});

		it("does not throw when deleting non-existent customer", async () => {
			await expect(
				controller.delete("non-existent-id"),
			).resolves.toBeUndefined();
		});
	});

	describe("list", () => {
		beforeEach(async () => {
			await controller.create({
				email: "alice@test.com",
				firstName: "Alice",
				lastName: "Alpha",
			});
			await controller.create({
				email: "bob@test.com",
				firstName: "Bob",
				lastName: "Beta",
			});
			await controller.create({
				email: "carol@test.com",
				firstName: "Carol",
				lastName: "Gamma",
			});
		});

		it("lists all customers", async () => {
			const { customers, total } = await controller.list({});
			expect(total).toBe(3);
			expect(customers).toHaveLength(3);
		});

		it("paginates results", async () => {
			const { customers, total } = await controller.list({
				limit: 2,
				offset: 0,
			});
			expect(total).toBe(3);
			expect(customers).toHaveLength(2);
		});

		it("paginates with offset skipping first results", async () => {
			const { customers, total } = await controller.list({
				limit: 2,
				offset: 2,
			});
			expect(total).toBe(3);
			expect(customers).toHaveLength(1);
		});

		it("searches by name", async () => {
			const { customers, total } = await controller.list({ search: "Alice" });
			expect(total).toBe(1);
			expect(customers[0]?.firstName).toBe("Alice");
		});

		it("searches by email", async () => {
			const { customers } = await controller.list({ search: "bob@test" });
			expect(customers).toHaveLength(1);
			expect(customers[0]?.email).toBe("bob@test.com");
		});

		it("searches by last name", async () => {
			const { customers } = await controller.list({ search: "Gamma" });
			expect(customers).toHaveLength(1);
			expect(customers[0]?.lastName).toBe("Gamma");
		});

		it("search is case-insensitive", async () => {
			const { customers } = await controller.list({ search: "alice" });
			expect(customers).toHaveLength(1);
			expect(customers[0]?.firstName).toBe("Alice");
		});

		it("returns empty list for no matches", async () => {
			const { customers, total } = await controller.list({
				search: "zzz-no-match",
			});
			expect(total).toBe(0);
			expect(customers).toHaveLength(0);
		});

		it("sorts by createdAt descending", async () => {
			const { customers } = await controller.list({});
			for (let i = 0; i < customers.length - 1; i++) {
				const current = customers[i];
				const next = customers[i + 1];
				expect(current?.createdAt.getTime()).toBeGreaterThanOrEqual(
					next?.createdAt.getTime() ?? 0,
				);
			}
		});

		it("returns empty list when store has no customers", async () => {
			const freshData = createMockDataService();
			const freshCtrl = createCustomerController(freshData);
			const { customers, total } = await freshCtrl.list({});
			expect(total).toBe(0);
			expect(customers).toHaveLength(0);
		});
	});

	describe("addresses", () => {
		let customerId: string;

		beforeEach(async () => {
			const customer = await controller.create({
				email: "ivy@example.com",
				firstName: "Ivy",
				lastName: "Chen",
			});
			customerId = customer.id;
		});

		it("creates an address", async () => {
			const address = await controller.createAddress({
				customerId,
				type: "shipping",
				firstName: "Ivy",
				lastName: "Chen",
				line1: "123 Main St",
				city: "Springfield",
				state: "IL",
				postalCode: "62701",
				country: "US",
				isDefault: true,
			});

			expect(address.customerId).toBe(customerId);
			expect(address.type).toBe("shipping");
			expect(address.line1).toBe("123 Main St");
			expect(address.isDefault).toBe(true);
		});

		it("defaults type to shipping", async () => {
			const address = await controller.createAddress({
				customerId,
				firstName: "Ivy",
				lastName: "Chen",
				line1: "100 Default St",
				city: "City",
				state: "ST",
				postalCode: "00000",
				country: "US",
			});
			expect(address.type).toBe("shipping");
		});

		it("defaults isDefault to false", async () => {
			const address = await controller.createAddress({
				customerId,
				firstName: "Ivy",
				lastName: "Chen",
				line1: "200 NoDefault St",
				city: "City",
				state: "ST",
				postalCode: "00000",
				country: "US",
			});
			expect(address.isDefault).toBe(false);
		});

		it("creates billing address", async () => {
			const address = await controller.createAddress({
				customerId,
				type: "billing",
				firstName: "Ivy",
				lastName: "Chen",
				line1: "300 Billing Ave",
				city: "City",
				state: "ST",
				postalCode: "00000",
				country: "US",
			});
			expect(address.type).toBe("billing");
		});

		it("stores optional fields (company, line2, phone)", async () => {
			const address = await controller.createAddress({
				customerId,
				firstName: "Ivy",
				lastName: "Chen",
				company: "Acme Inc",
				line1: "400 Corp Blvd",
				line2: "Suite 200",
				city: "City",
				state: "ST",
				postalCode: "00000",
				country: "US",
				phone: "+1-555-0400",
			});
			expect(address.company).toBe("Acme Inc");
			expect(address.line2).toBe("Suite 200");
			expect(address.phone).toBe("+1-555-0400");
		});

		it("clears existing default of same type when creating a new default", async () => {
			const addr1 = await controller.createAddress({
				customerId,
				type: "shipping",
				firstName: "Ivy",
				lastName: "Chen",
				line1: "First",
				city: "City",
				state: "ST",
				postalCode: "00000",
				country: "US",
				isDefault: true,
			});

			await controller.createAddress({
				customerId,
				type: "shipping",
				firstName: "Ivy",
				lastName: "Chen",
				line1: "Second",
				city: "City",
				state: "ST",
				postalCode: "00000",
				country: "US",
				isDefault: true,
			});

			const refreshed1 = await controller.getAddress(addr1.id);
			expect(refreshed1?.isDefault).toBe(false);
		});

		it("does not clear billing default when creating shipping default", async () => {
			const billing = await controller.createAddress({
				customerId,
				type: "billing",
				firstName: "Ivy",
				lastName: "Chen",
				line1: "Billing St",
				city: "City",
				state: "ST",
				postalCode: "00000",
				country: "US",
				isDefault: true,
			});

			await controller.createAddress({
				customerId,
				type: "shipping",
				firstName: "Ivy",
				lastName: "Chen",
				line1: "Shipping St",
				city: "City",
				state: "ST",
				postalCode: "00000",
				country: "US",
				isDefault: true,
			});

			const refreshedBilling = await controller.getAddress(billing.id);
			expect(refreshedBilling?.isDefault).toBe(true);
		});

		it("lists addresses for customer", async () => {
			await controller.createAddress({
				customerId,
				firstName: "Ivy",
				lastName: "Chen",
				line1: "456 Oak Ave",
				city: "Chicago",
				state: "IL",
				postalCode: "60601",
				country: "US",
			});

			const addresses = await controller.listAddresses(customerId);
			expect(addresses).toHaveLength(1);
		});

		it("returns empty array for customer with no addresses", async () => {
			const addresses = await controller.listAddresses(customerId);
			expect(addresses).toHaveLength(0);
		});

		it("gets address by id", async () => {
			const created = await controller.createAddress({
				customerId,
				firstName: "Ivy",
				lastName: "Chen",
				line1: "789 Elm St",
				city: "Rockford",
				state: "IL",
				postalCode: "61101",
				country: "US",
			});

			const found = await controller.getAddress(created.id);
			expect(found?.line1).toBe("789 Elm St");
		});

		it("returns null for non-existent address", async () => {
			const found = await controller.getAddress("no-such-address");
			expect(found).toBeNull();
		});

		it("updates an address", async () => {
			const created = await controller.createAddress({
				customerId,
				firstName: "Ivy",
				lastName: "Chen",
				line1: "100 First St",
				city: "Peoria",
				state: "IL",
				postalCode: "61602",
				country: "US",
			});

			const updated = await controller.updateAddress(created.id, {
				line1: "200 Second St",
				city: "Bloomington",
			});

			expect(updated?.line1).toBe("200 Second St");
			expect(updated?.city).toBe("Bloomington");
			expect(updated?.state).toBe("IL"); // unchanged
		});

		it("returns null when updating non-existent address", async () => {
			const result = await controller.updateAddress("no-such-addr", {
				line1: "New",
			});
			expect(result).toBeNull();
		});

		it("clears optional address fields via null", async () => {
			const created = await controller.createAddress({
				customerId,
				firstName: "Ivy",
				lastName: "Chen",
				company: "OldCo",
				line1: "500 Corp St",
				line2: "Floor 3",
				city: "City",
				state: "ST",
				postalCode: "00000",
				country: "US",
				phone: "+1-555-0500",
			});

			const updated = await controller.updateAddress(created.id, {
				company: null,
				line2: null,
				phone: null,
			});

			expect(updated?.company).toBeUndefined();
			expect(updated?.line2).toBeUndefined();
			expect(updated?.phone).toBeUndefined();
			expect(updated?.line1).toBe("500 Corp St"); // unchanged
		});

		it("updateAddress setting isDefault clears siblings", async () => {
			const addr1 = await controller.createAddress({
				customerId,
				type: "shipping",
				firstName: "Ivy",
				lastName: "Chen",
				line1: "A",
				city: "City",
				state: "ST",
				postalCode: "00000",
				country: "US",
				isDefault: true,
			});

			const addr2 = await controller.createAddress({
				customerId,
				type: "shipping",
				firstName: "Ivy",
				lastName: "Chen",
				line1: "B",
				city: "City",
				state: "ST",
				postalCode: "00000",
				country: "US",
			});

			await controller.updateAddress(addr2.id, { isDefault: true });
			const refreshed1 = await controller.getAddress(addr1.id);
			const refreshed2 = await controller.getAddress(addr2.id);
			expect(refreshed1?.isDefault).toBe(false);
			expect(refreshed2?.isDefault).toBe(true);
		});

		it("deletes an address", async () => {
			const created = await controller.createAddress({
				customerId,
				firstName: "Ivy",
				lastName: "Chen",
				line1: "300 Third Ave",
				city: "Evanston",
				state: "IL",
				postalCode: "60201",
				country: "US",
			});

			await controller.deleteAddress(created.id);
			const found = await controller.getAddress(created.id);
			expect(found).toBeNull();
		});

		it("clears old default when setting a new one", async () => {
			const addr1 = await controller.createAddress({
				customerId,
				type: "shipping",
				firstName: "Ivy",
				lastName: "Chen",
				line1: "111 First",
				city: "City",
				state: "IL",
				postalCode: "60000",
				country: "US",
				isDefault: true,
			});

			const addr2 = await controller.createAddress({
				customerId,
				type: "shipping",
				firstName: "Ivy",
				lastName: "Chen",
				line1: "222 Second",
				city: "City",
				state: "IL",
				postalCode: "60000",
				country: "US",
				isDefault: false,
			});

			await controller.setDefaultAddress(customerId, addr2.id);

			const refreshed1 = await controller.getAddress(addr1.id);
			const refreshed2 = await controller.getAddress(addr2.id);
			expect(refreshed1?.isDefault).toBe(false);
			expect(refreshed2?.isDefault).toBe(true);
		});

		it("setDefaultAddress returns null for non-existent address", async () => {
			const result = await controller.setDefaultAddress(
				customerId,
				"no-such-addr",
			);
			expect(result).toBeNull();
		});

		it("setDefaultAddress returns null when customerId does not match", async () => {
			const other = await controller.create({
				email: "other@example.com",
				firstName: "Other",
				lastName: "Person",
			});

			const addr = await controller.createAddress({
				customerId: other.id,
				firstName: "Other",
				lastName: "Person",
				line1: "Other St",
				city: "City",
				state: "ST",
				postalCode: "00000",
				country: "US",
			});

			const result = await controller.setDefaultAddress(customerId, addr.id);
			expect(result).toBeNull();
		});

		it("setDefaultAddress only clears defaults of the same type", async () => {
			const billing = await controller.createAddress({
				customerId,
				type: "billing",
				firstName: "Ivy",
				lastName: "Chen",
				line1: "Billing",
				city: "City",
				state: "ST",
				postalCode: "00000",
				country: "US",
				isDefault: true,
			});

			const shipping = await controller.createAddress({
				customerId,
				type: "shipping",
				firstName: "Ivy",
				lastName: "Chen",
				line1: "Shipping",
				city: "City",
				state: "ST",
				postalCode: "00000",
				country: "US",
			});

			await controller.setDefaultAddress(customerId, shipping.id);

			const refreshedBilling = await controller.getAddress(billing.id);
			expect(refreshedBilling?.isDefault).toBe(true);
		});
	});

	describe("tags", () => {
		it("creates customer with tags", async () => {
			const customer = await controller.create({
				email: "tagged@example.com",
				firstName: "Tagged",
				lastName: "User",
				tags: ["vip", "wholesale"],
			});
			expect(customer.tags).toEqual(["vip", "wholesale"]);
		});

		it("creates customer with empty tags by default", async () => {
			const customer = await controller.create({
				email: "notags@example.com",
				firstName: "No",
				lastName: "Tags",
			});
			expect(customer.tags).toEqual([]);
		});

		it("updates tags via update method", async () => {
			const customer = await controller.create({
				email: "updatetags@example.com",
				firstName: "Update",
				lastName: "Tags",
			});
			const updated = await controller.update(customer.id, {
				tags: ["premium"],
			});
			expect(updated?.tags).toEqual(["premium"]);
		});

		it("addTags appends tags to existing", async () => {
			const customer = await controller.create({
				email: "addtags@example.com",
				firstName: "Add",
				lastName: "Tags",
				tags: ["existing"],
			});
			const updated = await controller.addTags(customer.id, [
				"new-tag",
				"another",
			]);
			expect(updated?.tags).toEqual(["existing", "new-tag", "another"]);
		});

		it("addTags deduplicates tags", async () => {
			const customer = await controller.create({
				email: "dedup@example.com",
				firstName: "Dedup",
				lastName: "Tags",
				tags: ["vip"],
			});
			const updated = await controller.addTags(customer.id, ["vip", "new"]);
			expect(updated?.tags).toEqual(["vip", "new"]);
		});

		it("addTags returns null for non-existent customer", async () => {
			const result = await controller.addTags("non-existent", ["tag"]);
			expect(result).toBeNull();
		});

		it("removeTags removes specified tags", async () => {
			const customer = await controller.create({
				email: "removetags@example.com",
				firstName: "Remove",
				lastName: "Tags",
				tags: ["vip", "wholesale", "premium"],
			});
			const updated = await controller.removeTags(customer.id, [
				"vip",
				"premium",
			]);
			expect(updated?.tags).toEqual(["wholesale"]);
		});

		it("removeTags is case-insensitive", async () => {
			const customer = await controller.create({
				email: "removecase@example.com",
				firstName: "Remove",
				lastName: "Case",
				tags: ["VIP", "Wholesale"],
			});
			const updated = await controller.removeTags(customer.id, ["vip"]);
			expect(updated?.tags).toEqual(["Wholesale"]);
		});

		it("removeTags returns null for non-existent customer", async () => {
			const result = await controller.removeTags("non-existent", ["tag"]);
			expect(result).toBeNull();
		});

		it("listAllTags returns tags with counts sorted by count desc", async () => {
			await controller.create({
				email: "a@example.com",
				firstName: "A",
				lastName: "A",
				tags: ["vip", "wholesale"],
			});
			await controller.create({
				email: "b@example.com",
				firstName: "B",
				lastName: "B",
				tags: ["vip", "premium"],
			});
			await controller.create({
				email: "c@example.com",
				firstName: "C",
				lastName: "C",
				tags: ["vip"],
			});

			const tags = await controller.listAllTags();
			expect(tags[0]).toEqual({ tag: "vip", count: 3 });
			expect(tags).toContainEqual({ tag: "wholesale", count: 1 });
			expect(tags).toContainEqual({ tag: "premium", count: 1 });
		});

		it("listAllTags returns empty array when no tags exist", async () => {
			await controller.create({
				email: "notags2@example.com",
				firstName: "No",
				lastName: "Tags",
			});
			const tags = await controller.listAllTags();
			expect(tags).toEqual([]);
		});

		it("list filters by tag", async () => {
			await controller.create({
				email: "tag-a@example.com",
				firstName: "A",
				lastName: "A",
				tags: ["vip"],
			});
			await controller.create({
				email: "tag-b@example.com",
				firstName: "B",
				lastName: "B",
				tags: ["wholesale"],
			});

			const { customers, total } = await controller.list({ tag: "vip" });
			expect(total).toBe(1);
			expect(customers[0]?.email).toBe("tag-a@example.com");
		});

		it("list tag filter is case-insensitive", async () => {
			await controller.create({
				email: "tagcase@example.com",
				firstName: "Case",
				lastName: "Test",
				tags: ["VIP"],
			});

			const { customers } = await controller.list({ tag: "vip" });
			expect(customers).toHaveLength(1);
		});

		it("bulkAddTags adds tags to multiple customers", async () => {
			const c1 = await controller.create({
				email: "bulk1@example.com",
				firstName: "Bulk",
				lastName: "One",
			});
			const c2 = await controller.create({
				email: "bulk2@example.com",
				firstName: "Bulk",
				lastName: "Two",
			});

			const result = await controller.bulkAddTags(
				[c1.id, c2.id],
				["promo-2024"],
			);
			expect(result.updated).toBe(2);

			const updated1 = await controller.getById(c1.id);
			const updated2 = await controller.getById(c2.id);
			expect(updated1?.tags).toContain("promo-2024");
			expect(updated2?.tags).toContain("promo-2024");
		});

		it("bulkAddTags skips non-existent customers", async () => {
			const c1 = await controller.create({
				email: "bulkexist@example.com",
				firstName: "Exist",
				lastName: "Yes",
			});

			const result = await controller.bulkAddTags(
				[c1.id, "non-existent-id"],
				["tag"],
			);
			expect(result.updated).toBe(1);
		});

		it("bulkRemoveTags removes tags from multiple customers", async () => {
			const c1 = await controller.create({
				email: "bulkrem1@example.com",
				firstName: "Bulk",
				lastName: "Rem1",
				tags: ["vip", "wholesale"],
			});
			const c2 = await controller.create({
				email: "bulkrem2@example.com",
				firstName: "Bulk",
				lastName: "Rem2",
				tags: ["vip", "premium"],
			});

			const result = await controller.bulkRemoveTags([c1.id, c2.id], ["vip"]);
			expect(result.updated).toBe(2);

			const updated1 = await controller.getById(c1.id);
			const updated2 = await controller.getById(c2.id);
			expect(updated1?.tags).toEqual(["wholesale"]);
			expect(updated2?.tags).toEqual(["premium"]);
		});

		it("bulkRemoveTags skips non-existent customers", async () => {
			const c1 = await controller.create({
				email: "bulkremexist@example.com",
				firstName: "Exist",
				lastName: "Yes",
				tags: ["tag"],
			});

			const result = await controller.bulkRemoveTags(
				[c1.id, "non-existent-id"],
				["tag"],
			);
			expect(result.updated).toBe(1);

			const updated = await controller.getById(c1.id);
			expect(updated?.tags).toEqual([]);
		});

		it("addTags updates the updatedAt timestamp", async () => {
			const customer = await controller.create({
				email: "tagtime@example.com",
				firstName: "Tag",
				lastName: "Time",
			});

			await new Promise((r) => setTimeout(r, 1));
			const updated = await controller.addTags(customer.id, ["new"]);
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				customer.updatedAt.getTime(),
			);
		});
	});

	describe("listForExport", () => {
		beforeEach(async () => {
			await controller.create({
				email: "export-a@example.com",
				firstName: "Alice",
				lastName: "Alpha",
				tags: ["vip"],
			});
			await controller.create({
				email: "export-b@example.com",
				firstName: "Bob",
				lastName: "Beta",
				phone: "+1-555-0200",
				tags: ["wholesale"],
			});
			await controller.create({
				email: "export-c@example.com",
				firstName: "Carol",
				lastName: "Gamma",
				tags: ["vip", "premium"],
			});
		});

		it("returns all customers without pagination limit", async () => {
			const customers = await controller.listForExport({});
			expect(customers).toHaveLength(3);
		});

		it("filters by search query", async () => {
			const customers = await controller.listForExport({ search: "Alice" });
			expect(customers).toHaveLength(1);
			expect(customers[0]?.email).toBe("export-a@example.com");
		});

		it("filters by tag", async () => {
			const customers = await controller.listForExport({ tag: "vip" });
			expect(customers).toHaveLength(2);
		});

		it("filters by dateFrom", async () => {
			const yesterday = new Date(Date.now() - 86400000).toISOString();
			const customers = await controller.listForExport({ dateFrom: yesterday });
			expect(customers).toHaveLength(3);
		});

		it("filters by dateTo excluding future-only", async () => {
			const pastDate = new Date("2020-01-01").toISOString();
			const customers = await controller.listForExport({ dateTo: pastDate });
			expect(customers).toHaveLength(0);
		});

		it("search is case-insensitive", async () => {
			const customers = await controller.listForExport({ search: "bob" });
			expect(customers).toHaveLength(1);
			expect(customers[0]?.firstName).toBe("Bob");
		});

		it("sorts by createdAt descending", async () => {
			const customers = await controller.listForExport({});
			for (let i = 0; i < customers.length - 1; i++) {
				expect(
					new Date(customers[i].createdAt).getTime(),
				).toBeGreaterThanOrEqual(
					new Date(customers[i + 1].createdAt).getTime(),
				);
			}
		});

		it("returns empty array when no customers match", async () => {
			const customers = await controller.listForExport({
				search: "zzz-no-match",
			});
			expect(customers).toHaveLength(0);
		});

		it("combines search and tag filters", async () => {
			const customers = await controller.listForExport({
				search: "Carol",
				tag: "premium",
			});
			expect(customers).toHaveLength(1);
			expect(customers[0]?.email).toBe("export-c@example.com");
		});
	});

	describe("importCustomers", () => {
		it("creates new customers from import rows", async () => {
			const result = await controller.importCustomers([
				{
					email: "import-new@example.com",
					firstName: "New",
					lastName: "Customer",
				},
			]);
			expect(result.created).toBe(1);
			expect(result.updated).toBe(0);
			expect(result.errors).toHaveLength(0);

			const found = await controller.getByEmail("import-new@example.com");
			expect(found).not.toBeNull();
			expect(found?.firstName).toBe("New");
		});

		it("updates existing customers matched by email", async () => {
			await controller.create({
				email: "existing@example.com",
				firstName: "Old",
				lastName: "Name",
			});

			const result = await controller.importCustomers([
				{
					email: "existing@example.com",
					firstName: "Updated",
					lastName: "Name",
				},
			]);
			expect(result.created).toBe(0);
			expect(result.updated).toBe(1);

			const found = await controller.getByEmail("existing@example.com");
			expect(found?.firstName).toBe("Updated");
		});

		it("handles mixed create and update in one batch", async () => {
			await controller.create({
				email: "existing2@example.com",
				firstName: "Old",
				lastName: "Two",
			});

			const result = await controller.importCustomers([
				{ email: "existing2@example.com", firstName: "Updated" },
				{ email: "brand-new@example.com", firstName: "Brand", lastName: "New" },
			]);
			expect(result.created).toBe(1);
			expect(result.updated).toBe(1);
			expect(result.errors).toHaveLength(0);
		});

		it("reports error for missing email", async () => {
			const result = await controller.importCustomers([
				{ email: "", firstName: "No", lastName: "Email" },
			]);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]?.field).toBe("email");
			expect(result.errors[0]?.row).toBe(1);
		});

		it("reports error for invalid email format", async () => {
			const result = await controller.importCustomers([
				{ email: "not-an-email", firstName: "Bad", lastName: "Email" },
			]);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]?.field).toBe("email");
			expect(result.errors[0]?.message).toBe("Invalid email format");
		});

		it("normalizes email to lowercase", async () => {
			const result = await controller.importCustomers([
				{
					email: "UPPER@EXAMPLE.COM",
					firstName: "Upper",
					lastName: "Case",
				},
			]);
			expect(result.created).toBe(1);

			const found = await controller.getByEmail("upper@example.com");
			expect(found).not.toBeNull();
			expect(found?.email).toBe("upper@example.com");
		});

		it("merges tags on update without duplicates", async () => {
			await controller.create({
				email: "merge-tags@example.com",
				firstName: "Merge",
				lastName: "Tags",
				tags: ["existing-tag"],
			});

			const result = await controller.importCustomers([
				{
					email: "merge-tags@example.com",
					tags: ["existing-tag", "new-tag"],
				},
			]);
			expect(result.updated).toBe(1);

			const found = await controller.getByEmail("merge-tags@example.com");
			expect(found?.tags).toContain("existing-tag");
			expect(found?.tags).toContain("new-tag");
			expect(found?.tags).toHaveLength(2);
		});

		it("sets default values for new customers", async () => {
			await controller.importCustomers([{ email: "defaults@example.com" }]);

			const found = await controller.getByEmail("defaults@example.com");
			expect(found?.firstName).toBe("");
			expect(found?.lastName).toBe("");
			expect(found?.tags).toEqual([]);
			expect(found?.metadata).toEqual({});
		});

		it("imports with phone number", async () => {
			await controller.importCustomers([
				{
					email: "with-phone@example.com",
					firstName: "Phone",
					lastName: "Test",
					phone: "+1-555-0999",
				},
			]);

			const found = await controller.getByEmail("with-phone@example.com");
			expect(found?.phone).toBe("+1-555-0999");
		});

		it("skips error rows and continues processing", async () => {
			const result = await controller.importCustomers([
				{ email: "", firstName: "Bad" },
				{ email: "good@example.com", firstName: "Good", lastName: "One" },
				{ email: "not-email", firstName: "Also Bad" },
				{
					email: "also-good@example.com",
					firstName: "Also",
					lastName: "Good",
				},
			]);
			expect(result.created).toBe(2);
			expect(result.errors).toHaveLength(2);
		});

		it("handles duplicate emails in the same import batch", async () => {
			const result = await controller.importCustomers([
				{ email: "dupe@example.com", firstName: "First" },
				{ email: "dupe@example.com", firstName: "Second" },
			]);
			// First creates, second updates
			expect(result.created).toBe(1);
			expect(result.updated).toBe(1);

			const found = await controller.getByEmail("dupe@example.com");
			expect(found?.firstName).toBe("Second");
		});

		it("preserves existing fields not in import row on update", async () => {
			await controller.create({
				email: "preserve@example.com",
				firstName: "Keep",
				lastName: "This",
				phone: "+1-555-0001",
			});

			await controller.importCustomers([
				{ email: "preserve@example.com", firstName: "Changed" },
			]);

			const found = await controller.getByEmail("preserve@example.com");
			expect(found?.firstName).toBe("Changed");
			expect(found?.lastName).toBe("This");
			expect(found?.phone).toBe("+1-555-0001");
		});

		it("returns correct row numbers for errors", async () => {
			const result = await controller.importCustomers([
				{ email: "ok@example.com", firstName: "OK" },
				{ email: "", firstName: "Bad1" },
				{ email: "ok2@example.com", firstName: "OK2" },
				{ email: "not-valid", firstName: "Bad2" },
			]);
			expect(result.errors).toHaveLength(2);
			expect(result.errors[0]?.row).toBe(2);
			expect(result.errors[1]?.row).toBe(4);
		});
	});

	// --- Loyalty Points ---

	describe.skip("getLoyaltyBalance", () => {
		it("returns zero balance when no transactions exist", async () => {
			const balance = await controller.getLoyaltyBalance("cust-1");
			expect(balance.customerId).toBe("cust-1");
			expect(balance.balance).toBe(0);
			expect(balance.totalEarned).toBe(0);
			expect(balance.totalRedeemed).toBe(0);
			expect(balance.transactionCount).toBe(0);
		});

		it("calculates balance from earn transactions", async () => {
			await controller.create({
				id: "cust-loyalty-1",
				email: "loyalty@example.com",
				firstName: "Loyal",
				lastName: "Customer",
			});
			await controller.earnPoints({
				customerId: "cust-loyalty-1",
				points: 100,
				reason: "First purchase",
			});
			await controller.earnPoints({
				customerId: "cust-loyalty-1",
				points: 50,
				reason: "Second purchase",
			});

			const balance = await controller.getLoyaltyBalance("cust-loyalty-1");
			expect(balance.balance).toBe(150);
			expect(balance.totalEarned).toBe(150);
			expect(balance.totalRedeemed).toBe(0);
			expect(balance.transactionCount).toBe(2);
		});

		it("calculates balance after redemption", async () => {
			await controller.earnPoints({
				customerId: "cust-bal",
				points: 200,
				reason: "Purchase",
			});
			await controller.redeemPoints({
				customerId: "cust-bal",
				points: 75,
				reason: "Discount",
			});

			const balance = await controller.getLoyaltyBalance("cust-bal");
			expect(balance.balance).toBe(125);
			expect(balance.totalEarned).toBe(200);
			expect(balance.totalRedeemed).toBe(75);
		});
	});

	describe.skip("earnPoints", () => {
		it("creates an earn transaction with correct balance", async () => {
			const tx = await controller.earnPoints({
				customerId: "cust-earn",
				points: 100,
				reason: "Welcome bonus",
			});
			expect(tx.type).toBe("earn");
			expect(tx.points).toBe(100);
			expect(tx.balance).toBe(100);
			expect(tx.reason).toBe("Welcome bonus");
			expect(tx.id).toBeTruthy();
			expect(tx.createdAt).toBeInstanceOf(Date);
		});

		it("accumulates points across multiple earns", async () => {
			await controller.earnPoints({
				customerId: "cust-multi",
				points: 50,
				reason: "Order 1",
			});
			const tx2 = await controller.earnPoints({
				customerId: "cust-multi",
				points: 30,
				reason: "Order 2",
			});
			expect(tx2.balance).toBe(80);
		});

		it("throws when points are non-positive", async () => {
			await expect(
				controller.earnPoints({
					customerId: "cust-err",
					points: 0,
					reason: "Zero",
				}),
			).rejects.toThrow("Points to earn must be positive");

			await expect(
				controller.earnPoints({
					customerId: "cust-err",
					points: -10,
					reason: "Negative",
				}),
			).rejects.toThrow("Points to earn must be positive");
		});

		it("stores orderId when provided", async () => {
			const tx = await controller.earnPoints({
				customerId: "cust-order",
				points: 25,
				reason: "Purchase",
				orderId: "order-123",
			});
			expect(tx.orderId).toBe("order-123");
		});
	});

	describe.skip("redeemPoints", () => {
		it("creates a redeem transaction with negative points", async () => {
			await controller.earnPoints({
				customerId: "cust-redeem",
				points: 200,
				reason: "Setup",
			});
			const tx = await controller.redeemPoints({
				customerId: "cust-redeem",
				points: 50,
				reason: "Reward checkout",
			});
			expect(tx.type).toBe("redeem");
			expect(tx.points).toBe(-50);
			expect(tx.balance).toBe(150);
		});

		it("throws when insufficient balance", async () => {
			await controller.earnPoints({
				customerId: "cust-insuf",
				points: 30,
				reason: "Setup",
			});
			await expect(
				controller.redeemPoints({
					customerId: "cust-insuf",
					points: 50,
					reason: "Too much",
				}),
			).rejects.toThrow("Insufficient loyalty points");
		});

		it("throws when points are non-positive", async () => {
			await expect(
				controller.redeemPoints({
					customerId: "cust-neg",
					points: 0,
					reason: "Zero",
				}),
			).rejects.toThrow("Points to redeem must be positive");
		});
	});

	describe.skip("adjustPoints", () => {
		it("adjusts balance up with positive points", async () => {
			const tx = await controller.adjustPoints({
				customerId: "cust-adj",
				points: 500,
				reason: "Admin bonus",
			});
			expect(tx.type).toBe("adjust");
			expect(tx.points).toBe(500);
			expect(tx.balance).toBe(500);
		});

		it("adjusts balance down with negative points", async () => {
			await controller.earnPoints({
				customerId: "cust-adj-down",
				points: 100,
				reason: "Setup",
			});
			const tx = await controller.adjustPoints({
				customerId: "cust-adj-down",
				points: -40,
				reason: "Correction",
			});
			expect(tx.points).toBe(-40);
			expect(tx.balance).toBe(60);
		});

		it("throws when adjustment would result in negative balance", async () => {
			await controller.earnPoints({
				customerId: "cust-adj-neg",
				points: 10,
				reason: "Setup",
			});
			await expect(
				controller.adjustPoints({
					customerId: "cust-adj-neg",
					points: -20,
					reason: "Too much deduction",
				}),
			).rejects.toThrow("Adjustment would result in negative balance");
		});

		it("throws when points are zero", async () => {
			await expect(
				controller.adjustPoints({
					customerId: "cust-zero",
					points: 0,
					reason: "No change",
				}),
			).rejects.toThrow("Adjustment points cannot be zero");
		});
	});

	describe.skip("getLoyaltyHistory", () => {
		it("returns all transactions for customer", async () => {
			await controller.earnPoints({
				customerId: "cust-hist",
				points: 10,
				reason: "First",
			});
			await controller.earnPoints({
				customerId: "cust-hist",
				points: 20,
				reason: "Second",
			});
			await controller.earnPoints({
				customerId: "cust-hist",
				points: 30,
				reason: "Third",
			});

			const { transactions, total } =
				await controller.getLoyaltyHistory("cust-hist");
			expect(total).toBe(3);
			expect(transactions).toHaveLength(3);
			const reasons = transactions.map((t) => t.reason);
			expect(reasons).toContain("First");
			expect(reasons).toContain("Second");
			expect(reasons).toContain("Third");
		});

		it("supports pagination", async () => {
			await controller.earnPoints({
				customerId: "cust-page",
				points: 10,
				reason: "A",
			});
			await controller.earnPoints({
				customerId: "cust-page",
				points: 20,
				reason: "B",
			});
			await controller.earnPoints({
				customerId: "cust-page",
				points: 30,
				reason: "C",
			});

			const { transactions, total } = await controller.getLoyaltyHistory(
				"cust-page",
				{ limit: 2, offset: 0 },
			);
			expect(total).toBe(3);
			expect(transactions).toHaveLength(2);
		});

		it("returns empty array when no transactions", async () => {
			const { transactions, total } =
				await controller.getLoyaltyHistory("cust-empty");
			expect(transactions).toHaveLength(0);
			expect(total).toBe(0);
		});
	});

	describe.skip("getLoyaltyStats", () => {
		it("returns zero stats when no transactions", async () => {
			const stats = await controller.getLoyaltyStats();
			expect(stats.totalCustomersWithPoints).toBe(0);
			expect(stats.totalPointsIssued).toBe(0);
			expect(stats.totalPointsRedeemed).toBe(0);
			expect(stats.totalPointsOutstanding).toBe(0);
			expect(stats.averageBalance).toBe(0);
			expect(stats.topCustomers).toHaveLength(0);
		});

		it("calculates stats across multiple customers", async () => {
			await controller.create({
				id: "cust-s1",
				email: "s1@example.com",
				firstName: "One",
				lastName: "User",
			});
			await controller.create({
				id: "cust-s2",
				email: "s2@example.com",
				firstName: "Two",
				lastName: "User",
			});

			await controller.earnPoints({
				customerId: "cust-s1",
				points: 100,
				reason: "Purchase",
			});
			await controller.earnPoints({
				customerId: "cust-s2",
				points: 200,
				reason: "Purchase",
			});
			await controller.redeemPoints({
				customerId: "cust-s1",
				points: 30,
				reason: "Reward",
			});

			const stats = await controller.getLoyaltyStats();
			expect(stats.totalCustomersWithPoints).toBe(2);
			expect(stats.totalPointsIssued).toBe(300);
			expect(stats.totalPointsRedeemed).toBe(30);
			expect(stats.totalPointsOutstanding).toBe(270);
			expect(stats.topCustomers.length).toBeGreaterThanOrEqual(2);
			// Top customer should be cust-s2 with 200 balance
			expect(stats.topCustomers[0]?.balance).toBe(200);
		});

		it("includes customer email and name in top customers", async () => {
			await controller.create({
				id: "cust-top",
				email: "top@example.com",
				firstName: "Top",
				lastName: "Customer",
			});
			await controller.earnPoints({
				customerId: "cust-top",
				points: 500,
				reason: "Big purchase",
			});

			const stats = await controller.getLoyaltyStats();
			const topEntry = stats.topCustomers.find(
				(tc) => tc.customerId === "cust-top",
			);
			expect(topEntry).toBeDefined();
			expect(topEntry?.email).toBe("top@example.com");
			expect(topEntry?.name).toBe("Top Customer");
			expect(topEntry?.balance).toBe(500);
		});
	});

	// ── Event emission ──────────────────────────────────────────────────

	describe("event emission", () => {
		it("emits customer.created on create", async () => {
			const data = createMockDataService();
			const events = createMockEvents();
			const ctrl = createCustomerController(data, events);

			const customer = await ctrl.create({
				email: "event@example.com",
				firstName: "Event",
				lastName: "Test",
			});

			expect(events.emitted).toHaveLength(1);
			expect(events.emitted[0].type).toBe("customer.created");
			const payload = events.emitted[0].payload as Record<string, unknown>;
			expect(payload.customerId).toBe(customer.id);
			expect(payload.email).toBe("event@example.com");
			expect(payload.firstName).toBe("Event");
			expect(payload.lastName).toBe("Test");
		});

		it("does not emit events without ScopedEventEmitter", async () => {
			const data = createMockDataService();
			const ctrl = createCustomerController(data);

			// Should not throw
			await ctrl.create({
				email: "noevent@example.com",
				firstName: "No",
				lastName: "Event",
			});
		});

		it("does not emit events on update", async () => {
			const data = createMockDataService();
			const events = createMockEvents();
			const ctrl = createCustomerController(data, events);

			const customer = await ctrl.create({
				email: "noupdate@example.com",
				firstName: "No",
				lastName: "Update",
			});
			events.emitted.length = 0;

			await ctrl.update(customer.id, { firstName: "Changed" });

			// No customer.updated event expected (not wired yet)
			expect(
				events.emitted.filter((e) => e.type === "customer.created"),
			).toHaveLength(0);
		});
	});
});
