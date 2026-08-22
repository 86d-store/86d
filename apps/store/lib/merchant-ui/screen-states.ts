export const MERCHANT_SCREEN_STATES = [
	"empty",
	"loading",
	"error",
	"permission",
	"provider",
] as const;

export type MerchantScreenState = (typeof MERCHANT_SCREEN_STATES)[number];

export const LOCKED_MERCHANT_ROUTES = [
	{
		id: "console.businesses",
		plane: "private",
		path: "/businesses",
		role: "table-shell",
		owningPlan: "009",
	},
	{
		id: "console.businesses.create",
		plane: "private",
		path: "/businesses/create",
		role: "form",
		owningPlan: "009",
	},
	{
		id: "store-admin.products",
		plane: "public",
		path: "/admin/products",
		role: "table-shell",
		owningPlan: "009",
	},
	{
		id: "store-admin.products.new",
		plane: "public",
		path: "/admin/products/new",
		role: "form",
		owningPlan: "009",
	},
] as const;

export type LockedMerchantRouteId =
	(typeof LOCKED_MERCHANT_ROUTES)[number]["id"];
