export interface Product {
	id: string;
	name: string;
	slug: string;
	price: number;
	compareAtPrice?: number | null;
	shortDescription?: string | null;
	description?: string | null;
	images: string[];
	isFeatured: boolean;
	status: string;
	inventory: number;
	categoryId?: string | null;
	tags: string[];
}

export interface ProductVariant {
	id: string;
	name: string;
	price: number;
	compareAtPrice?: number | null;
	inventory: number;
	options: Record<string, string>;
}

export interface ProductWithVariants extends Product {
	variants: ProductVariant[];
	category?: { id: string; name: string; slug: string } | null;
}

export interface Category {
	id: string;
	name: string;
	slug: string;
}

export interface ListResult {
	products: Product[];
	total: number;
	page: number;
	limit: number;
}

export interface CollectionCardData {
	id: string;
	name: string;
	slug: string;
	description?: string | null;
	image?: string | null;
}

export interface Review {
	id: string;
	authorName: string;
	rating: number;
	title?: string | undefined;
	body: string;
	isVerifiedPurchase: boolean;
	helpfulCount: number;
	createdAt: string;
}

export interface RatingSummary {
	average: number;
	count: number;
	distribution: Record<string, number>;
}

export interface ReviewsResponse {
	reviews: Review[];
	summary: RatingSummary;
	total: number;
}
