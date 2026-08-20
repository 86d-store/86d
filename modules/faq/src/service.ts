import type { ModuleController } from "@86d-app/core/types/module";

export type FaqCategory = {
	id: string;
	name: string;
	slug: string;
	description?: string | undefined;
	icon?: string | undefined;
	position: number;
	isVisible: boolean;
	metadata?: Record<string, unknown> | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type FaqItem = {
	id: string;
	categoryId: string;
	question: string;
	answer: string;
	slug: string;
	position: number;
	isVisible: boolean;
	tags?: string[] | undefined;
	helpfulCount: number;
	notHelpfulCount: number;
	metadata?: Record<string, unknown> | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type FaqController = ModuleController & {
	/** Create a new FAQ category */
	createCategory(params: {
		name: string;
		slug: string;
		description?: string | undefined;
		icon?: string | undefined;
		position?: number | undefined;
	}): Promise<FaqCategory>;

	/** Get a category by ID */
	getCategory(id: string): Promise<FaqCategory | null>;

	/** Get a category by slug */
	getCategoryBySlug(slug: string): Promise<FaqCategory | null>;

	/** List all categories ordered by position */
	listCategories(opts?: {
		visibleOnly?: boolean | undefined;
	}): Promise<FaqCategory[]>;

	/** Update a category */
	updateCategory(
		id: string,
		data: {
			name?: string | undefined;
			slug?: string | undefined;
			description?: string | undefined;
			icon?: string | undefined;
			position?: number | undefined;
			isVisible?: boolean | undefined;
		},
	): Promise<FaqCategory>;

	/** Delete a category and all its items */
	deleteCategory(id: string): Promise<void>;

	/** Create a new FAQ item */
	createItem(params: {
		categoryId: string;
		question: string;
		answer: string;
		slug: string;
		position?: number | undefined;
		tags?: string[] | undefined;
	}): Promise<FaqItem>;

	/** Get an item by ID */
	getItem(id: string): Promise<FaqItem | null>;

	/** Get an item by slug */
	getItemBySlug(slug: string): Promise<FaqItem | null>;

	/** List items in a category ordered by position */
	listItems(opts?: {
		categoryId?: string | undefined;
		visibleOnly?: boolean | undefined;
	}): Promise<FaqItem[]>;

	/** Update an item */
	updateItem(
		id: string,
		data: {
			categoryId?: string | undefined;
			question?: string | undefined;
			answer?: string | undefined;
			slug?: string | undefined;
			position?: number | undefined;
			isVisible?: boolean | undefined;
			tags?: string[] | undefined;
		},
	): Promise<FaqItem>;

	/** Delete an item */
	deleteItem(id: string): Promise<void>;

	/** Search FAQs by query string (matches question, answer, and tags) */
	search(
		query: string,
		opts?: {
			categoryId?: string | undefined;
			limit?: number | undefined;
		},
	): Promise<FaqItem[]>;

	/** Record a helpful/not-helpful vote on an item */
	vote(itemId: string, helpful: boolean): Promise<FaqItem>;

	/** Get FAQ statistics */
	getStats(): Promise<{
		totalCategories: number;
		totalItems: number;
		totalHelpful: number;
		totalNotHelpful: number;
	}>;
};
