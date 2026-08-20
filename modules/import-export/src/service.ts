import type { ModuleController } from "@86d-app/core/types/module";

export type ImportType = "products" | "customers" | "orders" | "inventory";
export type ImportStatus =
	| "pending"
	| "validating"
	| "processing"
	| "completed"
	| "failed"
	| "cancelled";

export type ExportType = "products" | "customers" | "orders" | "inventory";
export type ExportStatus = "pending" | "processing" | "completed" | "failed";
export type ExportFormat = "csv" | "json";

export type ImportError = {
	row: number;
	field?: string | undefined;
	message: string;
};

export type ImportOptions = {
	updateExisting?: boolean | undefined;
	skipDuplicates?: boolean | undefined;
	dryRun?: boolean | undefined;
};

export type ImportJob = {
	id: string;
	type: ImportType;
	status: ImportStatus;
	filename: string;
	totalRows: number;
	processedRows: number;
	failedRows: number;
	skippedRows: number;
	errors: ImportError[];
	options: ImportOptions;
	createdBy?: string | undefined;
	createdAt: Date;
	updatedAt: Date;
	completedAt?: Date | undefined;
};

export type ExportFilters = {
	dateFrom?: string | undefined;
	dateTo?: string | undefined;
	status?: string | undefined;
};

export type ExportJob = {
	id: string;
	type: ExportType;
	status: ExportStatus;
	format: ExportFormat;
	filters: ExportFilters;
	totalRows: number;
	fileData?: string | undefined;
	createdBy?: string | undefined;
	createdAt: Date;
	updatedAt: Date;
	completedAt?: Date | undefined;
};

export type CreateImportParams = {
	type: ImportType;
	filename: string;
	totalRows: number;
	options?: ImportOptions | undefined;
	createdBy?: string | undefined;
};

export type CreateExportParams = {
	type: ExportType;
	format?: ExportFormat | undefined;
	filters?: ExportFilters | undefined;
	createdBy?: string | undefined;
};

export type ProcessRowResult = {
	success: boolean;
	error?: ImportError | undefined;
};

export type ImportExportController = ModuleController & {
	createImport(params: CreateImportParams): Promise<ImportJob>;
	getImport(id: string): Promise<ImportJob | null>;
	listImports(params?: {
		type?: ImportType | undefined;
		status?: ImportStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<ImportJob[]>;
	updateImportStatus(
		id: string,
		status: ImportStatus,
	): Promise<ImportJob | null>;
	processRow(
		id: string,
		rowNumber: number,
		success: boolean,
		error?: ImportError | undefined,
	): Promise<ImportJob | null>;
	completeImport(id: string): Promise<ImportJob | null>;
	cancelImport(id: string): Promise<ImportJob | null>;
	deleteImport(id: string): Promise<boolean>;

	createExport(params: CreateExportParams): Promise<ExportJob>;
	getExport(id: string): Promise<ExportJob | null>;
	listExports(params?: {
		type?: ExportType | undefined;
		status?: ExportStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<ExportJob[]>;
	updateExportStatus(
		id: string,
		status: ExportStatus,
	): Promise<ExportJob | null>;
	setExportData(
		id: string,
		data: string,
		totalRows: number,
	): Promise<ExportJob | null>;
	completeExport(id: string): Promise<ExportJob | null>;
	deleteExport(id: string): Promise<boolean>;

	countImports(): Promise<number>;
	countExports(): Promise<number>;
};
