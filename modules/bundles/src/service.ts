import type { ModuleController } from "@86d-app/core/types/module";

export type Bundle = {
	id: string;
	name: string;
	slug: string;
	description?: string | undefined;
	status: "active" | "draft" | "archived";
	discountType: "fixed" | "percentage";
	discountValue: number;
	minQuantity?: number | undefined;
	maxQuantity?: number | undefined;
	startsAt?: string | undefined;
	endsAt?: string | undefined;
	imageUrl?: string | undefined;
	sortOrder?: number | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type BundleItem = {
	id: string;
	bundleId: string;
	productId: string;
	variantId?: string | undefined;
	quantity: number;
	sortOrder?: number | undefined;
	/** Snapshot of the product name at the time the item was added */
	productName?: string | undefined;
	/** Snapshot of the product slug for building links */
	productSlug?: string | undefined;
	/** Snapshot of the product image URL */
	productImageUrl?: string | undefined;
	createdAt: Date;
};

export type CreateBundleParams = {
	name: string;
	slug: string;
	description?: string | undefined;
	discountType: "fixed" | "percentage";
	discountValue: number;
	minQuantity?: number | undefined;
	maxQuantity?: number | undefined;
	startsAt?: string | undefined;
	endsAt?: string | undefined;
	imageUrl?: string | undefined;
	sortOrder?: number | undefined;
};

export type AddBundleItemParams = {
	bundleId: string;
	productId: string;
	variantId?: string | undefined;
	quantity: number;
	sortOrder?: number | undefined;
	productName?: string | undefined;
	productSlug?: string | undefined;
	productImageUrl?: string | undefined;
};

export type BundleWithItems = Bundle & {
	items: BundleItem[];
};

export type BundleController = ModuleController & {
	create(params: CreateBundleParams): Promise<Bundle>;

	get(id: string): Promise<Bundle | null>;

	getBySlug(slug: string): Promise<Bundle | null>;

	list(params?: {
		status?: string | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<Bundle[]>;

	update(
		id: string,
		data: Partial<
			Pick<
				Bundle,
				| "name"
				| "slug"
				| "description"
				| "status"
				| "discountType"
				| "discountValue"
				| "minQuantity"
				| "maxQuantity"
				| "startsAt"
				| "endsAt"
				| "imageUrl"
				| "sortOrder"
			>
		>,
	): Promise<Bundle | null>;

	delete(id: string): Promise<boolean>;

	addItem(params: AddBundleItemParams): Promise<BundleItem>;

	removeItem(itemId: string): Promise<boolean>;

	listItems(bundleId: string): Promise<BundleItem[]>;

	updateItem(
		itemId: string,
		data: Partial<Pick<BundleItem, "quantity" | "sortOrder">>,
	): Promise<BundleItem | null>;

	getWithItems(id: string): Promise<BundleWithItems | null>;

	getActiveBySlug(slug: string): Promise<BundleWithItems | null>;

	listActive(params?: {
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<BundleWithItems[]>;

	countAll(): Promise<number>;
};
