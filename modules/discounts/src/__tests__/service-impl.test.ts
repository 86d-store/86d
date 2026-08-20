import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createDiscountController } from "../service-impl";

describe("createDiscountController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createDiscountController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createDiscountController(mockData);
	});

	describe("create", () => {
		it("creates a percentage discount", async () => {
			const discount = await controller.create({
				name: "Summer Sale",
				type: "percentage",
				value: 20,
			});

			expect(discount.name).toBe("Summer Sale");
			expect(discount.type).toBe("percentage");
			expect(discount.value).toBe(20);
			expect(discount.isActive).toBe(true);
			expect(discount.usedCount).toBe(0);
			expect(discount.appliesTo).toBe("all");
			expect(discount.stackable).toBe(false);
		});

		it("creates a fixed amount discount", async () => {
			const discount = await controller.create({
				name: "$10 off",
				type: "fixed_amount",
				value: 1000,
				minimumAmount: 5000,
			});

			expect(discount.type).toBe("fixed_amount");
			expect(discount.value).toBe(1000);
			expect(discount.minimumAmount).toBe(5000);
		});

		it("creates a free shipping discount", async () => {
			const discount = await controller.create({
				name: "Free Shipping",
				type: "free_shipping",
				value: 0,
			});

			expect(discount.type).toBe("free_shipping");
		});

		it("uses provided ID when given", async () => {
			const discount = await controller.create({
				id: "disc_custom123",
				name: "Custom ID",
				type: "percentage",
				value: 5,
			});
			expect(discount.id).toBe("disc_custom123");
		});

		it("stores all optional fields", async () => {
			const startsAt = new Date("2025-01-01");
			const endsAt = new Date("2025-12-31");
			const discount = await controller.create({
				name: "Full Options",
				type: "percentage",
				value: 15,
				description: "A detailed description",
				startsAt,
				endsAt,
				appliesTo: "specific_products",
				appliesToIds: ["prod_1", "prod_2"],
				stackable: true,
				metadata: { campaign: "winter" },
			});

			expect(discount.description).toBe("A detailed description");
			expect(discount.startsAt).toEqual(startsAt);
			expect(discount.endsAt).toEqual(endsAt);
			expect(discount.appliesTo).toBe("specific_products");
			expect(discount.appliesToIds).toEqual(["prod_1", "prod_2"]);
			expect(discount.stackable).toBe(true);
			expect(discount.metadata).toEqual({ campaign: "winter" });
		});

		it("sets timestamps on creation", async () => {
			const discount = await controller.create({
				name: "Timed",
				type: "percentage",
				value: 10,
			});
			expect(discount.createdAt).toBeInstanceOf(Date);
			expect(discount.updatedAt).toBeInstanceOf(Date);
		});
	});

	describe("getById", () => {
		it("returns null for non-existent discount", async () => {
			const result = await controller.getById("non-existent");
			expect(result).toBeNull();
		});

		it("returns discount by id", async () => {
			const created = await controller.create({
				name: "Test Discount",
				type: "percentage",
				value: 10,
			});

			const found = await controller.getById(created.id);
			expect(found?.name).toBe("Test Discount");
		});
	});

	describe("update", () => {
		it("updates discount fields", async () => {
			const created = await controller.create({
				name: "Old Name",
				type: "percentage",
				value: 10,
			});

			const updated = await controller.update(created.id, {
				name: "New Name",
				value: 25,
				isActive: false,
			});

			expect(updated?.name).toBe("New Name");
			expect(updated?.value).toBe(25);
			expect(updated?.isActive).toBe(false);
		});

		it("returns null for non-existent discount", async () => {
			const result = await controller.update("non-existent", { name: "test" });
			expect(result).toBeNull();
		});

		it("preserves unchanged fields", async () => {
			const created = await controller.create({
				name: "Keep Fields",
				type: "percentage",
				value: 10,
				description: "Original description",
			});

			const updated = await controller.update(created.id, {
				name: "Updated Name",
			});

			expect(updated?.name).toBe("Updated Name");
			expect(updated?.type).toBe("percentage");
			expect(updated?.value).toBe(10);
			expect(updated?.description).toBe("Original description");
		});

		it("advances updatedAt timestamp", async () => {
			const created = await controller.create({
				name: "Timed",
				type: "percentage",
				value: 10,
			});
			await new Promise((r) => setTimeout(r, 1));
			const updated = await controller.update(created.id, { value: 20 });
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				created.updatedAt.getTime(),
			);
		});
	});

	describe("delete", () => {
		it("deletes a discount and its codes", async () => {
			const discount = await controller.create({
				name: "To Delete",
				type: "percentage",
				value: 5,
			});

			await controller.createCode({ discountId: discount.id, code: "DEL1" });
			await controller.createCode({ discountId: discount.id, code: "DEL2" });

			await controller.delete(discount.id);

			expect(await controller.getById(discount.id)).toBeNull();
			expect(await controller.listCodes(discount.id)).toHaveLength(0);
		});

		it("deletes a discount with no codes", async () => {
			const discount = await controller.create({
				name: "No Codes",
				type: "percentage",
				value: 5,
			});

			await controller.delete(discount.id);
			expect(await controller.getById(discount.id)).toBeNull();
		});
	});

	describe("list", () => {
		beforeEach(async () => {
			await controller.create({
				name: "Active 1",
				type: "percentage",
				value: 10,
				isActive: true,
			});
			await controller.create({
				name: "Active 2",
				type: "fixed_amount",
				value: 500,
				isActive: true,
			});
			await controller.create({
				name: "Inactive",
				type: "percentage",
				value: 5,
				isActive: false,
			});
		});

		it("lists all discounts", async () => {
			const { total } = await controller.list({});
			expect(total).toBe(3);
		});

		it("filters by isActive", async () => {
			const { discounts, total } = await controller.list({ isActive: true });
			expect(total).toBe(2);
			expect(discounts.every((d) => d.isActive)).toBe(true);
		});

		it("paginates results", async () => {
			const { discounts, total } = await controller.list({
				limit: 2,
				offset: 0,
			});
			expect(total).toBe(3);
			expect(discounts).toHaveLength(2);
		});

		it("paginates with offset skipping first results", async () => {
			const { discounts, total } = await controller.list({
				limit: 2,
				offset: 2,
			});
			expect(total).toBe(3);
			expect(discounts).toHaveLength(1);
		});

		it("sorts by createdAt descending", async () => {
			const { discounts } = await controller.list({});
			for (let i = 0; i < discounts.length - 1; i++) {
				const current = discounts[i];
				const next = discounts[i + 1];
				expect(current?.createdAt.getTime()).toBeGreaterThanOrEqual(
					next?.createdAt.getTime() ?? 0,
				);
			}
		});

		it("returns empty list when no discounts exist", async () => {
			const freshData = createMockDataService();
			const freshCtrl = createDiscountController(freshData);
			const { discounts, total } = await freshCtrl.list({});
			expect(total).toBe(0);
			expect(discounts).toHaveLength(0);
		});
	});

	describe("codes", () => {
		let discountId: string;

		beforeEach(async () => {
			const discount = await controller.create({
				name: "With Codes",
				type: "percentage",
				value: 15,
			});
			discountId = discount.id;
		});

		it("creates a promo code (uppercased)", async () => {
			const code = await controller.createCode({
				discountId,
				code: "summer2024",
			});

			expect(code.code).toBe("SUMMER2024");
			expect(code.usedCount).toBe(0);
			expect(code.isActive).toBe(true);
		});

		it("finds code by value", async () => {
			await controller.createCode({ discountId, code: "FINDME" });
			const found = await controller.getCodeByValue("findme"); // case-insensitive
			expect(found?.code).toBe("FINDME");
		});

		it("lists codes for a discount", async () => {
			await controller.createCode({ discountId, code: "CODE1" });
			await controller.createCode({ discountId, code: "CODE2" });
			const codes = await controller.listCodes(discountId);
			expect(codes).toHaveLength(2);
		});

		it("deletes a code", async () => {
			const code = await controller.createCode({ discountId, code: "DELME" });
			await controller.deleteCode(code.id);
			const found = await controller.getCodeByValue("DELME");
			expect(found).toBeNull();
		});

		it("trims whitespace from code", async () => {
			const code = await controller.createCode({
				discountId,
				code: "  PADDED  ",
			});
			expect(code.code).toBe("PADDED");
		});

		it("returns null for non-existent code", async () => {
			const found = await controller.getCodeByValue("NONEXISTENT");
			expect(found).toBeNull();
		});

		it("creates code with maximumUses", async () => {
			const code = await controller.createCode({
				discountId,
				code: "LIMITED",
				maximumUses: 5,
			});
			expect(code.maximumUses).toBe(5);
		});

		it("creates inactive code", async () => {
			const code = await controller.createCode({
				discountId,
				code: "INACTIVE",
				isActive: false,
			});
			expect(code.isActive).toBe(false);
		});
	});

	describe("validateCode", () => {
		let discountId: string;

		beforeEach(async () => {
			const discount = await controller.create({
				name: "20% Off",
				type: "percentage",
				value: 20,
				minimumAmount: 1000,
			});
			discountId = discount.id;
			await controller.createCode({ discountId, code: "SAVE20" });
		});

		it("returns valid result with correct discount amount", async () => {
			const result = await controller.validateCode({
				code: "SAVE20",
				subtotal: 5000,
			});

			expect(result.valid).toBe(true);
			expect(result.discountAmount).toBe(1000); // 20% of 5000
			expect(result.freeShipping).toBe(false);
		});

		it("fails for invalid code", async () => {
			const result = await controller.validateCode({
				code: "INVALID",
				subtotal: 5000,
			});

			expect(result.valid).toBe(false);
			expect(result.error).toBeTruthy();
		});

		it("fails below minimum amount", async () => {
			const result = await controller.validateCode({
				code: "SAVE20",
				subtotal: 500,
			});

			expect(result.valid).toBe(false);
			expect(result.error).toContain("1000");
		});

		it("fails for inactive discount", async () => {
			await controller.update(discountId, { isActive: false });

			const result = await controller.validateCode({
				code: "SAVE20",
				subtotal: 5000,
			});

			expect(result.valid).toBe(false);
		});

		it("fails for inactive code", async () => {
			const code = await controller.getCodeByValue("SAVE20");
			if (code) {
				// Deactivate by replacing with inactive version
				const updated = { ...code, isActive: false };
				await mockData.upsert("discountCode", code.id, updated);
			}

			const result = await controller.validateCode({
				code: "SAVE20",
				subtotal: 5000,
			});

			expect(result.valid).toBe(false);
		});

		it("respects maximum uses limit", async () => {
			const discount = await controller.create({
				name: "Limited",
				type: "fixed_amount",
				value: 500,
				maximumUses: 1,
			});
			await controller.createCode({ discountId: discount.id, code: "LIMITED" });

			// First use exhausts the limit
			await controller.applyCode({ code: "LIMITED", subtotal: 5000 });

			const result = await controller.validateCode({
				code: "LIMITED",
				subtotal: 5000,
			});

			expect(result.valid).toBe(false);
		});

		it("validates free shipping discount", async () => {
			const discount = await controller.create({
				name: "Free Shipping",
				type: "free_shipping",
				value: 0,
			});
			await controller.createCode({
				discountId: discount.id,
				code: "FREESHIP",
			});

			const result = await controller.validateCode({
				code: "FREESHIP",
				subtotal: 2000,
			});

			expect(result.valid).toBe(true);
			expect(result.freeShipping).toBe(true);
			expect(result.discountAmount).toBe(0);
		});

		it("validates fixed amount discount (capped at subtotal)", async () => {
			const discount = await controller.create({
				name: "$20 off",
				type: "fixed_amount",
				value: 2000,
			});
			await controller.createCode({ discountId: discount.id, code: "20OFF" });

			// Subtotal 500 < discount 2000 → capped at 500
			const result = await controller.validateCode({
				code: "20OFF",
				subtotal: 500,
			});

			expect(result.valid).toBe(true);
			expect(result.discountAmount).toBe(500);
		});

		it("filters by appliesTo specific products", async () => {
			const discount = await controller.create({
				name: "Product discount",
				type: "percentage",
				value: 10,
				appliesTo: "specific_products",
				appliesToIds: ["prod_abc"],
			});
			await controller.createCode({
				discountId: discount.id,
				code: "PRODONLY",
			});

			// No matching product
			const noMatch = await controller.validateCode({
				code: "PRODONLY",
				subtotal: 5000,
				productIds: ["prod_xyz"],
			});
			expect(noMatch.valid).toBe(false);

			// Matching product
			const match = await controller.validateCode({
				code: "PRODONLY",
				subtotal: 5000,
				productIds: ["prod_abc"],
			});
			expect(match.valid).toBe(true);
			expect(match.discountAmount).toBe(500);
		});

		it("filters by appliesTo specific categories", async () => {
			const discount = await controller.create({
				name: "Category discount",
				type: "percentage",
				value: 15,
				appliesTo: "specific_categories",
				appliesToIds: ["cat_shoes"],
			});
			await controller.createCode({
				discountId: discount.id,
				code: "CATONLY",
			});

			const noMatch = await controller.validateCode({
				code: "CATONLY",
				subtotal: 5000,
				categoryIds: ["cat_hats"],
			});
			expect(noMatch.valid).toBe(false);

			const match = await controller.validateCode({
				code: "CATONLY",
				subtotal: 5000,
				categoryIds: ["cat_shoes"],
			});
			expect(match.valid).toBe(true);
		});

		it("fails when discount has not yet started", async () => {
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);
			const discount = await controller.create({
				name: "Future",
				type: "percentage",
				value: 10,
				startsAt: tomorrow,
			});
			await controller.createCode({
				discountId: discount.id,
				code: "FUTURE",
			});

			const result = await controller.validateCode({
				code: "FUTURE",
				subtotal: 5000,
			});
			expect(result.valid).toBe(false);
		});

		it("fails when discount has expired", async () => {
			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);
			const discount = await controller.create({
				name: "Expired",
				type: "percentage",
				value: 10,
				endsAt: yesterday,
			});
			await controller.createCode({
				discountId: discount.id,
				code: "EXPIRED",
			});

			const result = await controller.validateCode({
				code: "EXPIRED",
				subtotal: 5000,
			});
			expect(result.valid).toBe(false);
		});

		it("per-code usage limit prevents validation", async () => {
			const discount = await controller.create({
				name: "Code Limited",
				type: "percentage",
				value: 10,
			});
			await controller.createCode({
				discountId: discount.id,
				code: "CODELIMIT",
				maximumUses: 1,
			});

			await controller.applyCode({ code: "CODELIMIT", subtotal: 5000 });

			const result = await controller.validateCode({
				code: "CODELIMIT",
				subtotal: 5000,
			});
			expect(result.valid).toBe(false);
		});

		it("returns discount and code objects on success", async () => {
			const result = await controller.validateCode({
				code: "SAVE20",
				subtotal: 5000,
			});
			expect(result.valid).toBe(true);
			expect(result.discount).toBeDefined();
			expect(result.code).toBeDefined();
			expect(result.discount?.name).toBe("20% Off");
			expect(result.code?.code).toBe("SAVE20");
		});
	});

	describe("applyCode", () => {
		let discountId: string;

		beforeEach(async () => {
			const discount = await controller.create({
				name: "10% Off",
				type: "percentage",
				value: 10,
			});
			discountId = discount.id;
			await controller.createCode({ discountId, code: "APPLY10" });
		});

		it("increments usage counters", async () => {
			await controller.applyCode({ code: "APPLY10", subtotal: 3000 });

			const discount = await controller.getById(discountId);
			const code = await controller.getCodeByValue("APPLY10");

			expect(discount?.usedCount).toBe(1);
			expect(code?.usedCount).toBe(1);
		});

		it("returns correct discount amount", async () => {
			const result = await controller.applyCode({
				code: "APPLY10",
				subtotal: 3000,
			});

			expect(result.valid).toBe(true);
			expect(result.discountAmount).toBe(300); // 10% of 3000
		});

		it("fails for invalid code without incrementing", async () => {
			const result = await controller.applyCode({
				code: "INVALID",
				subtotal: 3000,
			});

			expect(result.valid).toBe(false);
		});

		it("enforces per-code usage limit", async () => {
			const d = await controller.create({
				name: "One Use",
				type: "fixed_amount",
				value: 100,
			});
			await controller.createCode({
				discountId: d.id,
				code: "ONEUSE",
				maximumUses: 1,
			});

			// First use
			const first = await controller.applyCode({
				code: "ONEUSE",
				subtotal: 1000,
			});
			expect(first.valid).toBe(true);

			// Second use should fail
			const second = await controller.validateCode({
				code: "ONEUSE",
				subtotal: 1000,
			});
			expect(second.valid).toBe(false);
		});

		it("applies fixed amount discount", async () => {
			const d = await controller.create({
				name: "$5 Off",
				type: "fixed_amount",
				value: 500,
			});
			await controller.createCode({
				discountId: d.id,
				code: "FIXED5",
			});

			const result = await controller.applyCode({
				code: "FIXED5",
				subtotal: 3000,
			});
			expect(result.valid).toBe(true);
			expect(result.discountAmount).toBe(500);
		});

		it("applies free shipping discount", async () => {
			const d = await controller.create({
				name: "Free Ship",
				type: "free_shipping",
				value: 0,
			});
			await controller.createCode({
				discountId: d.id,
				code: "FREESHIP2",
			});

			const result = await controller.applyCode({
				code: "FREESHIP2",
				subtotal: 3000,
			});
			expect(result.valid).toBe(true);
			expect(result.freeShipping).toBe(true);
			expect(result.discountAmount).toBe(0);
		});

		it("increments counters on multiple applications", async () => {
			const d = await controller.create({
				name: "Multi Use",
				type: "percentage",
				value: 5,
			});
			await controller.createCode({
				discountId: d.id,
				code: "MULTI",
			});

			await controller.applyCode({ code: "MULTI", subtotal: 1000 });
			await controller.applyCode({ code: "MULTI", subtotal: 2000 });
			await controller.applyCode({ code: "MULTI", subtotal: 3000 });

			const discount = await controller.getById(d.id);
			const code = await controller.getCodeByValue("MULTI");
			expect(discount?.usedCount).toBe(3);
			expect(code?.usedCount).toBe(3);
		});
	});

	describe("getAnalytics", () => {
		it("returns zeroed analytics when no discounts exist", async () => {
			const freshData = createMockDataService();
			const freshCtrl = createDiscountController(freshData);
			const analytics = await freshCtrl.getAnalytics();

			expect(analytics.totalDiscounts).toBe(0);
			expect(analytics.activeCount).toBe(0);
			expect(analytics.expiredCount).toBe(0);
			expect(analytics.scheduledCount).toBe(0);
			expect(analytics.totalUsage).toBe(0);
			expect(analytics.totalCodes).toBe(0);
			expect(analytics.topByUsage).toHaveLength(0);
		});

		it("counts active discounts", async () => {
			await controller.create({
				name: "Active 1",
				type: "percentage",
				value: 10,
				isActive: true,
			});
			await controller.create({
				name: "Active 2",
				type: "fixed_amount",
				value: 500,
				isActive: true,
			});

			const analytics = await controller.getAnalytics();
			expect(analytics.activeCount).toBe(2);
			expect(analytics.totalDiscounts).toBe(2);
		});

		it("counts expired/inactive discounts", async () => {
			await controller.create({
				name: "Inactive",
				type: "percentage",
				value: 10,
				isActive: false,
			});

			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);
			await controller.create({
				name: "Expired",
				type: "fixed_amount",
				value: 500,
				isActive: true,
				endsAt: yesterday,
			});

			const analytics = await controller.getAnalytics();
			expect(analytics.expiredCount).toBe(2);
			expect(analytics.activeCount).toBe(0);
		});

		it("counts scheduled discounts", async () => {
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);

			await controller.create({
				name: "Future",
				type: "percentage",
				value: 10,
				isActive: true,
				startsAt: tomorrow,
			});

			const analytics = await controller.getAnalytics();
			expect(analytics.scheduledCount).toBe(1);
			expect(analytics.activeCount).toBe(0);
		});

		it("counts discounts exhausted by maximumUses as expired", async () => {
			const d = await controller.create({
				name: "Limited",
				type: "percentage",
				value: 10,
				maximumUses: 1,
			});
			await controller.createCode({ discountId: d.id, code: "LIM" });
			await controller.applyCode({ code: "LIM", subtotal: 5000 });

			const analytics = await controller.getAnalytics();
			expect(analytics.expiredCount).toBe(1);
			expect(analytics.activeCount).toBe(0);
		});

		it("computes type distribution", async () => {
			await controller.create({
				name: "Pct 1",
				type: "percentage",
				value: 10,
			});
			await controller.create({
				name: "Pct 2",
				type: "percentage",
				value: 20,
			});
			await controller.create({
				name: "Fixed",
				type: "fixed_amount",
				value: 500,
			});
			await controller.create({
				name: "Ship",
				type: "free_shipping",
				value: 0,
			});

			const analytics = await controller.getAnalytics();
			expect(analytics.typeDistribution.percentage).toBe(2);
			expect(analytics.typeDistribution.fixed_amount).toBe(1);
			expect(analytics.typeDistribution.free_shipping).toBe(1);
		});

		it("sums total usage across all discounts", async () => {
			const d1 = await controller.create({
				name: "D1",
				type: "percentage",
				value: 10,
			});
			await controller.createCode({ discountId: d1.id, code: "D1CODE" });
			await controller.applyCode({ code: "D1CODE", subtotal: 5000 });
			await controller.applyCode({ code: "D1CODE", subtotal: 5000 });

			const d2 = await controller.create({
				name: "D2",
				type: "fixed_amount",
				value: 500,
			});
			await controller.createCode({ discountId: d2.id, code: "D2CODE" });
			await controller.applyCode({ code: "D2CODE", subtotal: 5000 });

			const analytics = await controller.getAnalytics();
			expect(analytics.totalUsage).toBe(3);
		});

		it("counts total promo codes", async () => {
			const d = await controller.create({
				name: "Multi Code",
				type: "percentage",
				value: 10,
			});
			await controller.createCode({ discountId: d.id, code: "CODE1" });
			await controller.createCode({ discountId: d.id, code: "CODE2" });
			await controller.createCode({ discountId: d.id, code: "CODE3" });

			const analytics = await controller.getAnalytics();
			expect(analytics.totalCodes).toBe(3);
		});

		it("returns top discounts sorted by usage descending", async () => {
			const low = await controller.create({
				name: "Low Usage",
				type: "percentage",
				value: 5,
			});
			await controller.createCode({ discountId: low.id, code: "LOW" });
			await controller.applyCode({ code: "LOW", subtotal: 5000 });

			const high = await controller.create({
				name: "High Usage",
				type: "percentage",
				value: 10,
			});
			await controller.createCode({ discountId: high.id, code: "HIGH" });
			await controller.applyCode({ code: "HIGH", subtotal: 5000 });
			await controller.applyCode({ code: "HIGH", subtotal: 5000 });
			await controller.applyCode({ code: "HIGH", subtotal: 5000 });

			const analytics = await controller.getAnalytics();
			expect(analytics.topByUsage[0]?.name).toBe("High Usage");
			expect(analytics.topByUsage[0]?.usedCount).toBe(3);
			expect(analytics.topByUsage[1]?.name).toBe("Low Usage");
			expect(analytics.topByUsage[1]?.usedCount).toBe(1);
		});

		it("includes codes count per discount in summaries", async () => {
			const d = await controller.create({
				name: "With Codes",
				type: "percentage",
				value: 10,
			});
			await controller.createCode({ discountId: d.id, code: "A" });
			await controller.createCode({ discountId: d.id, code: "B" });

			const analytics = await controller.getAnalytics();
			const summary = analytics.topByUsage.find((s) => s.id === d.id);
			expect(summary?.codesCount).toBe(2);
		});

		it("limits topByUsage to 10 entries", async () => {
			for (let i = 0; i < 15; i++) {
				await controller.create({
					name: `Discount ${i}`,
					type: "percentage",
					value: 5 + i,
				});
			}

			const analytics = await controller.getAnalytics();
			expect(analytics.topByUsage.length).toBeLessThanOrEqual(10);
			expect(analytics.totalDiscounts).toBe(15);
		});

		it("includes all summary fields in topByUsage", async () => {
			const d = await controller.create({
				name: "Full Fields",
				type: "fixed_amount",
				value: 1000,
				maximumUses: 50,
			});
			await controller.createCode({ discountId: d.id, code: "FULL" });
			await controller.applyCode({ code: "FULL", subtotal: 5000 });

			const analytics = await controller.getAnalytics();
			const summary = analytics.topByUsage.find((s) => s.id === d.id);
			expect(summary).toBeDefined();
			expect(summary?.name).toBe("Full Fields");
			expect(summary?.type).toBe("fixed_amount");
			expect(summary?.value).toBe(1000);
			expect(summary?.usedCount).toBe(1);
			expect(summary?.maximumUses).toBe(50);
			expect(summary?.isActive).toBe(true);
			expect(summary?.codesCount).toBe(1);
		});
	});

	describe("updateCode", () => {
		let discountId: string;

		beforeEach(async () => {
			const discount = await controller.create({
				name: "Update Code Test",
				type: "percentage",
				value: 10,
			});
			discountId = discount.id;
		});

		it("toggles code active state", async () => {
			const code = await controller.createCode({
				discountId,
				code: "TOGGLE",
			});
			expect(code.isActive).toBe(true);

			const updated = await controller.updateCode(code.id, {
				isActive: false,
			});
			expect(updated?.isActive).toBe(false);

			const reactivated = await controller.updateCode(code.id, {
				isActive: true,
			});
			expect(reactivated?.isActive).toBe(true);
		});

		it("updates maximum uses", async () => {
			const code = await controller.createCode({
				discountId,
				code: "MAXUPDATE",
			});
			expect(code.maximumUses).toBeUndefined();

			const updated = await controller.updateCode(code.id, {
				maximumUses: 50,
			});
			expect(updated?.maximumUses).toBe(50);
		});

		it("clears maximum uses with null", async () => {
			const code = await controller.createCode({
				discountId,
				code: "CLEARLIMIT",
				maximumUses: 10,
			});
			expect(code.maximumUses).toBe(10);

			const updated = await controller.updateCode(code.id, {
				maximumUses: null,
			});
			expect(updated?.maximumUses).toBeUndefined();
		});

		it("returns null for non-existent code", async () => {
			const result = await controller.updateCode("non-existent", {
				isActive: false,
			});
			expect(result).toBeNull();
		});

		it("advances updatedAt timestamp", async () => {
			const code = await controller.createCode({
				discountId,
				code: "TIMED",
			});
			await new Promise((r) => setTimeout(r, 1));
			const updated = await controller.updateCode(code.id, {
				isActive: false,
			});
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				code.updatedAt.getTime(),
			);
		});

		it("preserves unchanged fields", async () => {
			const code = await controller.createCode({
				discountId,
				code: "PRESERVE",
				maximumUses: 5,
			});

			const updated = await controller.updateCode(code.id, {
				isActive: false,
			});
			expect(updated?.maximumUses).toBe(5);
			expect(updated?.code).toBe("PRESERVE");
			expect(updated?.discountId).toBe(discountId);
		});
	});

	describe("generateBulkCodes", () => {
		let discountId: string;

		beforeEach(async () => {
			const discount = await controller.create({
				name: "Bulk Test",
				type: "percentage",
				value: 15,
			});
			discountId = discount.id;
		});

		it("generates the requested number of codes", async () => {
			const result = await controller.generateBulkCodes({
				discountId,
				count: 5,
			});

			expect(result.generated).toBe(5);
			expect(result.codes).toHaveLength(5);
		});

		it("generates unique codes", async () => {
			const result = await controller.generateBulkCodes({
				discountId,
				count: 20,
			});

			const codeValues = result.codes.map((c) => c.code);
			const uniqueValues = new Set(codeValues);
			expect(uniqueValues.size).toBe(20);
		});

		it("applies prefix to generated codes", async () => {
			const result = await controller.generateBulkCodes({
				discountId,
				count: 3,
				prefix: "WINTER",
			});

			for (const code of result.codes) {
				expect(code.code.startsWith("WINTER-")).toBe(true);
			}
		});

		it("uppercases prefix", async () => {
			const result = await controller.generateBulkCodes({
				discountId,
				count: 1,
				prefix: "summer",
			});

			expect(result.codes[0]?.code.startsWith("SUMMER-")).toBe(true);
		});

		it("sets maximumUses on generated codes", async () => {
			const result = await controller.generateBulkCodes({
				discountId,
				count: 3,
				maximumUses: 1,
			});

			for (const code of result.codes) {
				expect(code.maximumUses).toBe(1);
			}
		});

		it("creates codes with zero usedCount and active status", async () => {
			const result = await controller.generateBulkCodes({
				discountId,
				count: 2,
			});

			for (const code of result.codes) {
				expect(code.usedCount).toBe(0);
				expect(code.isActive).toBe(true);
				expect(code.discountId).toBe(discountId);
			}
		});

		it("does not collide with existing codes", async () => {
			// Create some codes first
			await controller.createCode({ discountId, code: "EXISTING1" });
			await controller.createCode({ discountId, code: "EXISTING2" });

			const result = await controller.generateBulkCodes({
				discountId,
				count: 5,
			});

			const existingCodes = ["EXISTING1", "EXISTING2"];
			for (const code of result.codes) {
				expect(existingCodes).not.toContain(code.code);
			}
		});

		it("codes are stored and listable", async () => {
			await controller.generateBulkCodes({
				discountId,
				count: 3,
			});

			const allCodes = await controller.listCodes(discountId);
			expect(allCodes).toHaveLength(3);
		});

		it("generated codes are redeemable", async () => {
			const result = await controller.generateBulkCodes({
				discountId,
				count: 1,
				maximumUses: 1,
			});

			const codeValue = result.codes[0]?.code;
			expect(codeValue).toBeDefined();

			const validation = await controller.validateCode({
				code: codeValue as string,
				subtotal: 5000,
			});
			expect(validation.valid).toBe(true);
			expect(validation.discountAmount).toBe(750); // 15% of 5000
		});

		it("handles empty prefix", async () => {
			const result = await controller.generateBulkCodes({
				discountId,
				count: 1,
				prefix: "",
			});

			expect(result.codes[0]?.code).not.toContain("-");
		});
	});

	describe("getCodeStats", () => {
		let discountId: string;

		beforeEach(async () => {
			const discount = await controller.create({
				name: "Stats Test",
				type: "percentage",
				value: 10,
			});
			discountId = discount.id;
		});

		it("returns zeroed stats when no codes exist", async () => {
			const stats = await controller.getCodeStats(discountId);
			expect(stats.total).toBe(0);
			expect(stats.active).toBe(0);
			expect(stats.inactive).toBe(0);
			expect(stats.totalRedemptions).toBe(0);
			expect(stats.fullyUsed).toBe(0);
			expect(stats.unused).toBe(0);
			expect(stats.redemptionRate).toBe(0);
		});

		it("counts active and inactive codes", async () => {
			await controller.createCode({
				discountId,
				code: "ACTIVE1",
				isActive: true,
			});
			await controller.createCode({
				discountId,
				code: "ACTIVE2",
				isActive: true,
			});
			await controller.createCode({
				discountId,
				code: "INACTIVE1",
				isActive: false,
			});

			const stats = await controller.getCodeStats(discountId);
			expect(stats.total).toBe(3);
			expect(stats.active).toBe(2);
			expect(stats.inactive).toBe(1);
		});

		it("counts total redemptions across all codes", async () => {
			await controller.createCode({ discountId, code: "REDEEM1" });
			await controller.createCode({ discountId, code: "REDEEM2" });

			await controller.applyCode({ code: "REDEEM1", subtotal: 5000 });
			await controller.applyCode({ code: "REDEEM1", subtotal: 5000 });
			await controller.applyCode({ code: "REDEEM2", subtotal: 5000 });

			const stats = await controller.getCodeStats(discountId);
			expect(stats.totalRedemptions).toBe(3);
		});

		it("counts unused codes", async () => {
			await controller.createCode({ discountId, code: "USED" });
			await controller.createCode({ discountId, code: "UNUSED1" });
			await controller.createCode({ discountId, code: "UNUSED2" });

			await controller.applyCode({ code: "USED", subtotal: 5000 });

			const stats = await controller.getCodeStats(discountId);
			expect(stats.unused).toBe(2);
		});

		it("counts fully used codes", async () => {
			await controller.createCode({
				discountId,
				code: "ONETIME",
				maximumUses: 1,
			});
			await controller.createCode({
				discountId,
				code: "NOTFULL",
				maximumUses: 5,
			});

			await controller.applyCode({ code: "ONETIME", subtotal: 5000 });
			await controller.applyCode({ code: "NOTFULL", subtotal: 5000 });

			const stats = await controller.getCodeStats(discountId);
			expect(stats.fullyUsed).toBe(1); // ONETIME reached its limit
		});

		it("calculates redemption rate", async () => {
			await controller.createCode({ discountId, code: "RATE1" });
			await controller.createCode({ discountId, code: "RATE2" });
			await controller.createCode({ discountId, code: "RATE3" });
			await controller.createCode({ discountId, code: "RATE4" });

			// Use 2 out of 4 codes
			await controller.applyCode({ code: "RATE1", subtotal: 5000 });
			await controller.applyCode({ code: "RATE2", subtotal: 5000 });

			const stats = await controller.getCodeStats(discountId);
			expect(stats.redemptionRate).toBe(50); // 2/4 = 50%
		});

		it("returns 0% redemption rate for all unused codes", async () => {
			await controller.createCode({ discountId, code: "NOUSE1" });
			await controller.createCode({ discountId, code: "NOUSE2" });

			const stats = await controller.getCodeStats(discountId);
			expect(stats.redemptionRate).toBe(0);
		});

		it("returns 100% redemption rate when all codes used", async () => {
			await controller.createCode({ discountId, code: "ALL1" });
			await controller.createCode({ discountId, code: "ALL2" });

			await controller.applyCode({ code: "ALL1", subtotal: 5000 });
			await controller.applyCode({ code: "ALL2", subtotal: 5000 });

			const stats = await controller.getCodeStats(discountId);
			expect(stats.redemptionRate).toBe(100);
		});
	});
});
