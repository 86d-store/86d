import type { MerchantScreenState } from "../../form/screen-states";

export const PRODUCT_LIST_FIXTURE_ID = "store-admin.products.v1";

export const PRODUCT_LIST_ROWS = [
	{
		id: "prod_fixture_1",
		name: "House Blend Coffee",
		slug: "house-blend-coffee",
		price: 1800,
		status: "active" as const,
		inventory: 42,
		isFeatured: true,
		images: [] as string[],
		tags: ["coffee"],
		sku: "HB-12",
		createdAt: "2026-01-15T12:00:00.000Z",
		updatedAt: "2026-02-01T12:00:00.000Z",
	},
	{
		id: "prod_fixture_2",
		name: "Ceramic Mug",
		slug: "ceramic-mug",
		price: 2400,
		status: "draft" as const,
		inventory: 10,
		isFeatured: false,
		images: [] as string[],
		tags: ["merch"],
		sku: "MUG-01",
		createdAt: "2026-01-20T12:00:00.000Z",
		updatedAt: "2026-01-20T12:00:00.000Z",
	},
];

export const PRODUCT_LIST_STATE_COPY: Record<
	MerchantScreenState,
	{ title: string; body: string }
> = {
	empty: {
		title: "No products yet",
		body: "Create the first product to get started.",
	},
	loading: {
		title: "Loading products",
		body: "Skeleton matching the loaded table layout.",
	},
	error: {
		title: "Could not load products",
		body: "Something went wrong loading this page. Try again in a moment.",
	},
	permission: {
		title: "Permission needed",
		body: "You do not have permission to view this. Ask a store owner or admin to grant access.",
	},
	provider: {
		title: "Temporarily unavailable",
		body: "This capability is temporarily unavailable. Your data is safe. Try again shortly.",
	},
};

export const PRODUCT_LIST_STATES = Object.keys(
	PRODUCT_LIST_STATE_COPY,
) as MerchantScreenState[];
