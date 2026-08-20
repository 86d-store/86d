import type { ModuleController } from "@86d-app/core/types/module";

export type QrCodeTargetType =
	| "product"
	| "collection"
	| "page"
	| "order"
	| "custom";

export type QrCodeFormat = "svg" | "png";

export type QrCodeErrorCorrection = "L" | "M" | "Q" | "H";

export type QrCode = {
	id: string;
	label: string;
	targetUrl: string;
	targetType: QrCodeTargetType;
	targetId?: string | undefined;
	format: QrCodeFormat;
	size: number;
	errorCorrection: QrCodeErrorCorrection;
	scanCount: number;
	isActive: boolean;
	metadata: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
};

export type QrScan = {
	id: string;
	qrCodeId: string;
	scannedAt: Date;
	userAgent?: string | undefined;
	ipAddress?: string | undefined;
	referrer?: string | undefined;
};

export type QrCodeController = ModuleController & {
	create(params: {
		label: string;
		targetUrl: string;
		targetType?: QrCodeTargetType | undefined;
		targetId?: string | undefined;
		format?: QrCodeFormat | undefined;
		size?: number | undefined;
		errorCorrection?: QrCodeErrorCorrection | undefined;
		metadata?: Record<string, unknown> | undefined;
	}): Promise<QrCode>;

	get(id: string): Promise<QrCode | null>;

	getByTarget(
		targetType: QrCodeTargetType,
		targetId: string,
	): Promise<QrCode | null>;

	update(
		id: string,
		params: {
			label?: string | undefined;
			targetUrl?: string | undefined;
			targetType?: QrCodeTargetType | undefined;
			targetId?: string | undefined;
			format?: QrCodeFormat | undefined;
			size?: number | undefined;
			errorCorrection?: QrCodeErrorCorrection | undefined;
			isActive?: boolean | undefined;
			metadata?: Record<string, unknown> | undefined;
		},
	): Promise<QrCode | null>;

	delete(id: string): Promise<boolean>;

	list(params?: {
		targetType?: QrCodeTargetType | undefined;
		isActive?: boolean | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<QrCode[]>;

	recordScan(
		id: string,
		params?: {
			userAgent?: string | undefined;
			ipAddress?: string | undefined;
			referrer?: string | undefined;
		},
	): Promise<QrScan | null>;

	getScanCount(id: string): Promise<number>;

	listScans(
		qrCodeId: string,
		params?: {
			take?: number | undefined;
			skip?: number | undefined;
		},
	): Promise<QrScan[]>;

	createBatch(
		items: Array<{
			label: string;
			targetUrl: string;
			targetType?: QrCodeTargetType | undefined;
			targetId?: string | undefined;
			format?: QrCodeFormat | undefined;
			size?: number | undefined;
			errorCorrection?: QrCodeErrorCorrection | undefined;
			metadata?: Record<string, unknown> | undefined;
		}>,
	): Promise<QrCode[]>;
};
