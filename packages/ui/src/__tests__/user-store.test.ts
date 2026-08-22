import { configure } from "mobx";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createUserStore } from "../hooks/use-user";

// Disable strict mode for unit tests (no React reaction context)
let previousConfig: Parameters<typeof configure>[0];

beforeAll(() => {
	previousConfig = {
		enforceActions: "never" as const,
		computedRequiresReaction: false,
		reactionRequiresObservable: false,
		observableRequiresReaction: false,
	};
	configure(previousConfig);
});

afterAll(() => {
	configure({
		enforceActions: "never",
		computedRequiresReaction: false,
		reactionRequiresObservable: false,
		observableRequiresReaction: false,
	});
});

describe("createUserStore", () => {
	let store: ReturnType<typeof createUserStore>;

	beforeEach(() => {
		store = createUserStore();
	});

	it("starts with loading state and empty permissions", () => {
		expect(store.isLoading).toBe(true);
		expect(store.permissions).toEqual({});
		expect(store.isOwner).toBe(false);
		expect(store.roles).toEqual([]);
		expect(store.target).toBeNull();
	});

	it("sets one exact effective Authority projection", () => {
		store.setAuthority({
			target: { type: "store", id: "store-a" },
			permissions: { team: ["read", "update"] },
			owner: true,
			roles: ["owner"],
		});

		expect(store.isLoading).toBe(false);
		expect(store.isOwner).toBe(true);
		expect(store.target).toEqual({ type: "store", id: "store-a" });
		expect(store.roles).toEqual(["owner"]);
		expect(store.hasPermission("team", "update")).toBe(true);
	});

	it("setPermissions updates permissions and clears loading", () => {
		store.setPermissions({
			organization: ["create", "update", "delete"],
			team: ["create"],
		});

		expect(store.isLoading).toBe(false);
		expect(store.permissions).toEqual({
			organization: ["create", "update", "delete"],
			team: ["create"],
		});
	});

	it("setLoading updates loading state", () => {
		store.setPermissions({ organization: ["create"] });
		expect(store.isLoading).toBe(false);

		store.setLoading(true);
		expect(store.isLoading).toBe(true);
	});

	it("hasPermission returns true for granted permissions", () => {
		store.setPermissions({
			organization: ["create", "update"],
			team: ["delete"],
		});

		expect(store.hasPermission("organization", "create")).toBe(true);
		expect(store.hasPermission("organization", "update")).toBe(true);
		expect(store.hasPermission("team", "delete")).toBe(true);
	});

	it("hasPermission returns false for missing actions", () => {
		store.setPermissions({
			organization: ["create"],
		});

		expect(store.hasPermission("organization", "delete")).toBe(false);
	});

	it("hasPermission returns false for missing categories", () => {
		store.setPermissions({
			organization: ["create"],
		});

		expect(store.hasPermission("team", "create")).toBe(false);
		expect(store.hasPermission("nonexistent", "read")).toBe(false);
	});

	it("hasPermission returns false when permissions are empty", () => {
		expect(store.hasPermission("organization", "create")).toBe(false);
	});

	it("reset clears permissions and sets loading", () => {
		store.setAuthority({
			target: { type: "business", id: "business-a" },
			permissions: { organization: ["create", "update"] },
			owner: true,
			roles: ["owner"],
		});
		expect(store.isLoading).toBe(false);
		expect(Object.keys(store.permissions).length).toBe(1);

		store.reset();
		expect(store.isLoading).toBe(true);
		expect(store.permissions).toEqual({});
		expect(store.isOwner).toBe(false);
		expect(store.roles).toEqual([]);
		expect(store.target).toBeNull();
	});

	it("setPermissions with empty object clears all permissions", () => {
		store.setPermissions({
			organization: ["create"],
			team: ["delete"],
		});

		store.setPermissions({});
		expect(store.permissions).toEqual({});
		expect(store.isLoading).toBe(false);
	});

	it("setPermissions replaces previous permissions entirely", () => {
		store.setPermissions({
			organization: ["create", "update"],
			team: ["delete"],
		});

		store.setPermissions({
			ac: ["create"],
		});

		expect(store.hasPermission("organization", "create")).toBe(false);
		expect(store.hasPermission("team", "delete")).toBe(false);
		expect(store.hasPermission("ac", "create")).toBe(true);
	});

	it("handles permission categories with empty action arrays", () => {
		store.setPermissions({
			organization: [],
		});

		expect(store.hasPermission("organization", "create")).toBe(false);
	});
});
