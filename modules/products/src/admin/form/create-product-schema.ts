import { z } from "@86d-app/core/zod";

/**
 * Client + server product create form schema for /admin/products/new.
 * Inventory fields are omitted: stock changes go through the Inventory operation.
 */
export const createProductFormSchema = z.object({
	name: z.string().min(1, "Name is required").max(200),
	slug: z.string().min(1, "Slug is required").max(200),
	description: z.string().max(10000),
	shortDescription: z.string().max(500),
	/** Dollars as entered in the form; converted to cents on submit. */
	price: z
		.string()
		.min(1, "Price is required")
		.refine((value) => {
			const cents = Math.round(Number.parseFloat(value) * 100);
			return !Number.isNaN(cents) && cents > 0;
		}, "Price must be a positive number"),
	compareAtPrice: z.string(),
	sku: z.string().max(100),
	status: z.enum(["draft", "active", "archived"]),
	categoryId: z.string(),
	isFeatured: z.boolean(),
	tags: z.string(),
	images: z.array(z.string()),
});

export type CreateProductFormValues = z.infer<typeof createProductFormSchema>;

export const createProductFormDefaults: CreateProductFormValues = {
	name: "",
	slug: "",
	description: "",
	shortDescription: "",
	price: "",
	compareAtPrice: "",
	sku: "",
	status: "draft",
	categoryId: "",
	isFeatured: false,
	tags: "",
	images: [],
};

/** Server body after form → cents conversion (matches create endpoint shape). */
export const createProductServerBodySchema = z.object({
	name: z.string().min(1).max(200),
	slug: z.string().min(1).max(200),
	description: z.string().max(10000).optional(),
	shortDescription: z.string().max(500).optional(),
	price: z.number().int().positive(),
	compareAtPrice: z.number().int().positive().optional(),
	sku: z.string().max(100).optional(),
	status: z.enum(["draft", "active", "archived"]).optional(),
	categoryId: z.string().optional(),
	images: z.array(z.string()).optional(),
	tags: z.array(z.string()).optional(),
	isFeatured: z.boolean().optional(),
});

export function formValuesToCreateBody(values: CreateProductFormValues) {
	const price = Math.round(Number.parseFloat(values.price) * 100);
	const compareAtPrice = values.compareAtPrice.trim()
		? Math.round(Number.parseFloat(values.compareAtPrice) * 100)
		: undefined;
	return createProductServerBodySchema.parse({
		name: values.name.trim(),
		slug: values.slug.trim(),
		description: values.description.trim() || undefined,
		shortDescription: values.shortDescription.trim() || undefined,
		price,
		compareAtPrice:
			compareAtPrice !== undefined &&
			!Number.isNaN(compareAtPrice) &&
			compareAtPrice > 0
				? compareAtPrice
				: undefined,
		sku: values.sku.trim() || undefined,
		status: values.status,
		categoryId: values.categoryId.trim() || undefined,
		images: values.images.length > 0 ? values.images : undefined,
		tags: values.tags
			.split(",")
			.map((tag) => tag.trim())
			.filter(Boolean),
		isFeatured: values.isFeatured,
	});
}
