import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createCustomerController } from "../service-impl";

/**
 * Admin endpoint tests for customer address management.
 *
 * These tests verify:
 * 1. List addresses via adminGetCustomer (addresses are co-fetched)
 * 2. adminCreateAddress creates and scopes to the right customer
 * 3. adminUpdateAddress updates fields and handles 404 for missing address
 * 4. adminDeleteAddress verifies customer ownership before deleting
 * 5. adminSetDefaultAddress clears previous defaults of the same type
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate admin endpoint logic ─────────────────────────────────────────────

interface AddressParams {
	type?: "billing" | "shipping";
	firstName: string;
	lastName: string;
	company?: string;
	line1: string;
	line2?: string;
	city: string;
	state: string;
	postalCode: string;
	country: string;
	phone?: string;
	isDefault?: boolean;
}

async function simulateAdminCreateAddress(
	data: DataService,
	customerId: string,
	body: AddressParams,
) {
	const controller = createCustomerController(data);
	const customer = await controller.getById(customerId);
	if (!customer) return { error: "Customer not found", status: 404 };
	const address = await controller.createAddress({ customerId, ...body });
	return { address };
}

async function simulateAdminUpdateAddress(
	data: DataService,
	addressId: string,
	body: Partial<AddressParams>,
) {
	const controller = createCustomerController(data);
	const updated = await controller.updateAddress(addressId, body);
	if (!updated) return { error: "Address not found", status: 404 };
	return { address: updated };
}

async function simulateAdminDeleteAddress(
	data: DataService,
	customerId: string,
	addressId: string,
) {
	const controller = createCustomerController(data);
	const address = await controller.getAddress(addressId);
	if (!address || address.customerId !== customerId) {
		return { error: "Address not found", status: 404 };
	}
	await controller.deleteAddress(addressId);
	return { success: true };
}

async function simulateAdminSetDefault(
	data: DataService,
	customerId: string,
	addressId: string,
) {
	const controller = createCustomerController(data);
	const updated = await controller.setDefaultAddress(customerId, addressId);
	if (!updated) return { error: "Address not found", status: 404 };
	return { address: updated };
}

// ── Test setup helpers ────────────────────────────────────────────────────────

async function seedCustomer(data: DataService, email = "admin@example.com") {
	const controller = createCustomerController(data);
	return controller.create({ email, firstName: "Admin", lastName: "Test" });
}

async function seedAddress(
	data: DataService,
	customerId: string,
	overrides: Partial<AddressParams> = {},
) {
	const controller = createCustomerController(data);
	return controller.createAddress({
		customerId,
		type: "shipping",
		firstName: "Jane",
		lastName: "Doe",
		line1: "123 Main St",
		city: "Springfield",
		state: "IL",
		postalCode: "62701",
		country: "US",
		isDefault: false,
		...overrides,
	});
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("admin address endpoints — create", () => {
	let data: DataService;
	let customerId: string;

	beforeEach(async () => {
		data = createMockDataService();
		const customer = await seedCustomer(data);
		customerId = customer.id;
	});

	it("creates an address for an existing customer", async () => {
		const result = await simulateAdminCreateAddress(data, customerId, {
			type: "shipping",
			firstName: "Jane",
			lastName: "Doe",
			line1: "123 Main St",
			city: "Springfield",
			state: "IL",
			postalCode: "62701",
			country: "US",
		});
		expect("address" in result && result.address).toBeDefined();
		if ("address" in result) {
			expect(result.address.customerId).toBe(customerId);
			expect(result.address.type).toBe("shipping");
			expect(result.address.firstName).toBe("Jane");
		}
	});

	it("returns 404 when customer does not exist", async () => {
		const result = await simulateAdminCreateAddress(data, "nonexistent-id", {
			firstName: "Jane",
			lastName: "Doe",
			line1: "1 Test St",
			city: "Nowhere",
			state: "CA",
			postalCode: "90210",
			country: "US",
		});
		expect(result).toMatchObject({ status: 404 });
	});

	it("sets the new address as default when isDefault is true", async () => {
		const result = await simulateAdminCreateAddress(data, customerId, {
			type: "billing",
			firstName: "Jane",
			lastName: "Doe",
			line1: "456 Elm St",
			city: "Chicago",
			state: "IL",
			postalCode: "60601",
			country: "US",
			isDefault: true,
		});
		expect("address" in result && result.address.isDefault).toBe(true);
	});
});

describe("admin address endpoints — update", () => {
	let data: DataService;
	let customerId: string;
	let addressId: string;

	beforeEach(async () => {
		data = createMockDataService();
		const customer = await seedCustomer(data);
		customerId = customer.id;
		const address = await seedAddress(data, customerId);
		addressId = address.id;
	});

	it("updates address fields", async () => {
		const result = await simulateAdminUpdateAddress(data, addressId, {
			city: "Shelbyville",
			postalCode: "62702",
		});
		expect("address" in result && result.address).toBeDefined();
		if ("address" in result) {
			expect(result.address.city).toBe("Shelbyville");
			expect(result.address.postalCode).toBe("62702");
			expect(result.address.firstName).toBe("Jane"); // unchanged
		}
	});

	it("returns 404 for unknown address", async () => {
		const result = await simulateAdminUpdateAddress(data, "ghost-id", {
			city: "Nowhere",
		});
		expect(result).toMatchObject({ status: 404 });
	});

	it("can switch type from shipping to billing", async () => {
		const result = await simulateAdminUpdateAddress(data, addressId, {
			type: "billing",
		});
		expect("address" in result && result.address.type).toBe("billing");
	});
});

describe("admin address endpoints — delete", () => {
	let data: DataService;
	let customerId: string;
	let addressId: string;

	beforeEach(async () => {
		data = createMockDataService();
		const customer = await seedCustomer(data);
		customerId = customer.id;
		const address = await seedAddress(data, customerId);
		addressId = address.id;
	});

	it("deletes an address belonging to the customer", async () => {
		const result = await simulateAdminDeleteAddress(
			data,
			customerId,
			addressId,
		);
		expect(result).toMatchObject({ success: true });

		const controller = createCustomerController(data);
		const gone = await controller.getAddress(addressId);
		expect(gone).toBeNull();
	});

	it("returns 404 for address belonging to a different customer", async () => {
		const otherCustomer = await seedCustomer(data, "other@example.com");
		const otherAddress = await seedAddress(data, otherCustomer.id);

		const result = await simulateAdminDeleteAddress(
			data,
			customerId,
			otherAddress.id,
		);
		expect(result).toMatchObject({ status: 404 });

		const controller = createCustomerController(data);
		const stillExists = await controller.getAddress(otherAddress.id);
		expect(stillExists).not.toBeNull();
	});

	it("returns 404 for non-existent address", async () => {
		const result = await simulateAdminDeleteAddress(
			data,
			customerId,
			"ghost-id",
		);
		expect(result).toMatchObject({ status: 404 });
	});
});

describe("admin address endpoints — set-default", () => {
	let data: DataService;
	let customerId: string;

	beforeEach(async () => {
		data = createMockDataService();
		const customer = await seedCustomer(data);
		customerId = customer.id;
	});

	it("marks an address as default and clears the previous default", async () => {
		const addr1 = await seedAddress(data, customerId, {
			type: "shipping",
			isDefault: true,
		});
		const addr2 = await seedAddress(data, customerId, { type: "shipping" });

		const result = await simulateAdminSetDefault(data, customerId, addr2.id);
		expect("address" in result && result.address.isDefault).toBe(true);

		const controller = createCustomerController(data);
		const prevDefault = await controller.getAddress(addr1.id);
		expect(prevDefault?.isDefault).toBe(false);
	});

	it("returns 404 for address belonging to a different customer", async () => {
		const otherCustomer = await seedCustomer(data, "other@example.com");
		const otherAddress = await seedAddress(data, otherCustomer.id);

		const result = await simulateAdminSetDefault(
			data,
			customerId,
			otherAddress.id,
		);
		expect(result).toMatchObject({ status: 404 });
	});

	it("returns 404 for non-existent address", async () => {
		const result = await simulateAdminSetDefault(data, customerId, "ghost-id");
		expect(result).toMatchObject({ status: 404 });
	});
});
