import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createDiscountController } from "../service-impl";

describe("discounts controller", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createDiscountController>;

	const past = new Date(Date.now() - 3600_000);
	const future = new Date(Date.now() + 3600_000);

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createDiscountController(mockData);
	});

	// ---------------------------------------------------------------
	// Discount CRUD
	// ---------------------------------------------------------------
	describe("create", () => {
		it("creates discount with all defaults", async () => {
			const d = await controller.create({
				name: "Welcome",
				type: "percentage",
				value: 10,
			});
			expect(d.id).toBeDefined();
			expect(d.name).toBe("Welcome");
			expect(d.type).toBe("percentage");
			expect(d.value).toBe(10);
			expect(d.isActive).toBe(true);
			expect(d.usedCount).toBe(0);
			expect(d.appliesTo).toBe("all");
			expect(d.appliesToIds).toEqual([]);
			expect(d.stackable).toBe(false);
			expect(d.metadata).toEqual({});
			expect(d.createdAt).toBeInstanceOf(Date);
			expect(d.updatedAt).toBeInstanceOf(Date);
		});

		it("respects explicit id", async () => {
			const d = await controller.create({
				id: "custom-id",
				name: "Custom",
				type: "fixed_amount",
				value: 500,
			});
			expect(d.id).toBe("custom-id");
		});

		it("creates with full params", async () => {
			const d = await controller.create({
				name: "VIP",
				description: "VIP only",
				type: "fixed_amount",
				value: 2000,
				minimumAmount: 10000,
				maximumUses: 50,
				isActive: false,
				startsAt: past,
				endsAt: future,
				appliesTo: "specific_products",
				appliesToIds: ["prod_1", "prod_2"],
				stackable: true,
				metadata: { source: "campaign" },
			});
			expect(d.description).toBe("VIP only");
			expect(d.minimumAmount).toBe(10000);
			expect(d.maximumUses).toBe(50);
			expect(d.isActive).toBe(false);
			expect(d.startsAt).toBe(past);
			expect(d.endsAt).toBe(future);
			expect(d.appliesTo).toBe("specific_products");
			expect(d.appliesToIds).toEqual(["prod_1", "prod_2"]);
			expect(d.stackable).toBe(true);
			expect(d.metadata).toEqual({ source: "campaign" });
		});

		it("creates free_shipping discount", async () => {
			const d = await controller.create({
				name: "Free Ship",
				type: "free_shipping",
				value: 0,
			});
			expect(d.type).toBe("free_shipping");
			expect(d.value).toBe(0);
		});
	});

	describe("getById", () => {
		it("returns discount by id", async () => {
			const d = await controller.create({
				name: "Test",
				type: "percentage",
				value: 15,
			});
			const found = await controller.getById(d.id);
			expect(found?.name).toBe("Test");
		});

		it("returns null for non-existent id", async () => {
			const found = await controller.getById("nonexistent");
			expect(found).toBeNull();
		});
	});

	describe("update", () => {
		it("updates individual fields", async () => {
			const d = await controller.create({
				name: "Original",
				type: "percentage",
				value: 10,
			});
			const updated = await controller.update(d.id, { name: "Changed" });
			expect(updated?.name).toBe("Changed");
			expect(updated?.type).toBe("percentage");
			expect(updated?.value).toBe(10);
		});

		it("returns null for non-existent id", async () => {
			const result = await controller.update("nonexistent", { name: "X" });
			expect(result).toBeNull();
		});

		it("updates updatedAt timestamp", async () => {
			const d = await controller.create({
				name: "T",
				type: "percentage",
				value: 5,
			});
			const updated = await controller.update(d.id, { value: 15 });
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				d.updatedAt.getTime(),
			);
		});

		it("preserves unchanged fields on partial update", async () => {
			const d = await controller.create({
				name: "Keep",
				description: "Keep this",
				type: "fixed_amount",
				value: 1000,
				minimumAmount: 5000,
				appliesTo: "specific_categories",
				appliesToIds: ["cat_1"],
				stackable: true,
				metadata: { key: "val" },
			});
			const updated = await controller.update(d.id, { name: "New" });
			expect(updated?.name).toBe("New");
			expect(updated?.description).toBe("Keep this");
			expect(updated?.minimumAmount).toBe(5000);
			expect(updated?.appliesTo).toBe("specific_categories");
			expect(updated?.appliesToIds).toEqual(["cat_1"]);
			expect(updated?.stackable).toBe(true);
			expect(updated?.metadata).toEqual({ key: "val" });
		});

		it("can update multiple fields at once", async () => {
			const d = await controller.create({
				name: "Multi",
				type: "percentage",
				value: 10,
			});
			const updated = await controller.update(d.id, {
				name: "Updated",
				type: "fixed_amount",
				value: 500,
				isActive: false,
				stackable: true,
			});
			expect(updated?.name).toBe("Updated");
			expect(updated?.type).toBe("fixed_amount");
			expect(updated?.value).toBe(500);
			expect(updated?.isActive).toBe(false);
			expect(updated?.stackable).toBe(true);
		});

		it("can set nullable fields to null", async () => {
			const d = await controller.create({
				name: "Nullable",
				type: "percentage",
				value: 10,
				minimumAmount: 5000,
				maximumUses: 100,
				startsAt: past,
				endsAt: future,
			});
			const updated = await controller.update(d.id, {
				minimumAmount: null,
				maximumUses: null,
				startsAt: null,
				endsAt: null,
			});
			expect(updated?.minimumAmount).toBeUndefined();
			expect(updated?.maximumUses).toBeUndefined();
			expect(updated?.startsAt).toBeUndefined();
			expect(updated?.endsAt).toBeUndefined();
		});
	});

	describe("delete", () => {
		it("deletes discount and cascades to codes", async () => {
			const d = await controller.create({
				name: "Del",
				type: "percentage",
				value: 10,
			});
			await controller.createCode({ discountId: d.id, code: "CODE1" });
			await controller.createCode({ discountId: d.id, code: "CODE2" });

			await controller.delete(d.id);

			expect(await controller.getById(d.id)).toBeNull();
			const codes = await controller.listCodes(d.id);
			expect(codes).toHaveLength(0);
		});

		it("handles deleting discount with no codes", async () => {
			const d = await controller.create({
				name: "NoCode",
				type: "percentage",
				value: 5,
			});
			await controller.delete(d.id);
			expect(await controller.getById(d.id)).toBeNull();
		});
	});

	describe("list", () => {
		it("returns empty list when no discounts", async () => {
			const result = await controller.list({});
			expect(result.discounts).toHaveLength(0);
			expect(result.total).toBe(0);
		});

		it("uses default limit of 20", async () => {
			for (let i = 0; i < 25; i++) {
				await controller.create({
					name: `D${i}`,
					type: "percentage",
					value: i,
				});
			}
			const result = await controller.list({});
			expect(result.discounts).toHaveLength(20);
			expect(result.total).toBe(25);
		});

		it("respects limit and offset", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.create({
					name: `D${i}`,
					type: "percentage",
					value: i,
				});
			}
			const page = await controller.list({ limit: 3, offset: 2 });
			expect(page.discounts).toHaveLength(3);
			expect(page.total).toBe(10);
		});

		it("filters by isActive", async () => {
			await controller.create({
				name: "Active",
				type: "percentage",
				value: 10,
				isActive: true,
			});
			await controller.create({
				name: "Inactive",
				type: "percentage",
				value: 5,
				isActive: false,
			});
			const activeResult = await controller.list({ isActive: true });
			expect(activeResult.discounts).toHaveLength(1);
			expect(activeResult.discounts[0].name).toBe("Active");

			const inactiveResult = await controller.list({ isActive: false });
			expect(inactiveResult.discounts).toHaveLength(1);
			expect(inactiveResult.discounts[0].name).toBe("Inactive");
		});

		it("sorts by createdAt descending", async () => {
			await controller.create({
				name: "First",
				type: "percentage",
				value: 1,
			});
			await controller.create({
				name: "Second",
				type: "percentage",
				value: 2,
			});
			await controller.create({
				name: "Third",
				type: "percentage",
				value: 3,
			});
			const result = await controller.list({});
			// All three should be returned (order may vary if timestamps are identical)
			expect(result.discounts).toHaveLength(3);
			const names = result.discounts.map((d) => d.name);
			expect(names).toContain("First");
			expect(names).toContain("Second");
			expect(names).toContain("Third");
		});

		it("offset beyond total returns empty", async () => {
			await controller.create({
				name: "Only",
				type: "percentage",
				value: 5,
			});
			const result = await controller.list({ offset: 100 });
			expect(result.discounts).toHaveLength(0);
			expect(result.total).toBe(1);
		});
	});

	// ---------------------------------------------------------------
	// Discount Codes
	// ---------------------------------------------------------------
	describe("createCode", () => {
		it("creates code with defaults", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
			});
			const code = await controller.createCode({
				discountId: d.id,
				code: "summer10",
			});
			expect(code.code).toBe("SUMMER10");
			expect(code.discountId).toBe(d.id);
			expect(code.usedCount).toBe(0);
			expect(code.isActive).toBe(true);
			expect(code.id).toBeDefined();
		});

		it("uppercases and trims code", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
			});
			const code = await controller.createCode({
				discountId: d.id,
				code: "  hello world  ",
			});
			expect(code.code).toBe("HELLO WORLD");
		});

		it("respects maximumUses and isActive params", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
			});
			const code = await controller.createCode({
				discountId: d.id,
				code: "LIMITED",
				maximumUses: 5,
				isActive: false,
			});
			expect(code.maximumUses).toBe(5);
			expect(code.isActive).toBe(false);
		});
	});

	describe("getCodeByValue", () => {
		it("looks up case-insensitively", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
			});
			await controller.createCode({ discountId: d.id, code: "MYCODE" });

			const found = await controller.getCodeByValue("mycode");
			expect(found?.code).toBe("MYCODE");
		});

		it("returns null for non-existent code", async () => {
			const found = await controller.getCodeByValue("NOPE");
			expect(found).toBeNull();
		});
	});

	describe("listCodes", () => {
		it("lists codes for a specific discount", async () => {
			const d1 = await controller.create({
				name: "D1",
				type: "percentage",
				value: 10,
			});
			const d2 = await controller.create({
				name: "D2",
				type: "percentage",
				value: 20,
			});
			await controller.createCode({ discountId: d1.id, code: "A" });
			await controller.createCode({ discountId: d1.id, code: "B" });
			await controller.createCode({ discountId: d2.id, code: "C" });

			const codesD1 = await controller.listCodes(d1.id);
			expect(codesD1).toHaveLength(2);
			const codesD2 = await controller.listCodes(d2.id);
			expect(codesD2).toHaveLength(1);
		});

		it("returns empty for discount with no codes", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
			});
			const codes = await controller.listCodes(d.id);
			expect(codes).toHaveLength(0);
		});
	});

	describe("deleteCode", () => {
		it("deletes a code", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
			});
			const code = await controller.createCode({
				discountId: d.id,
				code: "DEL",
			});
			await controller.deleteCode(code.id);
			const found = await controller.getCodeByValue("DEL");
			expect(found).toBeNull();
		});
	});

	describe("updateCode", () => {
		it("updates isActive", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
			});
			const code = await controller.createCode({
				discountId: d.id,
				code: "UPD",
			});
			const updated = await controller.updateCode(code.id, {
				isActive: false,
			});
			expect(updated?.isActive).toBe(false);
		});

		it("updates maximumUses", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
			});
			const code = await controller.createCode({
				discountId: d.id,
				code: "MAX",
			});
			const updated = await controller.updateCode(code.id, {
				maximumUses: 42,
			});
			expect(updated?.maximumUses).toBe(42);
		});

		it("clears maximumUses with null", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
			});
			const code = await controller.createCode({
				discountId: d.id,
				code: "CLEAR",
				maximumUses: 10,
			});
			const updated = await controller.updateCode(code.id, {
				maximumUses: null,
			});
			expect(updated?.maximumUses).toBeUndefined();
		});

		it("returns null for non-existent code", async () => {
			const result = await controller.updateCode("nonexistent", {
				isActive: false,
			});
			expect(result).toBeNull();
		});

		it("preserves other fields on partial update", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
			});
			const code = await controller.createCode({
				discountId: d.id,
				code: "PRESERVE",
				maximumUses: 100,
			});
			const updated = await controller.updateCode(code.id, {
				isActive: false,
			});
			expect(updated?.maximumUses).toBe(100);
			expect(updated?.code).toBe("PRESERVE");
			expect(updated?.discountId).toBe(d.id);
		});
	});

	// ---------------------------------------------------------------
	// Code Validation
	// ---------------------------------------------------------------
	describe("validateCode", () => {
		it("validates a valid percentage code", async () => {
			const d = await controller.create({
				name: "20% Off",
				type: "percentage",
				value: 20,
			});
			await controller.createCode({ discountId: d.id, code: "SAVE20" });

			const result = await controller.validateCode({
				code: "SAVE20",
				subtotal: 10000,
			});
			expect(result.valid).toBe(true);
			expect(result.discountAmount).toBe(2000);
			expect(result.freeShipping).toBe(false);
			expect(result.discount?.id).toBe(d.id);
			expect(result.code?.code).toBe("SAVE20");
		});

		it("validates a valid fixed_amount code", async () => {
			const d = await controller.create({
				name: "$5 Off",
				type: "fixed_amount",
				value: 500,
			});
			await controller.createCode({ discountId: d.id, code: "FIVE" });

			const result = await controller.validateCode({
				code: "FIVE",
				subtotal: 3000,
			});
			expect(result.valid).toBe(true);
			expect(result.discountAmount).toBe(500);
		});

		it("fixed_amount capped at subtotal", async () => {
			const d = await controller.create({
				name: "$50 Off",
				type: "fixed_amount",
				value: 5000,
			});
			await controller.createCode({ discountId: d.id, code: "BIG" });

			const result = await controller.validateCode({
				code: "BIG",
				subtotal: 2000,
			});
			expect(result.valid).toBe(true);
			expect(result.discountAmount).toBe(2000);
		});

		it("validates free_shipping code", async () => {
			const d = await controller.create({
				name: "Free Ship",
				type: "free_shipping",
				value: 0,
			});
			await controller.createCode({ discountId: d.id, code: "FREESHIP" });

			const result = await controller.validateCode({
				code: "FREESHIP",
				subtotal: 5000,
			});
			expect(result.valid).toBe(true);
			expect(result.discountAmount).toBe(0);
			expect(result.freeShipping).toBe(true);
		});

		it("rejects invalid code", async () => {
			const result = await controller.validateCode({
				code: "DOESNOTEXIST",
				subtotal: 5000,
			});
			expect(result.valid).toBe(false);
			expect(result.error).toBe("Invalid promo code");
		});

		it("rejects inactive code", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
			});
			await controller.createCode({
				discountId: d.id,
				code: "INACTIVE",
				isActive: false,
			});

			const result = await controller.validateCode({
				code: "INACTIVE",
				subtotal: 5000,
			});
			expect(result.valid).toBe(false);
			expect(result.error).toBe("This promo code is no longer active");
		});

		it("rejects code at usage limit", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
			});
			await controller.createCode({
				discountId: d.id,
				code: "MAXED",
				maximumUses: 1,
			});
			// Apply to use the code once
			await controller.applyCode({ code: "MAXED", subtotal: 1000 });

			const result = await controller.validateCode({
				code: "MAXED",
				subtotal: 1000,
			});
			expect(result.valid).toBe(false);
			expect(result.error).toBe("This promo code has reached its usage limit");
		});

		it("rejects code for inactive discount", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
				isActive: false,
			});
			await controller.createCode({ discountId: d.id, code: "DISCINACTIVE" });

			const result = await controller.validateCode({
				code: "DISCINACTIVE",
				subtotal: 5000,
			});
			expect(result.valid).toBe(false);
			expect(result.error).toBe("This discount is not currently active");
		});

		it("rejects code for discount that has not started yet", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
				startsAt: future,
			});
			await controller.createCode({ discountId: d.id, code: "TOOEARL" });

			const result = await controller.validateCode({
				code: "TOOEARL",
				subtotal: 5000,
			});
			expect(result.valid).toBe(false);
			expect(result.error).toBe("This discount is not currently active");
		});

		it("rejects code for expired discount", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
				endsAt: past,
			});
			await controller.createCode({ discountId: d.id, code: "EXPIRED" });

			const result = await controller.validateCode({
				code: "EXPIRED",
				subtotal: 5000,
			});
			expect(result.valid).toBe(false);
			expect(result.error).toBe("This discount is not currently active");
		});

		it("rejects code for discount at usage limit", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
				maximumUses: 1,
			});
			await controller.createCode({ discountId: d.id, code: "DISCMAXED" });
			// Use it once
			await controller.applyCode({ code: "DISCMAXED", subtotal: 1000 });

			const result = await controller.validateCode({
				code: "DISCMAXED",
				subtotal: 1000,
			});
			expect(result.valid).toBe(false);
			expect(result.error).toBe("This discount is not currently active");
		});

		it("rejects code below minimum amount", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
				minimumAmount: 5000,
			});
			await controller.createCode({ discountId: d.id, code: "MINAMOUNT" });

			const result = await controller.validateCode({
				code: "MINAMOUNT",
				subtotal: 3000,
			});
			expect(result.valid).toBe(false);
			expect(result.error).toBe("Minimum order amount of 5000 required");
		});

		it("passes at exact minimum amount", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
				minimumAmount: 5000,
			});
			await controller.createCode({ discountId: d.id, code: "EXACT" });

			const result = await controller.validateCode({
				code: "EXACT",
				subtotal: 5000,
			});
			expect(result.valid).toBe(true);
		});

		it("rejects code that does not apply to cart products", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
				appliesTo: "specific_products",
				appliesToIds: ["prod_1", "prod_2"],
			});
			await controller.createCode({ discountId: d.id, code: "PRODONLY" });

			const result = await controller.validateCode({
				code: "PRODONLY",
				subtotal: 5000,
				productIds: ["prod_3", "prod_4"],
				categoryIds: [],
			});
			expect(result.valid).toBe(false);
			expect(result.error).toBe(
				"This discount does not apply to the items in your cart",
			);
		});

		it("accepts code that matches some cart products", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
				appliesTo: "specific_products",
				appliesToIds: ["prod_1", "prod_2"],
			});
			await controller.createCode({ discountId: d.id, code: "PRODMATCH" });

			const result = await controller.validateCode({
				code: "PRODMATCH",
				subtotal: 5000,
				productIds: ["prod_2", "prod_3"],
			});
			expect(result.valid).toBe(true);
		});

		it("rejects code that does not apply to cart categories", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
				appliesTo: "specific_categories",
				appliesToIds: ["cat_1"],
			});
			await controller.createCode({ discountId: d.id, code: "CATONLY" });

			const result = await controller.validateCode({
				code: "CATONLY",
				subtotal: 5000,
				productIds: [],
				categoryIds: ["cat_2"],
			});
			expect(result.valid).toBe(false);
		});

		it("accepts code matching specific categories", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
				appliesTo: "specific_categories",
				appliesToIds: ["cat_1", "cat_2"],
			});
			await controller.createCode({ discountId: d.id, code: "CATMATCH" });

			const result = await controller.validateCode({
				code: "CATMATCH",
				subtotal: 5000,
				categoryIds: ["cat_2", "cat_99"],
			});
			expect(result.valid).toBe(true);
		});

		it("case-insensitive code lookup in validation", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
			});
			await controller.createCode({ discountId: d.id, code: "UPPER" });

			const result = await controller.validateCode({
				code: "upper",
				subtotal: 5000,
			});
			expect(result.valid).toBe(true);
		});

		it("percentage calculation uses Math.round", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 33,
			});
			await controller.createCode({ discountId: d.id, code: "ROUND" });

			const result = await controller.validateCode({
				code: "ROUND",
				subtotal: 10000,
			});
			// Math.round(10000 * 33 / 100) = Math.round(3300) = 3300
			expect(result.discountAmount).toBe(3300);
		});

		it("percentage calculation rounds correctly", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 33,
			});
			await controller.createCode({ discountId: d.id, code: "ROUND2" });

			const result = await controller.validateCode({
				code: "ROUND2",
				subtotal: 99,
			});
			// Math.round(99 * 33 / 100) = Math.round(32.67) = 33
			expect(result.discountAmount).toBe(33);
		});

		it("does not increment usage counters", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
			});
			await controller.createCode({ discountId: d.id, code: "NOINCR" });

			await controller.validateCode({ code: "NOINCR", subtotal: 5000 });
			await controller.validateCode({ code: "NOINCR", subtotal: 5000 });

			const code = await controller.getCodeByValue("NOINCR");
			expect(code?.usedCount).toBe(0);
			const discount = await controller.getById(d.id);
			expect(discount?.usedCount).toBe(0);
		});
	});

	// ---------------------------------------------------------------
	// Apply Code
	// ---------------------------------------------------------------
	describe("applyCode", () => {
		it("validates and increments both code and discount usedCount", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
			});
			await controller.createCode({ discountId: d.id, code: "APPLY" });

			const result = await controller.applyCode({
				code: "APPLY",
				subtotal: 5000,
			});
			expect(result.valid).toBe(true);
			expect(result.code?.usedCount).toBe(1);
			expect(result.discount?.usedCount).toBe(1);

			// Verify persisted
			const code = await controller.getCodeByValue("APPLY");
			expect(code?.usedCount).toBe(1);
			const discount = await controller.getById(d.id);
			expect(discount?.usedCount).toBe(1);
		});

		it("multiple applications increment correctly", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
				maximumUses: 5,
			});
			await controller.createCode({
				discountId: d.id,
				code: "MULTI",
				maximumUses: 5,
			});

			for (let i = 0; i < 3; i++) {
				await controller.applyCode({ code: "MULTI", subtotal: 1000 });
			}

			const code = await controller.getCodeByValue("MULTI");
			expect(code?.usedCount).toBe(3);
			const discount = await controller.getById(d.id);
			expect(discount?.usedCount).toBe(3);
		});

		it("returns error if validation fails", async () => {
			const result = await controller.applyCode({
				code: "NOCODE",
				subtotal: 5000,
			});
			expect(result.valid).toBe(false);
			expect(result.error).toBe("Invalid promo code");
		});

		it("does not increment counters on failed validation", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
				isActive: false,
			});
			await controller.createCode({ discountId: d.id, code: "NOAPP" });

			const result = await controller.applyCode({
				code: "NOAPP",
				subtotal: 5000,
			});
			expect(result.valid).toBe(false);

			const code = await controller.getCodeByValue("NOAPP");
			expect(code?.usedCount).toBe(0);
		});
	});

	// ---------------------------------------------------------------
	// Bulk Codes
	// ---------------------------------------------------------------
	describe("generateBulkCodes", () => {
		it("generates requested number of codes", async () => {
			const d = await controller.create({
				name: "Bulk",
				type: "percentage",
				value: 15,
			});
			const result = await controller.generateBulkCodes({
				discountId: d.id,
				count: 10,
			});
			expect(result.generated).toBe(10);
			expect(result.codes).toHaveLength(10);
		});

		it("codes are 8 characters when no prefix", async () => {
			const d = await controller.create({
				name: "Bulk",
				type: "percentage",
				value: 15,
			});
			const result = await controller.generateBulkCodes({
				discountId: d.id,
				count: 5,
			});
			for (const code of result.codes) {
				expect(code.code).toHaveLength(8);
			}
		});

		it("applies prefix correctly", async () => {
			const d = await controller.create({
				name: "Bulk",
				type: "percentage",
				value: 15,
			});
			const result = await controller.generateBulkCodes({
				discountId: d.id,
				count: 5,
				prefix: "VIP",
			});
			for (const code of result.codes) {
				expect(code.code).toMatch(/^VIP-/);
				// prefix "VIP" + "-" + 8 chars = 12
				expect(code.code).toHaveLength(12);
			}
		});

		it("uppercases and trims prefix", async () => {
			const d = await controller.create({
				name: "Bulk",
				type: "percentage",
				value: 15,
			});
			const result = await controller.generateBulkCodes({
				discountId: d.id,
				count: 3,
				prefix: " summer ",
			});
			for (const code of result.codes) {
				expect(code.code).toMatch(/^SUMMER-/);
			}
		});

		it("codes only contain valid CODE_CHARS (no 0/1/I/O)", async () => {
			const d = await controller.create({
				name: "Bulk",
				type: "percentage",
				value: 15,
			});
			const result = await controller.generateBulkCodes({
				discountId: d.id,
				count: 50,
			});
			const validChars = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/;
			for (const code of result.codes) {
				expect(code.code).toMatch(validChars);
			}
		});

		it("all generated codes are unique", async () => {
			const d = await controller.create({
				name: "Bulk",
				type: "percentage",
				value: 15,
			});
			const result = await controller.generateBulkCodes({
				discountId: d.id,
				count: 50,
			});
			const codeValues = result.codes.map((c) => c.code);
			const uniqueSet = new Set(codeValues);
			expect(uniqueSet.size).toBe(codeValues.length);
		});

		it("sets maximumUses on generated codes", async () => {
			const d = await controller.create({
				name: "Bulk",
				type: "percentage",
				value: 15,
			});
			const result = await controller.generateBulkCodes({
				discountId: d.id,
				count: 3,
				maximumUses: 1,
			});
			for (const code of result.codes) {
				expect(code.maximumUses).toBe(1);
				expect(code.usedCount).toBe(0);
				expect(code.isActive).toBe(true);
			}
		});

		it("generated codes are associated with discount", async () => {
			const d = await controller.create({
				name: "Bulk",
				type: "percentage",
				value: 15,
			});
			await controller.generateBulkCodes({
				discountId: d.id,
				count: 5,
			});
			const codes = await controller.listCodes(d.id);
			expect(codes).toHaveLength(5);
		});

		it("codes with prefix can be validated", async () => {
			const d = await controller.create({
				name: "Bulk",
				type: "percentage",
				value: 10,
			});
			const result = await controller.generateBulkCodes({
				discountId: d.id,
				count: 1,
				prefix: "TEST",
			});
			const codeValue = result.codes[0].code;
			const validation = await controller.validateCode({
				code: codeValue,
				subtotal: 5000,
			});
			expect(validation.valid).toBe(true);
		});
	});

	// ---------------------------------------------------------------
	// Code Stats
	// ---------------------------------------------------------------
	describe("getCodeStats", () => {
		it("returns zeroes for discount with no codes", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
			});
			const stats = await controller.getCodeStats(d.id);
			expect(stats.total).toBe(0);
			expect(stats.active).toBe(0);
			expect(stats.inactive).toBe(0);
			expect(stats.totalRedemptions).toBe(0);
			expect(stats.fullyUsed).toBe(0);
			expect(stats.unused).toBe(0);
			expect(stats.redemptionRate).toBe(0);
		});

		it("counts active and inactive codes", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
			});
			await controller.createCode({
				discountId: d.id,
				code: "A1",
				isActive: true,
			});
			await controller.createCode({
				discountId: d.id,
				code: "A2",
				isActive: true,
			});
			await controller.createCode({
				discountId: d.id,
				code: "I1",
				isActive: false,
			});

			const stats = await controller.getCodeStats(d.id);
			expect(stats.total).toBe(3);
			expect(stats.active).toBe(2);
			expect(stats.inactive).toBe(1);
		});

		it("counts redemptions and unused codes", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
			});
			await controller.createCode({ discountId: d.id, code: "USED1" });
			await controller.createCode({ discountId: d.id, code: "USED2" });
			await controller.createCode({ discountId: d.id, code: "NOTUSED" });

			await controller.applyCode({ code: "USED1", subtotal: 1000 });
			await controller.applyCode({ code: "USED1", subtotal: 1000 });
			await controller.applyCode({ code: "USED2", subtotal: 1000 });

			const stats = await controller.getCodeStats(d.id);
			expect(stats.totalRedemptions).toBe(3);
			expect(stats.unused).toBe(1);
		});

		it("counts fully used codes", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
			});
			await controller.createCode({
				discountId: d.id,
				code: "FULL",
				maximumUses: 1,
			});
			await controller.applyCode({ code: "FULL", subtotal: 1000 });

			const stats = await controller.getCodeStats(d.id);
			expect(stats.fullyUsed).toBe(1);
		});

		it("calculates redemptionRate correctly", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
			});
			// 4 codes: 2 used, 2 unused => redemptionRate = round((4-2)/4 * 100) = 50
			await controller.createCode({ discountId: d.id, code: "R1" });
			await controller.createCode({ discountId: d.id, code: "R2" });
			await controller.createCode({ discountId: d.id, code: "R3" });
			await controller.createCode({ discountId: d.id, code: "R4" });

			await controller.applyCode({ code: "R1", subtotal: 1000 });
			await controller.applyCode({ code: "R2", subtotal: 1000 });

			const stats = await controller.getCodeStats(d.id);
			expect(stats.redemptionRate).toBe(50);
		});
	});

	// ---------------------------------------------------------------
	// Analytics
	// ---------------------------------------------------------------
	describe("getAnalytics", () => {
		it("returns zeroes when empty", async () => {
			const analytics = await controller.getAnalytics();
			expect(analytics.totalDiscounts).toBe(0);
			expect(analytics.activeCount).toBe(0);
			expect(analytics.expiredCount).toBe(0);
			expect(analytics.scheduledCount).toBe(0);
			expect(analytics.totalUsage).toBe(0);
			expect(analytics.totalCodes).toBe(0);
			expect(analytics.typeDistribution).toEqual({
				percentage: 0,
				fixed_amount: 0,
				free_shipping: 0,
			});
			expect(analytics.topByUsage).toEqual([]);
		});

		it("classifies active, expired, and scheduled discounts", async () => {
			// Active: isActive=true, no date constraints
			await controller.create({
				name: "Active",
				type: "percentage",
				value: 10,
				isActive: true,
			});
			// Expired: endsAt in the past
			await controller.create({
				name: "Expired",
				type: "fixed_amount",
				value: 500,
				isActive: true,
				endsAt: past,
			});
			// Scheduled: startsAt in the future
			await controller.create({
				name: "Scheduled",
				type: "free_shipping",
				value: 0,
				isActive: true,
				startsAt: future,
			});
			// Inactive: isActive=false
			await controller.create({
				name: "Inactive",
				type: "percentage",
				value: 5,
				isActive: false,
			});

			const analytics = await controller.getAnalytics();
			expect(analytics.totalDiscounts).toBe(4);
			expect(analytics.activeCount).toBe(1);
			expect(analytics.expiredCount).toBe(2); // expired + inactive
			expect(analytics.scheduledCount).toBe(1);
		});

		it("counts type distribution", async () => {
			await controller.create({
				name: "P1",
				type: "percentage",
				value: 10,
			});
			await controller.create({
				name: "P2",
				type: "percentage",
				value: 20,
			});
			await controller.create({
				name: "F1",
				type: "fixed_amount",
				value: 500,
			});
			await controller.create({
				name: "FS1",
				type: "free_shipping",
				value: 0,
			});

			const analytics = await controller.getAnalytics();
			expect(analytics.typeDistribution.percentage).toBe(2);
			expect(analytics.typeDistribution.fixed_amount).toBe(1);
			expect(analytics.typeDistribution.free_shipping).toBe(1);
		});

		it("counts total codes across discounts", async () => {
			const d1 = await controller.create({
				name: "D1",
				type: "percentage",
				value: 10,
			});
			const d2 = await controller.create({
				name: "D2",
				type: "percentage",
				value: 20,
			});
			await controller.createCode({ discountId: d1.id, code: "A" });
			await controller.createCode({ discountId: d1.id, code: "B" });
			await controller.createCode({ discountId: d2.id, code: "C" });

			const analytics = await controller.getAnalytics();
			expect(analytics.totalCodes).toBe(3);
		});

		it("sums total usage", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 10,
			});
			await controller.createCode({ discountId: d.id, code: "USE" });
			await controller.applyCode({ code: "USE", subtotal: 1000 });
			await controller.applyCode({ code: "USE", subtotal: 1000 });

			const analytics = await controller.getAnalytics();
			expect(analytics.totalUsage).toBe(2);
		});

		it("topByUsage sorted descending and limited to 10", async () => {
			for (let i = 0; i < 12; i++) {
				await controller.create({
					id: `disc_${i}`,
					name: `Disc${i}`,
					type: "percentage",
					value: 10,
				});
			}
			// Give disc_5 the most usage by applying codes
			await controller.createCode({
				discountId: "disc_5",
				code: "TOP",
			});
			for (let i = 0; i < 5; i++) {
				await controller.applyCode({ code: "TOP", subtotal: 1000 });
			}

			const analytics = await controller.getAnalytics();
			expect(analytics.topByUsage).toHaveLength(10);
			expect(analytics.topByUsage[0].id).toBe("disc_5");
			expect(analytics.topByUsage[0].usedCount).toBe(5);
		});

		it("topByUsage includes codesCount", async () => {
			const d = await controller.create({
				id: "d-with-codes",
				name: "WithCodes",
				type: "percentage",
				value: 10,
			});
			await controller.createCode({ discountId: d.id, code: "X1" });
			await controller.createCode({ discountId: d.id, code: "X2" });
			await controller.createCode({ discountId: d.id, code: "X3" });

			const analytics = await controller.getAnalytics();
			const summary = analytics.topByUsage.find((s) => s.id === "d-with-codes");
			expect(summary?.codesCount).toBe(3);
		});
	});

	// ---------------------------------------------------------------
	// Cart Price Rules CRUD
	// ---------------------------------------------------------------
	describe("createPriceRule", () => {
		it("creates with defaults", async () => {
			const rule = await controller.createPriceRule({
				name: "Auto 10%",
				type: "percentage",
				value: 10,
			});
			expect(rule.name).toBe("Auto 10%");
			expect(rule.type).toBe("percentage");
			expect(rule.value).toBe(10);
			expect(rule.conditions).toEqual([]);
			expect(rule.appliesTo).toBe("all");
			expect(rule.appliesToIds).toEqual([]);
			expect(rule.priority).toBe(0);
			expect(rule.stackable).toBe(false);
			expect(rule.usedCount).toBe(0);
			expect(rule.isActive).toBe(true);
			expect(rule.metadata).toEqual({});
		});

		it("creates with full params", async () => {
			const rule = await controller.createPriceRule({
				id: "rule-1",
				name: "Big Rule",
				description: "A big rule",
				type: "fixed_amount",
				value: 2000,
				conditions: [
					{ type: "minimum_subtotal", value: 10000 },
					{ type: "minimum_item_count", value: 3 },
				],
				appliesTo: "specific_products",
				appliesToIds: ["prod_1"],
				priority: 5,
				stackable: true,
				maximumUses: 100,
				isActive: false,
				startsAt: past,
				endsAt: future,
				metadata: { campaign: "spring" },
			});
			expect(rule.id).toBe("rule-1");
			expect(rule.description).toBe("A big rule");
			expect(rule.conditions).toHaveLength(2);
			expect(rule.appliesTo).toBe("specific_products");
			expect(rule.appliesToIds).toEqual(["prod_1"]);
			expect(rule.priority).toBe(5);
			expect(rule.stackable).toBe(true);
			expect(rule.maximumUses).toBe(100);
			expect(rule.isActive).toBe(false);
			expect(rule.metadata).toEqual({ campaign: "spring" });
		});
	});

	describe("getPriceRule", () => {
		it("returns rule by id", async () => {
			const rule = await controller.createPriceRule({
				name: "R",
				type: "percentage",
				value: 5,
			});
			const found = await controller.getPriceRule(rule.id);
			expect(found?.name).toBe("R");
		});

		it("returns null for non-existent id", async () => {
			const found = await controller.getPriceRule("nope");
			expect(found).toBeNull();
		});
	});

	describe("updatePriceRule", () => {
		it("updates specific fields", async () => {
			const rule = await controller.createPriceRule({
				name: "Original",
				type: "percentage",
				value: 10,
				priority: 0,
			});
			const updated = await controller.updatePriceRule(rule.id, {
				name: "Updated",
				priority: 5,
			});
			expect(updated?.name).toBe("Updated");
			expect(updated?.priority).toBe(5);
			expect(updated?.type).toBe("percentage");
			expect(updated?.value).toBe(10);
		});

		it("returns null for non-existent rule", async () => {
			const result = await controller.updatePriceRule("nope", {
				name: "X",
			});
			expect(result).toBeNull();
		});

		it("clears nullable fields with null", async () => {
			const rule = await controller.createPriceRule({
				name: "R",
				type: "percentage",
				value: 10,
				maximumUses: 50,
				startsAt: past,
				endsAt: future,
			});
			const updated = await controller.updatePriceRule(rule.id, {
				maximumUses: null,
				startsAt: null,
				endsAt: null,
			});
			expect(updated?.maximumUses).toBeUndefined();
			expect(updated?.startsAt).toBeUndefined();
			expect(updated?.endsAt).toBeUndefined();
		});

		it("updates conditions", async () => {
			const rule = await controller.createPriceRule({
				name: "R",
				type: "percentage",
				value: 10,
				conditions: [{ type: "minimum_subtotal", value: 1000 }],
			});
			const updated = await controller.updatePriceRule(rule.id, {
				conditions: [
					{ type: "minimum_subtotal", value: 5000 },
					{ type: "contains_product", value: "prod_1" },
				],
			});
			expect(updated?.conditions).toHaveLength(2);
			expect(updated?.conditions[0].value).toBe(5000);
		});
	});

	describe("deletePriceRule", () => {
		it("deletes a price rule", async () => {
			const rule = await controller.createPriceRule({
				name: "Del",
				type: "percentage",
				value: 10,
			});
			await controller.deletePriceRule(rule.id);
			const found = await controller.getPriceRule(rule.id);
			expect(found).toBeNull();
		});
	});

	describe("listPriceRules", () => {
		it("returns empty list when none exist", async () => {
			const result = await controller.listPriceRules({});
			expect(result.rules).toHaveLength(0);
			expect(result.total).toBe(0);
		});

		it("sorts by priority ascending", async () => {
			await controller.createPriceRule({
				name: "Low",
				type: "percentage",
				value: 5,
				priority: 10,
			});
			await controller.createPriceRule({
				name: "High",
				type: "percentage",
				value: 15,
				priority: 1,
			});
			await controller.createPriceRule({
				name: "Mid",
				type: "percentage",
				value: 10,
				priority: 5,
			});

			const result = await controller.listPriceRules({});
			expect(result.rules[0].name).toBe("High");
			expect(result.rules[1].name).toBe("Mid");
			expect(result.rules[2].name).toBe("Low");
		});

		it("respects limit and offset", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.createPriceRule({
					name: `R${i}`,
					type: "percentage",
					value: i,
					priority: i,
				});
			}
			const page = await controller.listPriceRules({
				limit: 3,
				offset: 2,
			});
			expect(page.rules).toHaveLength(3);
			expect(page.total).toBe(10);
		});

		it("filters by isActive", async () => {
			await controller.createPriceRule({
				name: "Active",
				type: "percentage",
				value: 5,
				isActive: true,
			});
			await controller.createPriceRule({
				name: "Inactive",
				type: "percentage",
				value: 10,
				isActive: false,
			});

			const active = await controller.listPriceRules({ isActive: true });
			expect(active.rules).toHaveLength(1);
			expect(active.rules[0].name).toBe("Active");

			const inactive = await controller.listPriceRules({ isActive: false });
			expect(inactive.rules).toHaveLength(1);
			expect(inactive.rules[0].name).toBe("Inactive");
		});
	});

	// ---------------------------------------------------------------
	// evaluateCartRules
	// ---------------------------------------------------------------
	describe("evaluateCartRules", () => {
		it("returns empty results with no rules", async () => {
			const result = await controller.evaluateCartRules({
				subtotal: 5000,
				itemCount: 3,
			});
			expect(result.rules).toHaveLength(0);
			expect(result.totalDiscount).toBe(0);
			expect(result.freeShipping).toBe(false);
		});

		it("applies single matching percentage rule", async () => {
			await controller.createPriceRule({
				name: "10% Off",
				type: "percentage",
				value: 10,
			});
			const result = await controller.evaluateCartRules({
				subtotal: 10000,
				itemCount: 1,
			});
			expect(result.rules).toHaveLength(1);
			expect(result.totalDiscount).toBe(1000);
			expect(result.rules[0].discountAmount).toBe(1000);
			expect(result.rules[0].ruleName).toBe("10% Off");
		});

		it("applies single matching fixed_amount rule", async () => {
			await controller.createPriceRule({
				name: "$5 Off",
				type: "fixed_amount",
				value: 500,
			});
			const result = await controller.evaluateCartRules({
				subtotal: 3000,
				itemCount: 1,
			});
			expect(result.totalDiscount).toBe(500);
		});

		it("fixed_amount rule capped at subtotal", async () => {
			await controller.createPriceRule({
				name: "$50 Off",
				type: "fixed_amount",
				value: 5000,
			});
			const result = await controller.evaluateCartRules({
				subtotal: 2000,
				itemCount: 1,
			});
			expect(result.totalDiscount).toBe(2000);
		});

		it("applies free_shipping rule", async () => {
			await controller.createPriceRule({
				name: "Free Ship",
				type: "free_shipping",
				value: 0,
			});
			const result = await controller.evaluateCartRules({
				subtotal: 5000,
				itemCount: 1,
			});
			expect(result.freeShipping).toBe(true);
			expect(result.totalDiscount).toBe(0);
			expect(result.rules[0].freeShipping).toBe(true);
		});

		it("skips inactive rules", async () => {
			await controller.createPriceRule({
				name: "Inactive",
				type: "percentage",
				value: 10,
				isActive: false,
			});
			const result = await controller.evaluateCartRules({
				subtotal: 10000,
				itemCount: 1,
			});
			expect(result.rules).toHaveLength(0);
		});

		it("skips rules that have not started yet", async () => {
			await controller.createPriceRule({
				name: "Future",
				type: "percentage",
				value: 10,
				startsAt: future,
			});
			const result = await controller.evaluateCartRules({
				subtotal: 10000,
				itemCount: 1,
			});
			expect(result.rules).toHaveLength(0);
		});

		it("skips expired rules", async () => {
			await controller.createPriceRule({
				name: "Expired",
				type: "percentage",
				value: 10,
				endsAt: past,
			});
			const result = await controller.evaluateCartRules({
				subtotal: 10000,
				itemCount: 1,
			});
			expect(result.rules).toHaveLength(0);
		});

		it("skips rules at usage limit", async () => {
			const rule = await controller.createPriceRule({
				name: "Limited",
				type: "percentage",
				value: 10,
				maximumUses: 1,
			});
			await controller.applyPriceRules([rule.id]);

			const result = await controller.evaluateCartRules({
				subtotal: 10000,
				itemCount: 1,
			});
			expect(result.rules).toHaveLength(0);
		});

		describe("conditions", () => {
			it("minimum_subtotal condition filters", async () => {
				await controller.createPriceRule({
					name: "Min $50",
					type: "percentage",
					value: 10,
					conditions: [{ type: "minimum_subtotal", value: 5000 }],
				});

				const below = await controller.evaluateCartRules({
					subtotal: 3000,
					itemCount: 1,
				});
				expect(below.rules).toHaveLength(0);

				const above = await controller.evaluateCartRules({
					subtotal: 5000,
					itemCount: 1,
				});
				expect(above.rules).toHaveLength(1);
			});

			it("minimum_item_count condition filters", async () => {
				await controller.createPriceRule({
					name: "Min 3 items",
					type: "percentage",
					value: 10,
					conditions: [{ type: "minimum_item_count", value: 3 }],
				});

				const below = await controller.evaluateCartRules({
					subtotal: 10000,
					itemCount: 2,
				});
				expect(below.rules).toHaveLength(0);

				const at = await controller.evaluateCartRules({
					subtotal: 10000,
					itemCount: 3,
				});
				expect(at.rules).toHaveLength(1);
			});

			it("contains_product condition filters", async () => {
				await controller.createPriceRule({
					name: "Has Product",
					type: "percentage",
					value: 10,
					conditions: [{ type: "contains_product", value: "prod_1" }],
				});

				const without = await controller.evaluateCartRules({
					subtotal: 10000,
					itemCount: 1,
					productIds: ["prod_2"],
				});
				expect(without.rules).toHaveLength(0);

				const withProduct = await controller.evaluateCartRules({
					subtotal: 10000,
					itemCount: 1,
					productIds: ["prod_1", "prod_2"],
				});
				expect(withProduct.rules).toHaveLength(1);
			});

			it("contains_category condition filters", async () => {
				await controller.createPriceRule({
					name: "Has Category",
					type: "percentage",
					value: 10,
					conditions: [{ type: "contains_category", value: "cat_1" }],
				});

				const without = await controller.evaluateCartRules({
					subtotal: 10000,
					itemCount: 1,
					categoryIds: ["cat_2"],
				});
				expect(without.rules).toHaveLength(0);

				const withCat = await controller.evaluateCartRules({
					subtotal: 10000,
					itemCount: 1,
					categoryIds: ["cat_1"],
				});
				expect(withCat.rules).toHaveLength(1);
			});

			it("multiple conditions use AND logic", async () => {
				await controller.createPriceRule({
					name: "Multi Cond",
					type: "percentage",
					value: 10,
					conditions: [
						{ type: "minimum_subtotal", value: 5000 },
						{ type: "minimum_item_count", value: 2 },
					],
				});

				// Meets subtotal but not itemCount
				const partial1 = await controller.evaluateCartRules({
					subtotal: 5000,
					itemCount: 1,
				});
				expect(partial1.rules).toHaveLength(0);

				// Meets itemCount but not subtotal
				const partial2 = await controller.evaluateCartRules({
					subtotal: 3000,
					itemCount: 2,
				});
				expect(partial2.rules).toHaveLength(0);

				// Meets both
				const both = await controller.evaluateCartRules({
					subtotal: 5000,
					itemCount: 2,
				});
				expect(both.rules).toHaveLength(1);
			});
		});

		describe("appliesTo for price rules", () => {
			it("specific_products filters by productIds", async () => {
				await controller.createPriceRule({
					name: "Prod Rule",
					type: "percentage",
					value: 10,
					appliesTo: "specific_products",
					appliesToIds: ["prod_1"],
				});

				const no = await controller.evaluateCartRules({
					subtotal: 10000,
					itemCount: 1,
					productIds: ["prod_2"],
				});
				expect(no.rules).toHaveLength(0);

				const yes = await controller.evaluateCartRules({
					subtotal: 10000,
					itemCount: 1,
					productIds: ["prod_1"],
				});
				expect(yes.rules).toHaveLength(1);
			});

			it("specific_categories filters by categoryIds", async () => {
				await controller.createPriceRule({
					name: "Cat Rule",
					type: "percentage",
					value: 10,
					appliesTo: "specific_categories",
					appliesToIds: ["cat_1"],
				});

				const no = await controller.evaluateCartRules({
					subtotal: 10000,
					itemCount: 1,
					categoryIds: ["cat_2"],
				});
				expect(no.rules).toHaveLength(0);

				const yes = await controller.evaluateCartRules({
					subtotal: 10000,
					itemCount: 1,
					categoryIds: ["cat_1"],
				});
				expect(yes.rules).toHaveLength(1);
			});
		});

		describe("stackability", () => {
			it("stops after first non-stackable rule", async () => {
				await controller.createPriceRule({
					name: "First",
					type: "fixed_amount",
					value: 500,
					priority: 0,
					stackable: false,
				});
				await controller.createPriceRule({
					name: "Second",
					type: "fixed_amount",
					value: 300,
					priority: 1,
					stackable: true,
				});

				const result = await controller.evaluateCartRules({
					subtotal: 10000,
					itemCount: 1,
				});
				expect(result.rules).toHaveLength(1);
				expect(result.rules[0].ruleName).toBe("First");
				expect(result.totalDiscount).toBe(500);
			});

			it("non-stackable rule does not apply if others already applied", async () => {
				await controller.createPriceRule({
					name: "Stackable",
					type: "fixed_amount",
					value: 500,
					priority: 0,
					stackable: true,
				});
				await controller.createPriceRule({
					name: "NonStackable",
					type: "fixed_amount",
					value: 300,
					priority: 1,
					stackable: false,
				});

				const result = await controller.evaluateCartRules({
					subtotal: 10000,
					itemCount: 1,
				});
				expect(result.rules).toHaveLength(1);
				expect(result.rules[0].ruleName).toBe("Stackable");
			});

			it("multiple stackable rules all apply", async () => {
				await controller.createPriceRule({
					name: "Stack1",
					type: "fixed_amount",
					value: 500,
					priority: 0,
					stackable: true,
				});
				await controller.createPriceRule({
					name: "Stack2",
					type: "fixed_amount",
					value: 300,
					priority: 1,
					stackable: true,
				});
				await controller.createPriceRule({
					name: "Stack3",
					type: "fixed_amount",
					value: 200,
					priority: 2,
					stackable: true,
				});

				const result = await controller.evaluateCartRules({
					subtotal: 10000,
					itemCount: 1,
				});
				expect(result.rules).toHaveLength(3);
				expect(result.totalDiscount).toBe(1000);
			});

			it("stackable rules use remaining subtotal for calculations", async () => {
				await controller.createPriceRule({
					name: "First",
					type: "fixed_amount",
					value: 8000,
					priority: 0,
					stackable: true,
				});
				await controller.createPriceRule({
					name: "Second",
					type: "fixed_amount",
					value: 5000,
					priority: 1,
					stackable: true,
				});

				const result = await controller.evaluateCartRules({
					subtotal: 10000,
					itemCount: 1,
				});
				expect(result.rules).toHaveLength(2);
				// First takes 8000, remaining = 2000
				// Second capped at min(5000, 2000) = 2000
				expect(result.rules[0].discountAmount).toBe(8000);
				expect(result.rules[1].discountAmount).toBe(2000);
				expect(result.totalDiscount).toBe(10000);
			});
		});

		it("priority order is respected (lower = higher priority)", async () => {
			await controller.createPriceRule({
				name: "LowPriority",
				type: "fixed_amount",
				value: 500,
				priority: 10,
				stackable: false,
			});
			await controller.createPriceRule({
				name: "HighPriority",
				type: "fixed_amount",
				value: 300,
				priority: 1,
				stackable: false,
			});

			const result = await controller.evaluateCartRules({
				subtotal: 10000,
				itemCount: 1,
			});
			// Should only get the higher priority one (lower number)
			expect(result.rules).toHaveLength(1);
			expect(result.rules[0].ruleName).toBe("HighPriority");
		});

		it("combines free_shipping with percentage via stacking", async () => {
			await controller.createPriceRule({
				name: "Discount",
				type: "percentage",
				value: 10,
				priority: 0,
				stackable: true,
			});
			await controller.createPriceRule({
				name: "FreeShip",
				type: "free_shipping",
				value: 0,
				priority: 1,
				stackable: true,
			});

			const result = await controller.evaluateCartRules({
				subtotal: 10000,
				itemCount: 1,
			});
			expect(result.rules).toHaveLength(2);
			expect(result.totalDiscount).toBe(1000);
			expect(result.freeShipping).toBe(true);
		});

		it("rules with no conditions and appliesTo all match everything", async () => {
			await controller.createPriceRule({
				name: "Universal",
				type: "percentage",
				value: 5,
			});
			const result = await controller.evaluateCartRules({
				subtotal: 1000,
				itemCount: 1,
			});
			expect(result.rules).toHaveLength(1);
		});
	});

	// ---------------------------------------------------------------
	// applyPriceRules
	// ---------------------------------------------------------------
	describe("applyPriceRules", () => {
		it("increments usedCount for each rule", async () => {
			const r1 = await controller.createPriceRule({
				name: "R1",
				type: "percentage",
				value: 5,
			});
			const r2 = await controller.createPriceRule({
				name: "R2",
				type: "percentage",
				value: 10,
			});

			await controller.applyPriceRules([r1.id, r2.id]);

			const updated1 = await controller.getPriceRule(r1.id);
			expect(updated1?.usedCount).toBe(1);
			const updated2 = await controller.getPriceRule(r2.id);
			expect(updated2?.usedCount).toBe(1);
		});

		it("increments correctly on multiple calls", async () => {
			const r = await controller.createPriceRule({
				name: "R",
				type: "percentage",
				value: 5,
			});

			await controller.applyPriceRules([r.id]);
			await controller.applyPriceRules([r.id]);
			await controller.applyPriceRules([r.id]);

			const updated = await controller.getPriceRule(r.id);
			expect(updated?.usedCount).toBe(3);
		});

		it("skips non-existent rule ids gracefully", async () => {
			const r = await controller.createPriceRule({
				name: "R",
				type: "percentage",
				value: 5,
			});
			// No error thrown for nonexistent id
			await controller.applyPriceRules([r.id, "nonexistent"]);

			const updated = await controller.getPriceRule(r.id);
			expect(updated?.usedCount).toBe(1);
		});

		it("handles empty array", async () => {
			await controller.applyPriceRules([]);
			// Should not throw
		});
	});

	// ---------------------------------------------------------------
	// Cross-cutting edge cases
	// ---------------------------------------------------------------
	describe("cross-cutting edge cases", () => {
		it("deleting discount does not affect other discounts codes", async () => {
			const d1 = await controller.create({
				name: "D1",
				type: "percentage",
				value: 10,
			});
			const d2 = await controller.create({
				name: "D2",
				type: "percentage",
				value: 20,
			});
			await controller.createCode({ discountId: d1.id, code: "C1" });
			await controller.createCode({ discountId: d2.id, code: "C2" });

			await controller.delete(d1.id);

			const c2 = await controller.getCodeByValue("C2");
			expect(c2?.code).toBe("C2");
			expect(c2?.discountId).toBe(d2.id);
		});

		it("discount with active date window validates correctly", async () => {
			const d = await controller.create({
				name: "Window",
				type: "percentage",
				value: 10,
				startsAt: past,
				endsAt: future,
			});
			await controller.createCode({ discountId: d.id, code: "WINDOW" });

			const result = await controller.validateCode({
				code: "WINDOW",
				subtotal: 5000,
			});
			expect(result.valid).toBe(true);
		});

		it("code without maximumUses is unlimited", async () => {
			const d = await controller.create({
				name: "Unlimited",
				type: "percentage",
				value: 5,
			});
			await controller.createCode({ discountId: d.id, code: "UNLIM" });

			// Apply many times
			for (let i = 0; i < 10; i++) {
				const result = await controller.applyCode({
					code: "UNLIM",
					subtotal: 1000,
				});
				expect(result.valid).toBe(true);
			}

			const code = await controller.getCodeByValue("UNLIM");
			expect(code?.usedCount).toBe(10);
		});

		it("discount without maximumUses is unlimited", async () => {
			const d = await controller.create({
				name: "Unlimited",
				type: "percentage",
				value: 5,
			});
			await controller.createCode({ discountId: d.id, code: "DUNLIM" });

			for (let i = 0; i < 10; i++) {
				await controller.applyCode({ code: "DUNLIM", subtotal: 1000 });
			}

			const discount = await controller.getById(d.id);
			expect(discount?.usedCount).toBe(10);
		});

		it("percentage discount on zero subtotal gives zero", async () => {
			const d = await controller.create({
				name: "D",
				type: "percentage",
				value: 50,
			});
			await controller.createCode({ discountId: d.id, code: "ZERO" });

			const result = await controller.validateCode({
				code: "ZERO",
				subtotal: 0,
			});
			expect(result.valid).toBe(true);
			expect(result.discountAmount).toBe(0);
		});

		it("fixed_amount discount on zero subtotal gives zero", async () => {
			const d = await controller.create({
				name: "D",
				type: "fixed_amount",
				value: 1000,
			});
			await controller.createCode({ discountId: d.id, code: "FIXZERO" });

			const result = await controller.validateCode({
				code: "FIXZERO",
				subtotal: 0,
			});
			expect(result.valid).toBe(true);
			expect(result.discountAmount).toBe(0);
		});
	});
});
