import type { ModuleController } from "@86d-app/core/types/module";

/** Supported label types for visual categorization */
export type LabelType =
	| "badge"
	| "tag"
	| "ribbon"
	| "banner"
	| "sticker"
	| "custom";

/** Position where the label appears on the product card */
export type LabelPosition =
	| "top-left"
	| "top-right"
	| "bottom-left"
	| "bottom-right"
	| "center";

/** Conditions for automatic label assignment */
export type LabelConditions = {
	/** Assign to products created within N days */
	newWithinDays?: number | undefined;
	/** Assign to products with discount >= N percent */
	discountMinPercent?: number | undefined;
	/** Assign to products with stock <= N */
	lowStockThreshold?: number | undefined;
	/** Assign to products in these categories */
	categories?: string[] | undefined;
	/** Assign to products with price >= N (cents) */
	priceMin?: number | undefined;
	/** Assign to products with price <= N (cents) */
	priceMax?: number | undefined;
};

export type Label = {
	id: string;
	name: string;
	slug: string;
	displayText: string;
	type: LabelType;
	color?: string | undefined;
	backgroundColor?: string | undefined;
	icon?: string | undefined;
	priority: number;
	isActive: boolean;
	startsAt?: Date | undefined;
	endsAt?: Date | undefined;
	conditions?: LabelConditions | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type ProductLabel = {
	id: string;
	productId: string;
	labelId: string;
	position?: LabelPosition | undefined;
	assignedAt: Date;
};

export type ProductWithLabels = {
	productId: string;
	labels: Array<Label & { position?: LabelPosition | undefined }>;
};

export type LabelStats = {
	labelId: string;
	name: string;
	displayText: string;
	type: LabelType;
	isActive: boolean;
	productCount: number;
};

export type ProductLabelController = ModuleController & {
	// --- Label CRUD ---

	createLabel(params: {
		name: string;
		slug: string;
		displayText: string;
		type: LabelType;
		color?: string | undefined;
		backgroundColor?: string | undefined;
		icon?: string | undefined;
		priority?: number | undefined;
		isActive?: boolean | undefined;
		startsAt?: Date | undefined;
		endsAt?: Date | undefined;
		conditions?: LabelConditions | undefined;
	}): Promise<Label>;

	getLabel(id: string): Promise<Label | null>;

	getLabelBySlug(slug: string): Promise<Label | null>;

	updateLabel(
		id: string,
		params: {
			name?: string | undefined;
			displayText?: string | undefined;
			type?: LabelType | undefined;
			color?: string | undefined;
			backgroundColor?: string | undefined;
			icon?: string | undefined;
			priority?: number | undefined;
			isActive?: boolean | undefined;
			startsAt?: Date | null | undefined;
			endsAt?: Date | null | undefined;
			conditions?: LabelConditions | null | undefined;
		},
	): Promise<Label | null>;

	deleteLabel(id: string): Promise<boolean>;

	listLabels(params?: {
		type?: LabelType | undefined;
		isActive?: boolean | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<Label[]>;

	countLabels(params?: {
		type?: LabelType | undefined;
		isActive?: boolean | undefined;
	}): Promise<number>;

	// --- Product-Label assignments ---

	assignLabel(params: {
		productId: string;
		labelId: string;
		position?: LabelPosition | undefined;
	}): Promise<ProductLabel>;

	unassignLabel(params: {
		productId: string;
		labelId: string;
	}): Promise<boolean>;

	getProductLabels(productId: string): Promise<ProductWithLabels>;

	getProductsForLabel(params: {
		labelId: string;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<ProductLabel[]>;

	countProductsForLabel(labelId: string): Promise<number>;

	bulkAssignLabel(params: {
		productIds: string[];
		labelId: string;
		position?: LabelPosition | undefined;
	}): Promise<number>;

	bulkUnassignLabel(params: {
		productIds: string[];
		labelId: string;
	}): Promise<number>;

	// --- Queries ---

	getActiveLabelsForProduct(productId: string): Promise<Label[]>;

	getLabelStats(params?: { take?: number | undefined }): Promise<LabelStats[]>;
};
