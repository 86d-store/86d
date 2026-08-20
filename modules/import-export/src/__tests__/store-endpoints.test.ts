import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { CreateExportParams, CreateImportParams } from "../service";
import { createImportExportController } from "../service-impl";

/**
 * Store endpoint integration tests for the import-export module.
 *
 * These tests verify the business logic in admin-facing endpoints
 * (this module is admin-only, no unauthenticated store endpoints):
 *
 * 1. create-import: creates an import job
 * 2. get-import: retrieves an import job
 * 3. create-export: creates an export job
 * 4. get-export: retrieves an export job
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateCreateImport(
	data: DataService,
	body: CreateImportParams,
) {
	const controller = createImportExportController(data);
	const job = await controller.createImport(body);
	return { job };
}

async function simulateGetImport(data: DataService, id: string) {
	const controller = createImportExportController(data);
	const job = await controller.getImport(id);
	if (!job) {
		return { error: "Import not found", status: 404 };
	}
	return { job };
}

async function simulateCreateExport(
	data: DataService,
	body: CreateExportParams,
) {
	const controller = createImportExportController(data);
	const job = await controller.createExport(body);
	return { job };
}

async function simulateGetExport(data: DataService, id: string) {
	const controller = createImportExportController(data);
	const job = await controller.getExport(id);
	if (!job) {
		return { error: "Export not found", status: 404 };
	}
	return { job };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: create import", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("creates an import job", async () => {
		const result = await simulateCreateImport(data, {
			type: "products",
			filename: "products.csv",
			totalRows: 100,
		});

		expect("job" in result).toBe(true);
		if ("job" in result) {
			expect(result.job.status).toBe("pending");
			expect(result.job.type).toBe("products");
		}
	});
});

describe("store endpoint: get import", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns an import job", async () => {
		const ctrl = createImportExportController(data);
		const job = await ctrl.createImport({
			type: "orders",
			filename: "data.csv",
			totalRows: 25,
		});

		const result = await simulateGetImport(data, job.id);

		expect("job" in result).toBe(true);
		if ("job" in result) {
			expect(result.job.type).toBe("orders");
		}
	});

	it("returns 404 for nonexistent import", async () => {
		const result = await simulateGetImport(data, "ghost_import");

		expect(result).toEqual({ error: "Import not found", status: 404 });
	});
});

describe("store endpoint: create export", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("creates an export job", async () => {
		const result = await simulateCreateExport(data, {
			type: "products",
			format: "csv",
		});

		expect("job" in result).toBe(true);
		if ("job" in result) {
			expect(result.job.status).toBe("pending");
			expect(result.job.format).toBe("csv");
		}
	});
});

describe("store endpoint: get export", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns an export job", async () => {
		const ctrl = createImportExportController(data);
		const job = await ctrl.createExport({
			type: "customers",
			format: "json",
		});

		const result = await simulateGetExport(data, job.id);

		expect("job" in result).toBe(true);
		if ("job" in result) {
			expect(result.job.type).toBe("customers");
		}
	});

	it("returns 404 for nonexistent export", async () => {
		const result = await simulateGetExport(data, "ghost_export");

		expect(result).toEqual({ error: "Export not found", status: 404 });
	});
});
