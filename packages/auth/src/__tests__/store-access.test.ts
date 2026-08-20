import { describe, expect, it } from "vitest";
import { verifyStoreAdminAccess } from "../store-access";

describe("verifyStoreAdminAccess", () => {
	it("grants access to users with admin role", () => {
		const result = verifyStoreAdminAccess({ id: "u1", role: "admin" });
		expect(result.hasAccess).toBe(true);
		expect(result.role).toBe("admin");
	});

	it("denies access to users with user role", () => {
		const result = verifyStoreAdminAccess({ id: "u1", role: "user" });
		expect(result.hasAccess).toBe(false);
		expect(result.role).toBe("user");
	});

	it("denies access when role is undefined", () => {
		const result = verifyStoreAdminAccess({ id: "u1", role: undefined });
		expect(result.hasAccess).toBe(false);
		expect(result.role).toBeUndefined();
	});

	it("denies access when role is null", () => {
		const result = verifyStoreAdminAccess({ id: "u1", role: null });
		expect(result.hasAccess).toBe(false);
		expect(result.role).toBeUndefined();
	});

	it("denies access when role is omitted entirely", () => {
		const result = verifyStoreAdminAccess({ id: "u1" });
		expect(result.hasAccess).toBe(false);
		expect(result.role).toBeUndefined();
	});

	it("denies access to non-admin roles like manager", () => {
		const result = verifyStoreAdminAccess({ id: "u1", role: "manager" });
		expect(result.hasAccess).toBe(false);
		expect(result.role).toBe("manager");
	});

	it("denies access for empty string role", () => {
		const result = verifyStoreAdminAccess({ id: "u1", role: "" });
		expect(result.hasAccess).toBe(false);
		expect(result.role).toBe("");
	});

	it("is case-sensitive — Admin does not match admin", () => {
		const result = verifyStoreAdminAccess({ id: "u1", role: "Admin" });
		expect(result.hasAccess).toBe(false);
	});

	it("includes role in result only when present", () => {
		const withRole = verifyStoreAdminAccess({ id: "u1", role: "admin" });
		expect("role" in withRole).toBe(true);

		const withoutRole = verifyStoreAdminAccess({ id: "u1", role: null });
		expect("role" in withoutRole).toBe(false);
	});
});
