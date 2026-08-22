import {
	createProductFormDefaults,
	createProductFormSchema,
	formValuesToCreateBody,
} from "../../form/create-product-schema";
import type { MerchantScreenState } from "../../form/screen-states";
import { createZodFormAdapter } from "../../form/zod-form-adapter";

export const PRODUCT_NEW_FIXTURE_ID = "store-admin.products.new.v1";

export const createProductFormAdapter = createZodFormAdapter(
	createProductFormSchema,
);

export const PRODUCT_NEW_DEFAULTS = createProductFormAdapter.defaultValues(
	createProductFormDefaults,
);

export const PRODUCT_NEW_VALID_FIXTURE = createProductFormAdapter.roundTrip({
	name: "House Blend Coffee",
	slug: "house-blend-coffee",
	description: "A balanced everyday roast.",
	shortDescription: "Everyday roast",
	price: "18.00",
	compareAtPrice: "",
	sku: "HB-12",
	status: "draft",
	categoryId: "",
	isFeatured: false,
	tags: "coffee, beans",
	images: [],
});

export const PRODUCT_NEW_SERVER_BODY = formValuesToCreateBody(
	PRODUCT_NEW_VALID_FIXTURE,
);

export const PRODUCT_NEW_INVALID_FIXTURES = [
	{ ...createProductFormDefaults, name: "" },
	{ ...createProductFormDefaults, name: "Mug", slug: "", price: "12" },
	{ ...createProductFormDefaults, name: "Mug", slug: "mug", price: "0" },
] as const;

export const PRODUCT_NEW_STATE_COPY: Record<
	MerchantScreenState,
	{ title: string; body: string }
> = {
	empty: {
		title: "Create a product",
		body: "Add a name, price, and details to publish to your storefront.",
	},
	loading: {
		title: "Loading form",
		body: "Skeleton matching the create product layout.",
	},
	error: {
		title: "Could not save product",
		body: "Something went wrong. Check your details and try again.",
	},
	permission: {
		title: "Permission needed",
		body: "You do not have permission to create a product. Ask a store owner to grant access.",
	},
	provider: {
		title: "Temporarily unavailable",
		body: "This capability is temporarily unavailable. Your data is safe. Try again shortly.",
	},
};

export const PRODUCT_NEW_STATES = Object.keys(
	PRODUCT_NEW_STATE_COPY,
) as MerchantScreenState[];
