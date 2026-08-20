import { describe, expect, it } from "vitest";
import {
	formatModuleClientEndpointReferenceConflicts,
	validateModuleClientEndpointReferences,
} from "../endpoint-references";
import type { ModulePathSource } from "../paths";

const source: ModulePathSource = {
	moduleId: "wish",
	adminEndpoints: ["/admin/wish/products", "/admin/wish/stats"],
	storeEndpoints: ["/wish/webhooks"],
};

describe("validateModuleClientEndpointReferences", () => {
	it("returns no conflicts when referenced paths exist", () => {
		expect(
			validateModuleClientEndpointReferences(source, [
				{
					moduleId: "wish",
					filePath: "modules/wish/src/admin/components/wish-admin.tsx",
					surface: "admin",
					path: "/admin/wish/products",
				},
				{
					moduleId: "wish",
					filePath: "modules/wish/src/store/components/share.tsx",
					surface: "store",
					path: "/wish/webhooks",
				},
			]),
		).toEqual([]);
	});

	it("reports missing admin endpoint references", () => {
		expect(
			validateModuleClientEndpointReferences(source, [
				{
					moduleId: "wish",
					filePath: "modules/wish/src/admin/components/wish-admin.tsx",
					surface: "admin",
					path: "/admin/wish",
				},
			]),
		).toEqual([
			{
				moduleId: "wish",
				filePath: "modules/wish/src/admin/components/wish-admin.tsx",
				surface: "admin",
				path: "/admin/wish",
			},
		]);
	});

	it("reports missing store endpoint references", () => {
		expect(
			validateModuleClientEndpointReferences(source, [
				{
					moduleId: "wish",
					filePath: "modules/wish/src/store/components/share.tsx",
					surface: "store",
					path: "/wish/share",
				},
			]),
		).toEqual([
			{
				moduleId: "wish",
				filePath: "modules/wish/src/store/components/share.tsx",
				surface: "store",
				path: "/wish/share",
			},
		]);
	});
});

describe("formatModuleClientEndpointReferenceConflicts", () => {
	it("formats missing endpoint references clearly", () => {
		expect(
			formatModuleClientEndpointReferenceConflicts([
				{
					moduleId: "wish",
					filePath: "modules/wish/src/admin/components/wish-admin.tsx",
					surface: "admin",
					path: "/admin/wish",
				},
			]),
		).toEqual([
			'Module "wish" references missing admin endpoint "/admin/wish" in "modules/wish/src/admin/components/wish-admin.tsx".',
		]);
	});
});
