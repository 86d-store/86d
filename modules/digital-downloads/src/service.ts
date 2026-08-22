import type { ModuleController } from "@86d-app/core/types/module";

export type DownloadableFile = {
	id: string;
	productId: string;
	name: string;
	url: string;
	fileSize?: number | undefined;
	mimeType?: string | undefined;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
};

export type DownloadToken = {
	id: string;
	token: string;
	fileId: string;
	orderId?: string | undefined;
	email: string;
	maxDownloads?: number | undefined;
	downloadCount: number;
	expiresAt?: Date | undefined;
	revokedAt?: Date | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type DigitalDownloadsController = ModuleController & {
	// ── Files ──────────────────────────────────────────────────────────────
	createFile(params: {
		productId: string;
		name: string;
		url: string;
		fileSize?: number | undefined;
		mimeType?: string | undefined;
		isActive?: boolean | undefined;
	}): Promise<DownloadableFile>;

	getFile(id: string): Promise<DownloadableFile | null>;

	listFiles(params?: {
		productId?: string | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<DownloadableFile[]>;

	updateFile(
		id: string,
		params: {
			name?: string | undefined;
			url?: string | undefined;
			fileSize?: number | undefined;
			mimeType?: string | undefined;
			isActive?: boolean | undefined;
		},
	): Promise<DownloadableFile | null>;

	deleteFile(id: string): Promise<boolean>;

	// ── Tokens ─────────────────────────────────────────────────────────────
	createToken(params: {
		fileId: string;
		email: string;
		orderId?: string | undefined;
		maxDownloads?: number | undefined;
		expiresAt?: Date | undefined;
	}): Promise<DownloadToken>;

	getToken(id: string): Promise<DownloadToken | null>;

	getTokenByValue(token: string): Promise<DownloadToken | null>;

	redeemToken(token: string): Promise<{
		ok: boolean;
		reason?: string | undefined;
		file?: DownloadableFile | undefined;
		token?: DownloadToken | undefined;
	}>;

	revokeToken(token: string): Promise<boolean>;

	revokeTokenById(id: string): Promise<boolean>;

	listTokensByEmail(params: {
		email: string;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<DownloadToken[]>;

	listTokens(params?: {
		fileId?: string | undefined;
		orderId?: string | undefined;
		email?: string | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<DownloadToken[]>;

	/** Create tokens for multiple files at once (e.g., for an order with multiple digital products) */
	createTokenBatch(params: {
		fileIds: string[];
		email: string;
		orderId?: string | undefined;
		maxDownloads?: number | undefined;
		expiresAt?: Date | undefined;
	}): Promise<DownloadToken[]>;
};
