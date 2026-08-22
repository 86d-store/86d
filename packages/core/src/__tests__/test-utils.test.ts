import { beforeEach, describe, expect, it } from "vitest";
import {
	createMockDataService,
	createMockModuleContext,
	createMockSession,
	type MockDataService,
	makeControllerCtx,
} from "../test-utils";

// ── createMockDataService ──────────────────────────────────────────────────

describe("createMockDataService", () => {
	let data: MockDataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	describe("get", () => {
		it("returns null for nonexistent entity", async () => {
			const result = await data.get("product", "missing");
			expect(result).toBeNull();
		});

		it("returns entity after upsert", async () => {
			await data.upsert("product", "p1", { name: "Widget" });
			const result = await data.get("product", "p1");
			expect(result).toEqual({ name: "Widget" });
		});

		it("isolates entity types", async () => {
			await data.upsert("product", "p1", { name: "Widget" });
			const result = await data.get("order", "p1");
			expect(result).toBeNull();
		});
	});

	describe("upsert", () => {
		it("creates a new entity", async () => {
			await data.upsert("product", "p1", { name: "Widget" });
			expect(data.size("product")).toBe(1);
		});

		it("overwrites existing entity", async () => {
			await data.upsert("product", "p1", { name: "Widget" });
			await data.upsert("product", "p1", { name: "Updated Widget" });

			const result = await data.get("product", "p1");
			expect(result).toEqual({ name: "Updated Widget" });
			expect(data.size("product")).toBe(1);
		});

		it("handles multiple entity types independently", async () => {
			await data.upsert("product", "p1", { name: "Widget" });
			await data.upsert("order", "o1", { status: "pending" });

			expect(data.size("product")).toBe(1);
			expect(data.size("order")).toBe(1);
		});
	});

	describe("delete", () => {
		it("removes an existing entity", async () => {
			await data.upsert("product", "p1", { name: "Widget" });
			await data.delete("product", "p1");

			const result = await data.get("product", "p1");
			expect(result).toBeNull();
			expect(data.size("product")).toBe(0);
		});

		it("is a no-op for nonexistent entity", async () => {
			await data.delete("product", "missing");
			expect(data.size("product")).toBe(0);
		});
	});

	describe("findMany", () => {
		beforeEach(async () => {
			await data.upsert("product", "p1", {
				name: "Widget",
				price: 999,
				status: "active",
			});
			await data.upsert("product", "p2", {
				name: "Gadget",
				price: 1999,
				status: "draft",
			});
			await data.upsert("product", "p3", {
				name: "Doohickey",
				price: 2999,
				status: "active",
			});
		});

		it("returns all entities of a given type", async () => {
			const results = await data.findMany("product");
			expect(results).toHaveLength(3);
		});

		it("returns empty array for unknown entity type", async () => {
			const results = await data.findMany("unknown");
			expect(results).toEqual([]);
		});

		it("filters with where clause (single field)", async () => {
			const results = await data.findMany("product", {
				where: { status: "active" },
			});
			expect(results).toHaveLength(2);
			expect(results.every((r) => r.status === "active")).toBe(true);
		});

		it("filters with where clause (multiple fields)", async () => {
			const results = await data.findMany("product", {
				where: { status: "active", price: 999 },
			});
			expect(results).toHaveLength(1);
			expect(results[0].name).toBe("Widget");
		});

		it("ignores undefined values in where clause", async () => {
			const results = await data.findMany("product", {
				where: { status: "active", category: undefined },
			});
			expect(results).toHaveLength(2);
		});

		it("supports take (limit)", async () => {
			const results = await data.findMany("product", { take: 2 });
			expect(results).toHaveLength(2);
		});

		it("supports skip (offset)", async () => {
			const results = await data.findMany("product", { skip: 2 });
			expect(results).toHaveLength(1);
		});

		it("supports take + skip together", async () => {
			const results = await data.findMany("product", { skip: 1, take: 1 });
			expect(results).toHaveLength(1);
		});

		it("combines where with take/skip", async () => {
			const results = await data.findMany("product", {
				where: { status: "active" },
				take: 1,
			});
			expect(results).toHaveLength(1);
			expect(results[0].status).toBe("active");
		});

		it("does not mix entity types", async () => {
			await data.upsert("order", "o1", { status: "active" });
			const results = await data.findMany("product", {
				where: { status: "active" },
			});
			expect(results).toHaveLength(2);
		});
	});

	describe("_store (internal access)", () => {
		it("exposes the backing store", () => {
			expect(data._store).toBeInstanceOf(Map);
			expect(data._store.size).toBe(0);
		});

		it("reflects upserts", async () => {
			await data.upsert("product", "p1", { name: "Widget" });
			expect(data._store.has("product:p1")).toBe(true);
		});

		it("allows direct manipulation for test setup", () => {
			data._store.set("product:p1", { name: "Injected" });
			return data.get("product", "p1").then((result) => {
				expect((result as Record<string, unknown>).name).toBe("Injected");
			});
		});
	});

	describe("clear", () => {
		it("removes all data", async () => {
			await data.upsert("product", "p1", { name: "Widget" });
			await data.upsert("order", "o1", { status: "pending" });
			data.clear();

			expect(data._store.size).toBe(0);
			expect(await data.get("product", "p1")).toBeNull();
		});
	});

	describe("size", () => {
		it("counts entities of a specific type", async () => {
			await data.upsert("product", "p1", { name: "A" });
			await data.upsert("product", "p2", { name: "B" });
			await data.upsert("order", "o1", { status: "pending" });

			expect(data.size("product")).toBe(2);
			expect(data.size("order")).toBe(1);
			expect(data.size("missing")).toBe(0);
		});
	});

	describe("all", () => {
		it("returns all entities of a specific type", async () => {
			await data.upsert("product", "p1", { name: "A" });
			await data.upsert("product", "p2", { name: "B" });
			await data.upsert("order", "o1", { status: "pending" });

			const products = data.all("product");
			expect(products).toHaveLength(2);
			expect(
				products.map((p) => p.name).sort((a, b) => a.localeCompare(b)),
			).toEqual(["A", "B"]);
		});

		it("returns empty array for unknown type", () => {
			expect(data.all("missing")).toEqual([]);
		});
	});
});

// ── createMockModuleContext ────────────────────────────────────────────────

describe("createMockModuleContext", () => {
	it("creates context with sensible defaults", () => {
		const ctx = createMockModuleContext();
		expect(ctx.data).toBeDefined();
		expect(ctx.modules).toEqual([]);
		expect(ctx.options).toEqual({});
		expect(ctx.session).toBeNull();
		expect(ctx.controllers).toEqual({});
		expect(ctx.storeId).toBe("test-store");
	});

	it("accepts custom data service", () => {
		const data = createMockDataService();
		const ctx = createMockModuleContext({ data });
		expect(ctx.data).toBe(data);
	});

	it("accepts custom modules list", () => {
		const ctx = createMockModuleContext({ modules: ["products", "cart"] });
		expect(ctx.modules).toEqual(["products", "cart"]);
	});

	it("accepts custom options", () => {
		const ctx = createMockModuleContext({
			options: { pageSize: 20 },
		});
		expect(ctx.options).toEqual({ pageSize: 20 });
	});

	it("accepts custom session", () => {
		const session = createMockSession();
		const ctx = createMockModuleContext({ session });
		expect(ctx.session).toBe(session);
	});

	it("accepts custom controllers", () => {
		const controllers = {
			product: { getById: async () => null },
		};
		const ctx = createMockModuleContext({ controllers });
		expect(ctx.controllers).toBe(controllers);
	});

	it("accepts custom storeId", () => {
		const ctx = createMockModuleContext({ storeId: "store_abc" });
		expect(ctx.storeId).toBe("store_abc");
	});
});

// ── createMockSession ──────────────────────────────────────────────────────

describe("createMockSession", () => {
	it("creates session with sensible defaults", () => {
		const session = createMockSession();

		expect(session.session.userId).toBe("user_test");
		expect(session.session.id).toBe("sess_user_test");
		expect(session.session.token).toBe("tok_user_test");
		expect(session.session.expiresAt.getTime()).toBeGreaterThan(Date.now());
		expect(session.user.id).toBe("user_test");
		expect(session.user.email).toBe("test@example.com");
		expect(session.user.name).toBe("Test User");
		expect(session.user.emailVerified).toBe(true);
		expect(session.user.banned).toBe(false);
		expect(session.user.role).toBe("admin");
	});

	it("accepts custom userId", () => {
		const session = createMockSession({ userId: "user_abc" });
		expect(session.session.userId).toBe("user_abc");
		expect(session.user.id).toBe("user_abc");
		expect(session.session.id).toBe("sess_user_abc");
	});

	it("accepts custom email", () => {
		const session = createMockSession({ email: "admin@store.com" });
		expect(session.user.email).toBe("admin@store.com");
	});

	it("accepts custom name", () => {
		const session = createMockSession({ name: "Jane Doe" });
		expect(session.user.name).toBe("Jane Doe");
	});

	it("accepts custom role", () => {
		const session = createMockSession({ role: "owner" });
		expect(session.user.role).toBe("owner");
	});

	it("has valid date fields", () => {
		const session = createMockSession();
		expect(session.session.createdAt).toBeInstanceOf(Date);
		expect(session.session.updatedAt).toBeInstanceOf(Date);
		expect(session.session.expiresAt).toBeInstanceOf(Date);
		expect(session.user.createdAt).toBeInstanceOf(Date);
		expect(session.user.updatedAt).toBeInstanceOf(Date);
	});
});

// ── makeControllerCtx ──────────────────────────────────────────────────────

describe("makeControllerCtx", () => {
	it("creates ctx with data service and defaults", () => {
		const data = createMockDataService();
		const ctx = makeControllerCtx(data);

		expect(ctx.context.data).toBe(data);
		expect(ctx.params).toEqual({});
		expect(ctx.query).toEqual({});
		expect(ctx.body).toEqual({});
	});

	it("accepts params override", () => {
		const data = createMockDataService();
		const ctx = makeControllerCtx(data, { params: { id: "prod_1" } });
		expect(ctx.params).toEqual({ id: "prod_1" });
	});

	it("accepts query override", () => {
		const data = createMockDataService();
		const ctx = makeControllerCtx(data, { query: { status: "active" } });
		expect(ctx.query).toEqual({ status: "active" });
	});

	it("accepts body override", () => {
		const data = createMockDataService();
		const ctx = makeControllerCtx(data, { body: { name: "Widget" } });
		expect(ctx.body).toEqual({ name: "Widget" });
	});

	it("accepts full ModuleContext", () => {
		const moduleCtx = createMockModuleContext({ storeId: "store_xyz" });
		const ctx = makeControllerCtx(moduleCtx, { params: { id: "p1" } });

		// Should pass through the full context
		expect((ctx.context as Record<string, unknown>).storeId).toBe("store_xyz");
		expect(ctx.context.data).toBe(moduleCtx.data);
	});

	it("works with all options combined", () => {
		const data = createMockDataService();
		const ctx = makeControllerCtx(data, {
			params: { id: "p1" },
			query: { page: "2" },
			body: { name: "X" },
		});

		expect(ctx.params.id).toBe("p1");
		expect(ctx.query.page).toBe("2");
		expect(ctx.body.name).toBe("X");
	});
});
