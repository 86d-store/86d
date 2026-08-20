import { describe, expect, it, vi } from "vitest";
import { createFile } from "../admin/endpoints/create-file";
import { createToken } from "../admin/endpoints/create-token";
import { createTokenBatch } from "../admin/endpoints/create-token-batch";
import { deleteFile } from "../admin/endpoints/delete-file";
import { getFile } from "../admin/endpoints/get-file";
import { getToken } from "../admin/endpoints/get-token";
import { listFiles } from "../admin/endpoints/list-files";
import { listTokens } from "../admin/endpoints/list-tokens";
import { revokeToken } from "../admin/endpoints/revoke-token";
import { updateFile } from "../admin/endpoints/update-file";
import type {
	DigitalDownloadsController,
	DownloadableFile,
	DownloadToken,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeFile(overrides: Partial<DownloadableFile> = {}): DownloadableFile {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		productId: "prod_1",
		name: "ebook.pdf",
		url: "https://storage.example.com/ebook.pdf",
		isActive: true,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeToken(overrides: Partial<DownloadToken> = {}): DownloadToken {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		token: crypto.randomUUID(),
		fileId: "file_1",
		email: "alice@example.com",
		downloadCount: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<DigitalDownloadsController> = {},
): DigitalDownloadsController {
	return {
		createFile: vi.fn().mockResolvedValue(makeFile()),
		getFile: vi.fn().mockResolvedValue(null),
		listFiles: vi.fn().mockResolvedValue([]),
		updateFile: vi.fn().mockResolvedValue(null),
		deleteFile: vi.fn().mockResolvedValue(false),
		createToken: vi.fn().mockResolvedValue(makeToken()),
		getToken: vi.fn().mockResolvedValue(null),
		getTokenByValue: vi.fn().mockResolvedValue(null),
		useToken: vi.fn().mockResolvedValue({ ok: false }),
		revokeToken: vi.fn().mockResolvedValue(false),
		revokeTokenById: vi.fn().mockResolvedValue(false),
		listTokensByEmail: vi.fn().mockResolvedValue([]),
		listTokens: vi.fn().mockResolvedValue([]),
		createTokenBatch: vi.fn().mockResolvedValue([]),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: DigitalDownloadsController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { "digital-downloads": opts.controller ?? makeController() },
		},
	});
}

const listFilesHandler = extractHandler(listFiles);
const createFileHandler = extractHandler(createFile);
const getFileHandler = extractHandler(getFile);
const updateFileHandler = extractHandler(updateFile);
const deleteFileHandler = extractHandler(deleteFile);
const listTokensHandler = extractHandler(listTokens);
const createTokenHandler = extractHandler(createToken);
const getTokenHandler = extractHandler(getToken);
const createTokenBatchHandler = extractHandler(createTokenBatch);
const revokeTokenHandler = extractHandler(revokeToken);

describe("admin GET /downloads/files", () => {
	it("returns empty list", async () => {
		const result = (await call(listFilesHandler)) as {
			files: DownloadableFile[];
		};
		expect(result.files).toHaveLength(0);
	});

	it("returns list of files", async () => {
		const file = makeFile({ id: "file_1" });
		const ctrl = makeController({
			listFiles: vi.fn().mockResolvedValue([file]),
		});
		const result = (await call(listFilesHandler, { controller: ctrl })) as {
			files: DownloadableFile[];
		};
		expect(result.files).toHaveLength(1);
		expect(result.files[0].id).toBe("file_1");
	});

	it("forwards productId query param", async () => {
		const ctrl = makeController();
		await call(listFilesHandler, {
			query: { productId: "prod_1" },
			controller: ctrl,
		});
		expect(ctrl.listFiles).toHaveBeenCalledWith(
			expect.objectContaining({ productId: "prod_1" }),
		);
	});
});

describe("admin POST /downloads/files/create", () => {
	it("creates a file and returns it", async () => {
		const file = makeFile({ name: "guide.pdf", productId: "prod_2" });
		const ctrl = makeController({
			createFile: vi.fn().mockResolvedValue(file),
		});
		const result = (await call(createFileHandler, {
			body: {
				productId: "prod_2",
				name: "guide.pdf",
				url: "https://storage.example.com/guide.pdf",
			},
			controller: ctrl,
		})) as { file: DownloadableFile };
		expect(result.file.name).toBe("guide.pdf");
		expect(result.file.productId).toBe("prod_2");
	});
});

describe("admin GET /downloads/files/:id", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(getFileHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("File not found");
	});

	it("returns file when found", async () => {
		const file = makeFile({ id: "file_1" });
		const ctrl = makeController({
			getFile: vi.fn().mockResolvedValue(file),
		});
		const result = (await call(getFileHandler, {
			params: { id: "file_1" },
			controller: ctrl,
		})) as { file: DownloadableFile };
		expect(result.file.id).toBe("file_1");
	});
});

describe("admin PUT /downloads/files/:id", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(updateFileHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("updates file and returns it", async () => {
		const file = makeFile({ id: "file_1", name: "updated.pdf" });
		const ctrl = makeController({
			updateFile: vi.fn().mockResolvedValue(file),
		});
		const result = (await call(updateFileHandler, {
			params: { id: "file_1" },
			body: { name: "updated.pdf" },
			controller: ctrl,
		})) as { file: DownloadableFile };
		expect(result.file.name).toBe("updated.pdf");
	});
});

describe("admin DELETE /downloads/files/:id", () => {
	it("returns ok: false when not deleted", async () => {
		const result = (await call(deleteFileHandler, {
			params: { id: "missing" },
		})) as { ok: boolean };
		expect(result.ok).toBe(false);
	});

	it("deletes file and returns ok: true", async () => {
		const ctrl = makeController({
			deleteFile: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteFileHandler, {
			params: { id: "file_1" },
			controller: ctrl,
		})) as { ok: boolean };
		expect(result.ok).toBe(true);
	});
});

describe("admin GET /downloads/tokens", () => {
	it("returns empty list with total 0", async () => {
		const result = (await call(listTokensHandler)) as {
			tokens: DownloadToken[];
			total: number;
		};
		expect(result.tokens).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns tokens with correct total", async () => {
		const token = makeToken({ id: "tok_1" });
		const ctrl = makeController({
			listTokens: vi.fn().mockResolvedValue([token]),
		});
		const result = (await call(listTokensHandler, { controller: ctrl })) as {
			tokens: DownloadToken[];
			total: number;
		};
		expect(result.tokens).toHaveLength(1);
		expect(result.total).toBe(1);
	});

	it("forwards fileId query param", async () => {
		const ctrl = makeController();
		await call(listTokensHandler, {
			query: { fileId: "file_1" },
			controller: ctrl,
		});
		expect(ctrl.listTokens).toHaveBeenCalledWith(
			expect.objectContaining({ fileId: "file_1" }),
		);
	});
});

describe("admin POST /downloads/tokens/create", () => {
	it("creates a token and returns it", async () => {
		const token = makeToken({ fileId: "file_1", email: "bob@example.com" });
		const ctrl = makeController({
			createToken: vi.fn().mockResolvedValue(token),
		});
		const result = (await call(createTokenHandler, {
			body: { fileId: "file_1", email: "bob@example.com" },
			controller: ctrl,
		})) as { token: DownloadToken };
		expect(result.token.email).toBe("bob@example.com");
		expect(result.token.fileId).toBe("file_1");
	});
});

describe("admin GET /downloads/tokens/:id", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(getTokenHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Token not found");
	});

	it("returns token when found", async () => {
		const token = makeToken({ id: "tok_1" });
		const ctrl = makeController({
			getToken: vi.fn().mockResolvedValue(token),
		});
		const result = (await call(getTokenHandler, {
			params: { id: "tok_1" },
			controller: ctrl,
		})) as { token: DownloadToken };
		expect(result.token.id).toBe("tok_1");
	});
});

describe("admin POST /downloads/tokens/batch", () => {
	it("creates multiple tokens and returns them", async () => {
		const tokens = [
			makeToken({ fileId: "file_1" }),
			makeToken({ fileId: "file_2" }),
		];
		const ctrl = makeController({
			createTokenBatch: vi.fn().mockResolvedValue(tokens),
		});
		const result = (await call(createTokenBatchHandler, {
			body: {
				fileIds: ["file_1", "file_2"],
				email: "alice@example.com",
			},
			controller: ctrl,
		})) as { tokens: DownloadToken[] };
		expect(result.tokens).toHaveLength(2);
	});

	it("returns empty tokens array when no files match", async () => {
		const ctrl = makeController({
			createTokenBatch: vi.fn().mockResolvedValue([]),
		});
		const result = (await call(createTokenBatchHandler, {
			body: {
				fileIds: ["nonexistent"],
				email: "alice@example.com",
			},
			controller: ctrl,
		})) as { tokens: DownloadToken[] };
		expect(result.tokens).toHaveLength(0);
	});
});

describe("admin POST /downloads/tokens/:id/revoke", () => {
	it("returns 404 when token not found", async () => {
		const result = (await call(revokeTokenHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Token not found");
	});

	it("revokes token and returns success", async () => {
		const ctrl = makeController({
			revokeTokenById: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(revokeTokenHandler, {
			params: { id: "tok_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.revokeTokenById).toHaveBeenCalledWith("tok_1");
	});
});
