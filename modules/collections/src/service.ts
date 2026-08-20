import type { ModuleController } from "@86d-app/core/types/module";

export type CollectionType = "manual" | "automatic";

export type CollectionSortOrder =
	| "manual"
	| "title-asc"
	| "title-desc"
	| "price-asc"
	| "price-desc"
	| "created-asc"
	| "created-desc"
	| "best-selling";

export type CollectionCondition = {
	field: string;
	operator:
		| "equals"
		| "not_equals"
		| "contains"
		| "starts_with"
		| "ends_with"
		| "greater_than"
		| "less_than"
		| "in"
		| "not_in";
	value: string | number | string[];
};

export type CollectionConditions = {
	match: "all" | "any";
	rules: CollectionCondition[];
};

export type Collection = {
	id: string;
	title: string;
	slug: string;
	description?: string;
	image?: string;
	type: CollectionType;
	sortOrder: CollectionSortOrder;
	isActive: boolean;
	isFeatured: boolean;
	position: number;
	conditions?: CollectionConditions;
	seoTitle?: string;
	seoDescription?: string;
	publishedAt?: Date;
	createdAt: Date;
	updatedAt: Date;
};

export type CollectionProduct = {
	id: string;
	collectionId: string;
	productId: string;
	position: number;
	addedAt: Date;
};

export type CollectionWithProductCount = Collection & {
	productCount: number;
};

export type CollectionStats = {
	totalCollections: number;
	activeCollections: number;
	featuredCollections: number;
	manualCollections: number;
	automaticCollections: number;
	totalProducts: number;
};

export type CollectionController = ModuleController & {
	createCollection(params: {
		title: string;
		slug: string;
		description?: string;
		image?: string;
		type: CollectionType;
		sortOrder?: CollectionSortOrder;
		isActive?: boolean;
		isFeatured?: boolean;
		position?: number;
		conditions?: CollectionConditions;
		seoTitle?: string;
		seoDescription?: string;
		publishedAt?: Date;
	}): Promise<Collection>;

	getCollection(id: string): Promise<Collection | null>;

	getCollectionBySlug(slug: string): Promise<Collection | null>;

	updateCollection(
		id: string,
		params: {
			title?: string;
			slug?: string;
			description?: string | null;
			image?: string | null;
			type?: CollectionType;
			sortOrder?: CollectionSortOrder;
			isActive?: boolean;
			isFeatured?: boolean;
			position?: number;
			conditions?: CollectionConditions | null;
			seoTitle?: string | null;
			seoDescription?: string | null;
			publishedAt?: Date | null;
		},
	): Promise<Collection | null>;

	deleteCollection(id: string): Promise<boolean>;

	listCollections(params?: {
		isActive?: boolean;
		isFeatured?: boolean;
		type?: CollectionType;
		take?: number;
		skip?: number;
	}): Promise<Collection[]>;

	countCollections(params?: {
		isActive?: boolean;
		isFeatured?: boolean;
		type?: CollectionType;
	}): Promise<number>;

	addProduct(params: {
		collectionId: string;
		productId: string;
		position?: number;
	}): Promise<CollectionProduct>;

	removeProduct(params: {
		collectionId: string;
		productId: string;
	}): Promise<boolean>;

	getCollectionProducts(params: {
		collectionId: string;
		take?: number;
		skip?: number;
	}): Promise<CollectionProduct[]>;

	countCollectionProducts(collectionId: string): Promise<number>;

	reorderProducts(params: {
		collectionId: string;
		productIds: string[];
	}): Promise<void>;

	bulkAddProducts(params: {
		collectionId: string;
		productIds: string[];
	}): Promise<number>;

	bulkRemoveProducts(params: {
		collectionId: string;
		productIds: string[];
	}): Promise<number>;

	getFeaturedCollections(limit?: number): Promise<Collection[]>;

	getCollectionsForProduct(productId: string): Promise<Collection[]>;

	getStats(): Promise<CollectionStats>;
};
