import type { ModuleController } from "@86d-app/core/types/module";

export type Brand = {
	id: string;
	name: string;
	slug: string;
	description?: string;
	logo?: string;
	bannerImage?: string;
	website?: string;
	isActive: boolean;
	isFeatured: boolean;
	position: number;
	seoTitle?: string;
	seoDescription?: string;
	createdAt: Date;
	updatedAt: Date;
};

export type BrandProduct = {
	id: string;
	brandId: string;
	productId: string;
	assignedAt: Date;
};

export type BrandWithProductCount = Brand & {
	productCount: number;
};

export type BrandStats = {
	totalBrands: number;
	activeBrands: number;
	featuredBrands: number;
	totalProducts: number;
};

export type BrandController = ModuleController & {
	createBrand(params: {
		name: string;
		slug: string;
		description?: string;
		logo?: string;
		bannerImage?: string;
		website?: string;
		isActive?: boolean;
		isFeatured?: boolean;
		position?: number;
		seoTitle?: string;
		seoDescription?: string;
	}): Promise<Brand>;

	getBrand(id: string): Promise<Brand | null>;

	getBrandBySlug(slug: string): Promise<Brand | null>;

	updateBrand(
		id: string,
		params: {
			name?: string;
			slug?: string;
			description?: string | null;
			logo?: string | null;
			bannerImage?: string | null;
			website?: string | null;
			isActive?: boolean;
			isFeatured?: boolean;
			position?: number;
			seoTitle?: string | null;
			seoDescription?: string | null;
		},
	): Promise<Brand | null>;

	deleteBrand(id: string): Promise<boolean>;

	listBrands(params?: {
		isActive?: boolean;
		isFeatured?: boolean;
		take?: number;
		skip?: number;
	}): Promise<Brand[]>;

	countBrands(params?: {
		isActive?: boolean;
		isFeatured?: boolean;
	}): Promise<number>;

	assignProduct(params: {
		brandId: string;
		productId: string;
	}): Promise<BrandProduct>;

	unassignProduct(params: {
		brandId: string;
		productId: string;
	}): Promise<boolean>;

	getBrandProducts(params: {
		brandId: string;
		take?: number;
		skip?: number;
	}): Promise<BrandProduct[]>;

	countBrandProducts(brandId: string): Promise<number>;

	getBrandForProduct(productId: string): Promise<Brand | null>;

	bulkAssignProducts(params: {
		brandId: string;
		productIds: string[];
	}): Promise<number>;

	bulkUnassignProducts(params: {
		brandId: string;
		productIds: string[];
	}): Promise<number>;

	getFeaturedBrands(limit?: number): Promise<Brand[]>;

	getStats(): Promise<BrandStats>;
};
