import type { ModuleController } from "@86d-app/core/types/module";

export type Asset = {
	id: string;
	name: string;
	altText?: string | undefined;
	url: string;
	mimeType: string;
	size: number;
	width?: number | undefined;
	height?: number | undefined;
	folder?: string | undefined;
	tags: string[];
	metadata: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
};

export type Folder = {
	id: string;
	name: string;
	parentId?: string | undefined;
	createdAt: Date;
};

export type MediaStats = {
	totalAssets: number;
	totalSize: number;
	byMimeType: Record<string, number>;
	byFolder: Record<string, number>;
};

export type MediaController = ModuleController & {
	createAsset(params: {
		name: string;
		url: string;
		mimeType: string;
		size: number;
		altText?: string | undefined;
		width?: number | undefined;
		height?: number | undefined;
		folder?: string | undefined;
		tags?: string[] | undefined;
		metadata?: Record<string, unknown> | undefined;
	}): Promise<Asset>;

	getAsset(id: string): Promise<Asset | null>;

	updateAsset(
		id: string,
		params: {
			name?: string | undefined;
			altText?: string | undefined;
			url?: string | undefined;
			folder?: string | undefined;
			tags?: string[] | undefined;
			metadata?: Record<string, unknown> | undefined;
		},
	): Promise<Asset | null>;

	deleteAsset(id: string): Promise<boolean>;

	listAssets(params?: {
		folder?: string | undefined;
		mimeType?: string | undefined;
		tag?: string | undefined;
		search?: string | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<Asset[]>;

	bulkDelete(ids: string[]): Promise<number>;

	moveAssets(ids: string[], folder: string | null): Promise<number>;

	getStats(): Promise<MediaStats>;

	createFolder(params: {
		name: string;
		parentId?: string | undefined;
	}): Promise<Folder>;

	getFolder(id: string): Promise<Folder | null>;

	listFolders(parentId?: string | undefined): Promise<Folder[]>;

	renameFolder(id: string, name: string): Promise<Folder | null>;

	deleteFolder(id: string): Promise<boolean>;
};
