export type SeedVariant = {
	key: string;
	name: string;
	sku: string;
	price: number;
	compareAtPrice?: number;
	costPrice?: number;
	inventory: number;
	options: Record<string, string>;
	weight?: number;
	weightUnit?: "kg" | "lb" | "oz" | "g";
};

export type SeedProduct = {
	key: string;
	name: string;
	slug: string;
	description: string;
	shortDescription: string;
	price: number;
	compareAtPrice?: number;
	costPrice?: number;
	sku: string;
	status: "active";
	categoryKey: string;
	trackInventory: boolean;
	allowBackorder: boolean;
	isFeatured: boolean;
	tags: string[];
	weight: number;
	weightUnit: "kg";
	metadata: Record<string, unknown>;
	imagePaths: string[];
	variants: SeedVariant[];
};

export type SeedCategory = {
	key: string;
	name: string;
	slug: string;
	description: string;
	imagePath: string;
	isVisible: boolean;
	position: number;
	metadata?: Record<string, unknown>;
};

export type SeedCollection = {
	key: string;
	name: string;
	slug: string;
	description: string;
	imagePath: string;
	isFeatured: boolean;
	isVisible: boolean;
	position: number;
	productKeys: string[];
	metadata?: Record<string, unknown>;
	seoTitle?: string;
	seoDescription?: string;
};

export type SeedBrand = {
	key: string;
	name: string;
	slug: string;
	description: string;
	logoPath: string;
	bannerImagePath: string;
	website: string;
	isActive: boolean;
	isFeatured: boolean;
	position: number;
	seoTitle: string;
	seoDescription: string;
};

export type SeedReview = {
	productKey: string;
	customerKey?: string;
	authorName: string;
	authorEmail: string;
	rating: number;
	title: string;
	body: string;
	status: "approved";
	isVerifiedPurchase: boolean;
	merchantResponse?: string;
};

export type SeedBlogPost = {
	key: string;
	title: string;
	slug: string;
	content: string;
	excerpt: string;
	coverImagePath: string;
	author: string;
	category: string;
	status: "published";
	featured: boolean;
	readingTime: number;
	tags: string[];
	metaTitle: string;
	metaDescription: string;
};

export type SeedPage = {
	key: string;
	title: string;
	slug: string;
	content: string;
	excerpt: string;
	status: "published";
	showInNavigation: boolean;
	position: number;
	featuredImagePath: string;
	metaTitle: string;
	metaDescription: string;
};

export type SeedCustomer = {
	key: string;
	email: string;
	firstName: string;
	lastName: string;
	phone: string;
	preferences?: Record<string, unknown>;
};

export type SeedCustomerAddress = {
	customerKey: string;
	type: "shipping" | "billing";
	firstName: string;
	lastName: string;
	line1: string;
	line2?: string;
	city: string;
	state: string;
	postalCode: string;
	country: string;
	isDefault: boolean;
};

type Colorway = {
	name: string;
	code: string;
	priceDelta?: number;
	compareAtDelta?: number;
	inventory: number;
};

type ShoeColorway = Colorway;
type StrapVariant = {
	name: string;
	code: string;
	finish: string;
	strap: string;
	inventory: number;
	priceDelta?: number;
	compareAtDelta?: number;
};

const SHOE_SIZES = ["38", "39", "40", "41"] as const;
const HAT_SIZES = ["S", "M", "L"] as const;

function productImagePaths(slug: string): string[] {
	return [`products/${slug}/hero.webp`, `products/${slug}/detail.webp`];
}

function categoryImagePath(slug: string): string {
	return `categories/${slug}.webp`;
}

function collectionImagePath(slug: string): string {
	return `collections/${slug}.webp`;
}

function blogImagePath(slug: string): string {
	return `blog/${slug}.webp`;
}

function pageImagePath(slug: string): string {
	return `pages/${slug}.webp`;
}

function shoeVariants(args: {
	productKey: string;
	productName: string;
	skuBase: string;
	price: number;
	compareAtPrice?: number;
	costPrice?: number;
	weight: number;
	colors: ShoeColorway[];
}): SeedVariant[] {
	const sizes = [...SHOE_SIZES];
	return args.colors.flatMap((color, colorIndex) =>
		sizes.map((size, sizeIndex) => ({
			key: `${args.productKey}:${color.code.toLowerCase()}-${size}`,
			name: `${args.productName} ${color.name} ${size}`,
			sku: `${args.skuBase}-${color.code}-${size}`,
			price: args.price + (color.priceDelta ?? 0),
			...(args.compareAtPrice != null && {
				compareAtPrice:
					args.compareAtPrice + (color.compareAtDelta ?? color.priceDelta ?? 0),
			}),
			...(args.costPrice != null && { costPrice: args.costPrice }),
			inventory: Math.max(color.inventory - sizeIndex - colorIndex, 1),
			options: { Color: color.name, Size: size },
			weight: args.weight,
			weightUnit: "kg",
		})),
	);
}

function watchVariants(args: {
	productKey: string;
	productName: string;
	skuBase: string;
	price: number;
	compareAtPrice?: number;
	costPrice?: number;
	variants: StrapVariant[];
	weight: number;
}): SeedVariant[] {
	return args.variants.map((variant) => ({
		key: `${args.productKey}:${variant.code.toLowerCase()}`,
		name: `${args.productName} ${variant.name}`,
		sku: `${args.skuBase}-${variant.code}`,
		price: args.price + (variant.priceDelta ?? 0),
		...(args.compareAtPrice != null && {
			compareAtPrice:
				args.compareAtPrice +
				(variant.compareAtDelta ?? variant.priceDelta ?? 0),
		}),
		...(args.costPrice != null && { costPrice: args.costPrice }),
		inventory: variant.inventory,
		options: { Finish: variant.finish, Strap: variant.strap },
		weight: args.weight,
		weightUnit: "kg",
	}));
}

function colorVariants(args: {
	productKey: string;
	productName: string;
	skuBase: string;
	price: number;
	compareAtPrice?: number;
	costPrice?: number;
	colors: Colorway[];
	weight: number;
	optionName?: string;
}): SeedVariant[] {
	return args.colors.map((color) => ({
		key: `${args.productKey}:${color.code.toLowerCase()}`,
		name: `${args.productName} ${color.name}`,
		sku: `${args.skuBase}-${color.code}`,
		price: args.price + (color.priceDelta ?? 0),
		...(args.compareAtPrice != null && {
			compareAtPrice:
				args.compareAtPrice + (color.compareAtDelta ?? color.priceDelta ?? 0),
		}),
		...(args.costPrice != null && { costPrice: args.costPrice }),
		inventory: color.inventory,
		options: { [args.optionName ?? "Color"]: color.name },
		weight: args.weight,
		weightUnit: "kg",
	}));
}

function hatVariants(args: {
	productKey: string;
	productName: string;
	skuBase: string;
	price: number;
	compareAtPrice?: number;
	costPrice?: number;
	colors: Colorway[];
	weight: number;
}): SeedVariant[] {
	return args.colors.flatMap((color, colorIndex) =>
		HAT_SIZES.map((size, sizeIndex) => ({
			key: `${args.productKey}:${color.code.toLowerCase()}-${size.toLowerCase()}`,
			name: `${args.productName} ${color.name} ${size}`,
			sku: `${args.skuBase}-${color.code}-${size}`,
			price: args.price + (color.priceDelta ?? 0),
			...(args.compareAtPrice != null && {
				compareAtPrice:
					args.compareAtPrice + (color.compareAtDelta ?? color.priceDelta ?? 0),
			}),
			...(args.costPrice != null && { costPrice: args.costPrice }),
			inventory: Math.max(color.inventory - sizeIndex - colorIndex, 1),
			options: { Color: color.name, Size: size },
			weight: args.weight,
			weightUnit: "kg",
		})),
	);
}

const footwearRegentVariants = shoeVariants({
	productKey: "regent-penny-loafer",
	productName: "Regent Penny Loafer",
	skuBase: "AT-REG",
	price: 89500,
	compareAtPrice: 99500,
	costPrice: 33200,
	weight: 0.92,
	colors: [
		{ name: "Onyx", code: "ONX", inventory: 8 },
		{ name: "Espresso", code: "ESP", inventory: 7 },
	],
});

const footwearMontclairVariants = shoeVariants({
	productKey: "montclair-chelsea-boot",
	productName: "Montclair Chelsea Boot",
	skuBase: "AT-MON",
	price: 124500,
	compareAtPrice: 139500,
	costPrice: 46100,
	weight: 1.14,
	colors: [
		{ name: "Walnut", code: "WLN", inventory: 6 },
		{ name: "Midnight", code: "MDN", inventory: 5 },
	],
});

const footwearSableVariants = shoeVariants({
	productKey: "sable-slingback-pump",
	productName: "Sable Slingback Pump",
	skuBase: "AT-SAB",
	price: 108500,
	compareAtPrice: 119500,
	costPrice: 39800,
	weight: 0.78,
	colors: [
		{ name: "Merlot", code: "MRL", inventory: 6 },
		{ name: "Sand", code: "SND", inventory: 5 },
	],
});

const footwearRivieraVariants = shoeVariants({
	productKey: "riviera-driving-shoe",
	productName: "Riviera Driving Shoe",
	skuBase: "AT-RIV",
	price: 79500,
	costPrice: 28400,
	weight: 0.74,
	colors: [
		{ name: "Tobacco", code: "TOB", inventory: 7 },
		{ name: "Stone", code: "STN", inventory: 6, priceDelta: 2000 },
	],
});

const meridianVariants = watchVariants({
	productKey: "meridian-automatic-38",
	productName: "Meridian Automatic 38",
	skuBase: "AT-MER",
	price: 265000,
	compareAtPrice: 295000,
	costPrice: 121000,
	weight: 0.18,
	variants: [
		{
			name: "Steel / Black Alligator",
			code: "SBK",
			finish: "Steel",
			strap: "Black Alligator",
			inventory: 4,
		},
		{
			name: "Gold / Chestnut Calf",
			code: "GCT",
			finish: "Gold Tone",
			strap: "Chestnut Calf",
			inventory: 3,
			priceDelta: 12000,
			compareAtDelta: 12000,
		},
	],
});

const observatoryVariants = watchVariants({
	productKey: "observatory-chronograph",
	productName: "Observatory Chronograph",
	skuBase: "AT-OBS",
	price: 345000,
	compareAtPrice: 395000,
	costPrice: 158000,
	weight: 0.22,
	variants: [
		{
			name: "Steel / Slate Strap",
			code: "SSL",
			finish: "Steel",
			strap: "Slate Calf",
			inventory: 3,
		},
		{
			name: "Rose / Cocoa Strap",
			code: "RCC",
			finish: "Rose Tone",
			strap: "Cocoa Calf",
			inventory: 2,
			priceDelta: 15000,
			compareAtDelta: 15000,
		},
	],
});

const passageVariants = watchVariants({
	productKey: "passage-gmt",
	productName: "Passage GMT",
	skuBase: "AT-PAS",
	price: 318000,
	costPrice: 146000,
	weight: 0.2,
	variants: [
		{
			name: "Steel / Traveler Bracelet",
			code: "STB",
			finish: "Steel",
			strap: "Steel Bracelet",
			inventory: 3,
		},
		{
			name: "Gunmetal / Navy Strap",
			code: "GNV",
			finish: "Gunmetal",
			strap: "Navy Calf",
			inventory: 2,
			priceDelta: 9000,
		},
	],
});

const palaisVariants = colorVariants({
	productKey: "palais-top-handle",
	productName: "Palais Top Handle",
	skuBase: "AT-PAL",
	price: 165000,
	compareAtPrice: 182000,
	costPrice: 64200,
	weight: 0.88,
	colors: [
		{ name: "Chestnut", code: "CHT", inventory: 5 },
		{
			name: "Ink",
			code: "INK",
			inventory: 4,
			priceDelta: 5000,
			compareAtDelta: 5000,
		},
		{
			name: "Bone",
			code: "BON",
			inventory: 3,
			priceDelta: 8000,
			compareAtDelta: 8000,
		},
	],
});

const galerieVariants = colorVariants({
	productKey: "galerie-chain-shoulder-bag",
	productName: "Galerie Chain Shoulder Bag",
	skuBase: "AT-GAL",
	price: 142000,
	costPrice: 56100,
	weight: 0.72,
	colors: [
		{ name: "Obsidian", code: "OBS", inventory: 5 },
		{ name: "Toffee", code: "TOF", inventory: 4 },
		{ name: "Smoke", code: "SMK", inventory: 3, priceDelta: 3000 },
	],
});

const avenueVariants = colorVariants({
	productKey: "avenue-crescent-clutch",
	productName: "Avenue Crescent Clutch",
	skuBase: "AT-AVE",
	price: 98000,
	compareAtPrice: 112000,
	costPrice: 38200,
	weight: 0.46,
	colors: [
		{ name: "Sable", code: "SBL", inventory: 5 },
		{
			name: "Merlot",
			code: "MRL",
			inventory: 4,
			priceDelta: 3000,
			compareAtDelta: 3000,
		},
		{
			name: "Champagne",
			code: "CHP",
			inventory: 3,
			priceDelta: 6000,
			compareAtDelta: 6000,
		},
	],
});

const continentalVariants = colorVariants({
	productKey: "continental-zip-wallet",
	productName: "Continental Zip Wallet",
	skuBase: "AT-CON",
	price: 52500,
	compareAtPrice: 59500,
	costPrice: 19600,
	weight: 0.22,
	colors: [
		{ name: "Truffle", code: "TRF", inventory: 11 },
		{ name: "Cedar", code: "CED", inventory: 9 },
	],
});

const cardCaseVariants = colorVariants({
	productKey: "atelier-card-case",
	productName: "Atelier Card Case",
	skuBase: "AT-CRD",
	price: 28500,
	costPrice: 10200,
	weight: 0.08,
	colors: [
		{ name: "Ink", code: "INK", inventory: 14 },
		{ name: "Mulberry", code: "MLB", inventory: 10, priceDelta: 2000 },
	],
});

const passportVariants = colorVariants({
	productKey: "grand-tour-passport-folio",
	productName: "Grand Tour Passport Folio",
	skuBase: "AT-GTP",
	price: 44500,
	compareAtPrice: 49500,
	costPrice: 15800,
	weight: 0.18,
	colors: [
		{ name: "Cognac", code: "COG", inventory: 9 },
		{
			name: "Midnight",
			code: "MDN",
			inventory: 7,
			priceDelta: 2500,
			compareAtDelta: 2500,
		},
	],
});

const capVariants = hatVariants({
	productKey: "cashmere-cap",
	productName: "Cashmere Cap",
	skuBase: "AT-CAP",
	price: 21500,
	costPrice: 8200,
	weight: 0.16,
	colors: [
		{ name: "Heather Taupe", code: "HTP", inventory: 8 },
		{ name: "Cinder", code: "CND", inventory: 7 },
	],
});

const silkVariants = colorVariants({
	productKey: "silk-twill-wrap",
	productName: "Silk Twill Wrap",
	skuBase: "AT-STW",
	price: 36500,
	compareAtPrice: 42500,
	costPrice: 13600,
	weight: 0.12,
	colors: [
		{ name: "Cameo Rose", code: "CMR", inventory: 8 },
		{
			name: "Ivory Noir",
			code: "IVN",
			inventory: 6,
			priceDelta: 2500,
			compareAtDelta: 2500,
		},
	],
});

const cashmereScarfVariants = colorVariants({
	productKey: "cashmere-fringe-scarf",
	productName: "Cashmere Fringe Scarf",
	skuBase: "AT-CSH",
	price: 49500,
	costPrice: 18100,
	weight: 0.24,
	colors: [
		{ name: "Camel", code: "CAM", inventory: 8 },
		{ name: "Graphite", code: "GRF", inventory: 6 },
	],
});

export const houseBrand: SeedBrand = {
	key: "86d-atelier",
	name: "86d Atelier",
	slug: "86d-atelier",
	description:
		"86d Atelier is a fictional house label built for this seed: a quiet luxury collection of leather goods, timepieces, and travel-ready accessories shaped by restrained design and craft-first materials.",
	logoPath: "brand/logo.webp",
	bannerImagePath: "brand/banner.webp",
	website: "https://atelier.86d.app",
	isActive: true,
	isFeatured: true,
	position: 0,
	seoTitle: "86d Atelier",
	seoDescription:
		"Quiet luxury accessories, footwear, and timepieces curated for the 86d seed storefront.",
};

export const categories: SeedCategory[] = [
	{
		key: "footwear",
		name: "Footwear",
		slug: "footwear",
		description:
			"Hand-finished loafers, boots, and evening shoes designed with sculpted lines and supple leather.",
		imagePath: categoryImagePath("footwear"),
		isVisible: true,
		position: 0,
		metadata: { department: "accessories", materials: ["calfskin", "suede"] },
	},
	{
		key: "timepieces",
		name: "Timepieces",
		slug: "timepieces",
		description:
			"Automatic watches and travel chronographs with understated finishing and heirloom intent.",
		imagePath: categoryImagePath("timepieces"),
		isVisible: true,
		position: 1,
		metadata: { department: "accessories", materials: ["steel", "calfskin"] },
	},
	{
		key: "handbags",
		name: "Handbags",
		slug: "handbags",
		description:
			"Structured silhouettes, chain bags, and clutches in polished leather and tactile neutrals.",
		imagePath: categoryImagePath("handbags"),
		isVisible: true,
		position: 2,
		metadata: { department: "accessories", materials: ["leather"] },
	},
	{
		key: "small-leather-goods",
		name: "Small Leather Goods",
		slug: "small-leather-goods",
		description:
			"Travel folios, wallets, and card cases cut from the same house leathers as the main line.",
		imagePath: categoryImagePath("small-leather-goods"),
		isVisible: true,
		position: 3,
		metadata: { department: "accessories", materials: ["leather"] },
	},
	{
		key: "headwear",
		name: "Headwear",
		slug: "headwear",
		description:
			"Soft cashmere headwear designed for cold-weather elegance and easy travel.",
		imagePath: categoryImagePath("headwear"),
		isVisible: true,
		position: 4,
		metadata: { department: "apparel", materials: ["cashmere"] },
	},
	{
		key: "scarves",
		name: "Scarves",
		slug: "scarves",
		description:
			"Silk twill wraps and cashmere scarves with tonal palettes and tactile drape.",
		imagePath: categoryImagePath("scarves"),
		isVisible: true,
		position: 5,
		metadata: { department: "apparel", materials: ["silk", "cashmere"] },
	},
];

export const products: SeedProduct[] = [
	{
		key: "regent-penny-loafer",
		name: "Regent Penny Loafer",
		slug: "regent-penny-loafer",
		shortDescription:
			"Hand-burnished calfskin loafer with a refined almond toe.",
		description:
			"A house signature loafer shaped in smooth calfskin with a hand-burnished finish, leather sole, and softly structured heel. Designed to bridge tailoring, denim, and travel wardrobes without visual noise.",
		price: 89500,
		compareAtPrice: 99500,
		costPrice: 33200,
		sku: "AT-REG",
		status: "active",
		categoryKey: "footwear",
		trackInventory: true,
		allowBackorder: false,
		isFeatured: true,
		tags: ["loafer", "calfskin", "quiet-luxury", "atelier"],
		weight: 0.92,
		weightUnit: "kg",
		metadata: {
			material: "Hand-burnished calfskin",
			madeIn: "Italy",
			craftNote: "Leather sole with soft stacked heel",
			styling: ["tailoring", "travel", "weekend"],
		},
		imagePaths: productImagePaths("regent-penny-loafer"),
		variants: footwearRegentVariants,
	},
	{
		key: "montclair-chelsea-boot",
		name: "Montclair Chelsea Boot",
		slug: "montclair-chelsea-boot",
		shortDescription:
			"Slim Chelsea boot with tonal gussets and polished edge finish.",
		description:
			"A sleek Chelsea boot cut for everyday structure, with tonal elastic gussets, calfskin lining, and a softly squared toe. Built to carry seasonal outerwear and clean knitwear with equal ease.",
		price: 124500,
		compareAtPrice: 139500,
		costPrice: 46100,
		sku: "AT-MON",
		status: "active",
		categoryKey: "footwear",
		trackInventory: true,
		allowBackorder: false,
		isFeatured: false,
		tags: ["chelsea-boot", "leather", "fall", "atelier"],
		weight: 1.14,
		weightUnit: "kg",
		metadata: {
			material: "Polished calfskin",
			madeIn: "Italy",
			craftNote: "Elastic gusset and stacked leather heel",
			styling: ["outerwear", "tailoring", "city"],
		},
		imagePaths: productImagePaths("montclair-chelsea-boot"),
		variants: footwearMontclairVariants,
	},
	{
		key: "sable-slingback-pump",
		name: "Sable Slingback Pump",
		slug: "sable-slingback-pump",
		shortDescription:
			"Pointed slingback pump with balanced heel and satin lining.",
		description:
			"A polished evening shoe with a sculpted slingback profile, tapered heel, and softly cushioned insole. The silhouette is designed for long dinners, gallery openings, and black-tie travel.",
		price: 108500,
		compareAtPrice: 119500,
		costPrice: 39800,
		sku: "AT-SAB",
		status: "active",
		categoryKey: "footwear",
		trackInventory: true,
		allowBackorder: false,
		isFeatured: true,
		tags: ["pump", "slingback", "evening", "atelier"],
		weight: 0.78,
		weightUnit: "kg",
		metadata: {
			material: "Gloss calfskin",
			madeIn: "Italy",
			craftNote: "Pointed toe with balanced 70mm heel",
			styling: ["evening", "occasion", "tailoring"],
		},
		imagePaths: productImagePaths("sable-slingback-pump"),
		variants: footwearSableVariants,
	},
	{
		key: "riviera-driving-shoe",
		name: "Riviera Driving Shoe",
		slug: "riviera-driving-shoe",
		shortDescription: "Soft suede driving shoe with hand-tied apron stitching.",
		description:
			"A supple suede driving shoe finished with tonal stitching and flexible rubber pods. The Riviera is built for hotel lobbies, summer itineraries, and a lighter travel wardrobe.",
		price: 79500,
		costPrice: 28400,
		sku: "AT-RIV",
		status: "active",
		categoryKey: "footwear",
		trackInventory: true,
		allowBackorder: false,
		isFeatured: false,
		tags: ["driving-shoe", "suede", "travel", "atelier"],
		weight: 0.74,
		weightUnit: "kg",
		metadata: {
			material: "Supple suede",
			madeIn: "Italy",
			craftNote: "Hand-tied apron stitch and flexible sole",
			styling: ["travel", "summer", "resort"],
		},
		imagePaths: productImagePaths("riviera-driving-shoe"),
		variants: footwearRivieraVariants,
	},
	{
		key: "meridian-automatic-38",
		name: "Meridian Automatic 38",
		slug: "meridian-automatic-38",
		shortDescription:
			"Compact automatic watch with domed crystal and brushed lugs.",
		description:
			"A restrained 38mm automatic watch with domed crystal, brushed lugs, and a quiet dial layout. It is the sort of piece that reads deliberate rather than loud, and anchors the house timepiece offering.",
		price: 265000,
		compareAtPrice: 295000,
		costPrice: 121000,
		sku: "AT-MER",
		status: "active",
		categoryKey: "timepieces",
		trackInventory: true,
		allowBackorder: false,
		isFeatured: true,
		tags: ["watch", "automatic", "dress-watch", "atelier"],
		weight: 0.18,
		weightUnit: "kg",
		metadata: {
			material: "Steel case and leather strap",
			movement: "Automatic",
			caseSize: "38mm",
			waterResistance: "50m",
		},
		imagePaths: productImagePaths("meridian-automatic-38"),
		variants: meridianVariants,
	},
	{
		key: "observatory-chronograph",
		name: "Observatory Chronograph",
		slug: "observatory-chronograph",
		shortDescription: "Sport-luxury chronograph with warm metallic detailing.",
		description:
			"A three-register chronograph with a clean bezel, layered dial, and modern case finishing. It balances daily wear and occasion polish without leaning into overt sport cues.",
		price: 345000,
		compareAtPrice: 395000,
		costPrice: 158000,
		sku: "AT-OBS",
		status: "active",
		categoryKey: "timepieces",
		trackInventory: true,
		allowBackorder: false,
		isFeatured: true,
		tags: ["watch", "chronograph", "timepiece", "atelier"],
		weight: 0.22,
		weightUnit: "kg",
		metadata: {
			material: "Steel or rose-tone case",
			movement: "Automatic chronograph",
			caseSize: "40mm",
			waterResistance: "100m",
		},
		imagePaths: productImagePaths("observatory-chronograph"),
		variants: observatoryVariants,
	},
	{
		key: "passage-gmt",
		name: "Passage GMT",
		slug: "passage-gmt",
		shortDescription: "Travel-ready GMT watch with dual-time functionality.",
		description:
			"A GMT model designed around frequent movement: compact enough for daily wear, precise enough for international itineraries, and visually aligned with the rest of the house collection.",
		price: 318000,
		costPrice: 146000,
		sku: "AT-PAS",
		status: "active",
		categoryKey: "timepieces",
		trackInventory: true,
		allowBackorder: false,
		isFeatured: false,
		tags: ["watch", "gmt", "travel", "atelier"],
		weight: 0.2,
		weightUnit: "kg",
		metadata: {
			material: "Steel case",
			movement: "Automatic GMT",
			caseSize: "39mm",
			waterResistance: "100m",
		},
		imagePaths: productImagePaths("passage-gmt"),
		variants: passageVariants,
	},
	{
		key: "palais-top-handle",
		name: "Palais Top Handle",
		slug: "palais-top-handle",
		shortDescription:
			"Structured top-handle bag with interior gusset organization.",
		description:
			"A polished top-handle silhouette in smooth leather with a softly rigid frame, interior gussets, and discreet hardware. The Palais anchors the main handbag assortment with a formal, enduring shape.",
		price: 165000,
		compareAtPrice: 182000,
		costPrice: 64200,
		sku: "AT-PAL",
		status: "active",
		categoryKey: "handbags",
		trackInventory: true,
		allowBackorder: false,
		isFeatured: true,
		tags: ["top-handle", "handbag", "leather", "atelier"],
		weight: 0.88,
		weightUnit: "kg",
		metadata: {
			material: "Smooth calf leather",
			craftNote: "Structured interior with suede lining",
			carry: ["top-handle", "crossbody"],
		},
		imagePaths: productImagePaths("palais-top-handle"),
		variants: palaisVariants,
	},
	{
		key: "galerie-chain-shoulder-bag",
		name: "Galerie Chain Shoulder Bag",
		slug: "galerie-chain-shoulder-bag",
		shortDescription:
			"Refined shoulder bag with brushed chain strap and soft body.",
		description:
			"A compact chain shoulder bag designed for day-to-evening transitions, with a fluid silhouette, magnetic closure, and brushed metal details that stay deliberately understated.",
		price: 142000,
		costPrice: 56100,
		sku: "AT-GAL",
		status: "active",
		categoryKey: "handbags",
		trackInventory: true,
		allowBackorder: false,
		isFeatured: false,
		tags: ["shoulder-bag", "chain-bag", "leather", "atelier"],
		weight: 0.72,
		weightUnit: "kg",
		metadata: {
			material: "Polished calf leather",
			craftNote: "Brushed chain hardware and magnetic flap",
			carry: ["shoulder"],
		},
		imagePaths: productImagePaths("galerie-chain-shoulder-bag"),
		variants: galerieVariants,
	},
	{
		key: "avenue-crescent-clutch",
		name: "Avenue Crescent Clutch",
		slug: "avenue-crescent-clutch",
		shortDescription:
			"Compact crescent clutch for evening wear and formal travel.",
		description:
			"A softly curved clutch with tonal lining and a slim profile designed for evening use. The Avenue works as a dress bag without tipping into novelty or trend-driven proportions.",
		price: 98000,
		compareAtPrice: 112000,
		costPrice: 38200,
		sku: "AT-AVE",
		status: "active",
		categoryKey: "handbags",
		trackInventory: true,
		allowBackorder: false,
		isFeatured: true,
		tags: ["clutch", "evening", "leather", "atelier"],
		weight: 0.46,
		weightUnit: "kg",
		metadata: {
			material: "Gloss calf leather",
			craftNote: "Slim crescent silhouette with hidden closure",
			carry: ["hand", "occasion"],
		},
		imagePaths: productImagePaths("avenue-crescent-clutch"),
		variants: avenueVariants,
	},
	{
		key: "continental-zip-wallet",
		name: "Continental Zip Wallet",
		slug: "continental-zip-wallet",
		shortDescription:
			"Long zip wallet with full-length compartments and smooth finish.",
		description:
			"A travel-ready zip wallet with room for full-length notes, a phone, and organized card storage. Cut from the same smooth leathers used in the handbag collection for a consistent house feel.",
		price: 52500,
		compareAtPrice: 59500,
		costPrice: 19600,
		sku: "AT-CON",
		status: "active",
		categoryKey: "small-leather-goods",
		trackInventory: true,
		allowBackorder: false,
		isFeatured: false,
		tags: ["wallet", "zip-wallet", "travel", "atelier"],
		weight: 0.22,
		weightUnit: "kg",
		metadata: {
			material: "Smooth calf leather",
			craftNote: "Full zip closure and 12-card interior",
			usage: ["travel", "daily"],
		},
		imagePaths: productImagePaths("continental-zip-wallet"),
		variants: continentalVariants,
	},
	{
		key: "atelier-card-case",
		name: "Atelier Card Case",
		slug: "atelier-card-case",
		shortDescription:
			"Slim card case with edge-painted finish and tonal lining.",
		description:
			"A compact card case for light travel and evening use, with a softly structured body and precisely edge-painted seams. It is the quietest entry point into the leather assortment.",
		price: 28500,
		costPrice: 10200,
		sku: "AT-CRD",
		status: "active",
		categoryKey: "small-leather-goods",
		trackInventory: true,
		allowBackorder: false,
		isFeatured: false,
		tags: ["card-case", "wallet", "gift", "atelier"],
		weight: 0.08,
		weightUnit: "kg",
		metadata: {
			material: "Polished calf leather",
			craftNote: "Slim profile with center slip pocket",
			usage: ["gift", "daily", "evening"],
		},
		imagePaths: productImagePaths("atelier-card-case"),
		variants: cardCaseVariants,
	},
	{
		key: "grand-tour-passport-folio",
		name: "Grand Tour Passport Folio",
		slug: "grand-tour-passport-folio",
		shortDescription:
			"Travel folio with passport sleeve, boarding pass slot, and pen loop.",
		description:
			"A compact folio designed for airport movement, hotel check-ins, and desk-side organization. The Grand Tour balances function and polish without adding bulk to a carry-on.",
		price: 44500,
		compareAtPrice: 49500,
		costPrice: 15800,
		sku: "AT-GTP",
		status: "active",
		categoryKey: "small-leather-goods",
		trackInventory: true,
		allowBackorder: false,
		isFeatured: true,
		tags: ["passport-folio", "travel", "gift", "atelier"],
		weight: 0.18,
		weightUnit: "kg",
		metadata: {
			material: "Smooth calf leather",
			craftNote: "Passport slot, boarding pass sleeve, pen loop",
			usage: ["travel", "gift"],
		},
		imagePaths: productImagePaths("grand-tour-passport-folio"),
		variants: passportVariants,
	},
	{
		key: "cashmere-cap",
		name: "Cashmere Cap",
		slug: "cashmere-cap",
		shortDescription: "Soft-brushed cashmere cap with minimal seaming.",
		description:
			"A refined cashmere cap that brings warmth without heaviness. The silhouette is pared back, tonal, and designed to sit comfortably within a travel or winter capsule wardrobe.",
		price: 21500,
		costPrice: 8200,
		sku: "AT-CAP",
		status: "active",
		categoryKey: "headwear",
		trackInventory: true,
		allowBackorder: false,
		isFeatured: false,
		tags: ["cashmere", "cap", "winter", "atelier"],
		weight: 0.16,
		weightUnit: "kg",
		metadata: {
			material: "Brushed cashmere blend",
			craftNote: "Soft brushed hand with tonal seam finish",
			usage: ["winter", "travel"],
		},
		imagePaths: productImagePaths("cashmere-cap"),
		variants: capVariants,
	},
	{
		key: "silk-twill-wrap",
		name: "Silk Twill Wrap",
		slug: "silk-twill-wrap",
		shortDescription:
			"Printed silk twill wrap with fluid drape and polished edge.",
		description:
			"A lightweight silk wrap designed for layering, gifting, and travel styling. The palette stays grounded in tonal neutrals, allowing the material and movement to carry the visual interest.",
		price: 36500,
		compareAtPrice: 42500,
		costPrice: 13600,
		sku: "AT-STW",
		status: "active",
		categoryKey: "scarves",
		trackInventory: true,
		allowBackorder: false,
		isFeatured: true,
		tags: ["silk", "wrap", "gift", "atelier"],
		weight: 0.12,
		weightUnit: "kg",
		metadata: {
			material: "Silk twill",
			craftNote: "Hand-rolled edge finish",
			usage: ["gift", "travel", "evening"],
		},
		imagePaths: productImagePaths("silk-twill-wrap"),
		variants: silkVariants,
	},
	{
		key: "cashmere-fringe-scarf",
		name: "Cashmere Fringe Scarf",
		slug: "cashmere-fringe-scarf",
		shortDescription:
			"Brushed cashmere scarf with tonal fringe and generous length.",
		description:
			"A generously scaled cashmere scarf with a soft brushed finish and restrained fringe. Intended for winter layering, airport travel, and gift giving without feeling seasonal-only.",
		price: 49500,
		costPrice: 18100,
		sku: "AT-CSH",
		status: "active",
		categoryKey: "scarves",
		trackInventory: true,
		allowBackorder: false,
		isFeatured: false,
		tags: ["cashmere", "scarf", "winter", "atelier"],
		weight: 0.24,
		weightUnit: "kg",
		metadata: {
			material: "Cashmere",
			craftNote: "Brushed finish and tonal fringe edge",
			usage: ["winter", "travel", "gift"],
		},
		imagePaths: productImagePaths("cashmere-fringe-scarf"),
		variants: cashmereScarfVariants,
	},
];

export const collections: SeedCollection[] = [
	{
		key: "house-icons",
		name: "House Icons",
		slug: "house-icons",
		description:
			"The signature pieces that define the 86d Atelier point of view: polished leather, compact timepieces, and modern occasion accessories.",
		imagePath: collectionImagePath("house-icons"),
		isFeatured: true,
		isVisible: true,
		position: 0,
		productKeys: [
			"regent-penny-loafer",
			"meridian-automatic-38",
			"palais-top-handle",
			"silk-twill-wrap",
		],
		metadata: { mood: "signature" },
		seoTitle: "House Icons | 86d Atelier",
		seoDescription:
			"Discover the house signatures of the 86d Atelier luxury seed catalog.",
	},
	{
		key: "leather-atelier",
		name: "Leather Atelier",
		slug: "leather-atelier",
		description:
			"A study in leather craft, from softly structured handbags to travel folios and polished boots.",
		imagePath: collectionImagePath("leather-atelier"),
		isFeatured: true,
		isVisible: true,
		position: 1,
		productKeys: [
			"montclair-chelsea-boot",
			"palais-top-handle",
			"galerie-chain-shoulder-bag",
			"continental-zip-wallet",
			"atelier-card-case",
			"grand-tour-passport-folio",
		],
		metadata: { mood: "craft" },
	},
	{
		key: "timepiece-gallery",
		name: "Timepiece Gallery",
		slug: "timepiece-gallery",
		description:
			"Automatic watches and chronographs designed to feel precise, quiet, and travel-ready.",
		imagePath: collectionImagePath("timepiece-gallery"),
		isFeatured: true,
		isVisible: true,
		position: 2,
		productKeys: [
			"meridian-automatic-38",
			"observatory-chronograph",
			"passage-gmt",
		],
		metadata: { mood: "precision" },
	},
	{
		key: "travel-salon",
		name: "Travel Salon",
		slug: "travel-salon",
		description:
			"A compact edit for movement: lightweight footwear, precise timekeeping, and elegant travel companions.",
		imagePath: collectionImagePath("travel-salon"),
		isFeatured: false,
		isVisible: true,
		position: 3,
		productKeys: [
			"riviera-driving-shoe",
			"passage-gmt",
			"galerie-chain-shoulder-bag",
			"grand-tour-passport-folio",
			"cashmere-cap",
			"silk-twill-wrap",
		],
		metadata: { mood: "travel" },
	},
	{
		key: "evening-edit",
		name: "Evening Edit",
		slug: "evening-edit",
		description:
			"A focused evening edit built around sculpted shoes, compact bags, silk, and warm metallic detail.",
		imagePath: collectionImagePath("evening-edit"),
		isFeatured: false,
		isVisible: true,
		position: 4,
		productKeys: [
			"sable-slingback-pump",
			"avenue-crescent-clutch",
			"galerie-chain-shoulder-bag",
			"silk-twill-wrap",
		],
		metadata: { mood: "evening" },
	},
	{
		key: "gift-selection",
		name: "Gift Selection",
		slug: "gift-selection",
		description:
			"Thoughtful entry points into the house, from card cases and travel folios to silk and cashmere accessories.",
		imagePath: collectionImagePath("gift-selection"),
		isFeatured: false,
		isVisible: true,
		position: 5,
		productKeys: [
			"atelier-card-case",
			"continental-zip-wallet",
			"grand-tour-passport-folio",
			"cashmere-cap",
			"silk-twill-wrap",
			"cashmere-fringe-scarf",
		],
		metadata: { mood: "gifting" },
	},
];

export const customers: SeedCustomer[] = [
	{
		key: "eleanor-vale",
		email: "eleanor@example.com",
		firstName: "Eleanor",
		lastName: "Vale",
		phone: "+1-212-555-0111",
		preferences: { style: "tailored", channel: "appointment" },
	},
	{
		key: "marcus-chen",
		email: "marcus@example.com",
		firstName: "Marcus",
		lastName: "Chen",
		phone: "+1-312-555-0194",
		preferences: { style: "travel", channel: "email" },
	},
	{
		key: "sofia-alvarez",
		email: "sofia@example.com",
		firstName: "Sofia",
		lastName: "Alvarez",
		phone: "+1-214-555-0188",
		preferences: { style: "occasion", channel: "sms" },
	},
];

export const customerAddresses: SeedCustomerAddress[] = [
	{
		customerKey: "eleanor-vale",
		type: "shipping",
		firstName: "Eleanor",
		lastName: "Vale",
		line1: "31 Bond Street",
		city: "New York",
		state: "NY",
		postalCode: "10012",
		country: "US",
		isDefault: true,
	},
	{
		customerKey: "marcus-chen",
		type: "shipping",
		firstName: "Marcus",
		lastName: "Chen",
		line1: "920 W Fulton Market",
		city: "Chicago",
		state: "IL",
		postalCode: "60607",
		country: "US",
		isDefault: true,
	},
];

export const storeSettings = [
	{ key: "general.store_name", value: "86d Atelier", group: "general" },
	{
		key: "general.store_description",
		value:
			"Quiet luxury accessories, leather goods, and timepieces with a craft-first point of view.",
		group: "general",
	},
	{ key: "general.timezone", value: "America/New_York", group: "general" },
	{
		key: "contact.support_email",
		value: "concierge@atelier.86d.app",
		group: "contact",
	},
	{
		key: "contact.support_phone",
		value: "+1-212-555-0108",
		group: "contact",
	},
	{
		key: "contact.business_address",
		value: "18 Mercer Street",
		group: "contact",
	},
	{ key: "contact.business_city", value: "New York", group: "contact" },
	{ key: "contact.business_state", value: "NY", group: "contact" },
	{ key: "contact.business_postal_code", value: "10013", group: "contact" },
	{ key: "contact.business_country", value: "US", group: "contact" },
	{ key: "commerce.currency", value: "USD", group: "commerce" },
	{ key: "commerce.weight_unit", value: "kg", group: "commerce" },
	{ key: "commerce.tax_included", value: "false", group: "commerce" },
];

export const navigationItems = [
	{ label: "Home", url: "/", position: 0 },
	{ label: "Shop", url: "/products", position: 1 },
	{ label: "Collections", url: "/collections", position: 2 },
	{ label: "Journal", url: "/blog", position: 3 },
	{ label: "Concierge", url: "/concierge", position: 4 },
	{ label: "Appointment", url: "/contact", position: 5 },
];

export const blogPosts: SeedBlogPost[] = [
	{
		key: "inside-the-atelier",
		title: "Inside the Atelier",
		slug: "inside-the-atelier",
		content:
			"Quiet luxury starts with restraint. Our leather goods are built from polished calfskin, cut into shapes that feel architectural but never severe, then finished with tonal edge paint and hardware that recedes instead of shouts. The goal is a wardrobe of objects that improve with use rather than announce themselves on day one.",
		excerpt:
			"A look at the materials, finishing, and quiet decisions behind the 86d Atelier house line.",
		coverImagePath: blogImagePath("inside-the-atelier"),
		author: "Atelier Journal",
		category: "craftsmanship",
		status: "published",
		featured: true,
		readingTime: 4,
		tags: ["craftsmanship", "leather", "journal"],
		metaTitle: "Inside the Atelier",
		metaDescription:
			"Discover the materials and craftsmanship behind the 86d Atelier seed collection.",
	},
	{
		key: "packing-the-travel-salon",
		title: "Packing the Travel Salon",
		slug: "packing-the-travel-salon",
		content:
			"A thoughtful travel wardrobe is less about volume and more about compatibility. The Travel Salon edit pairs driving shoes, a GMT timepiece, a chain shoulder bag, and a passport folio so that every piece earns its place. Each item is designed to move easily from airport lounge to dinner reservation without changing the visual language.",
		excerpt:
			"Six house pieces for a compact travel wardrobe that still feels polished on arrival.",
		coverImagePath: blogImagePath("packing-the-travel-salon"),
		author: "Atelier Journal",
		category: "travel",
		status: "published",
		featured: false,
		readingTime: 3,
		tags: ["travel", "styling", "journal"],
		metaTitle: "Packing the Travel Salon",
		metaDescription:
			"Build a polished travel wardrobe with the 86d Atelier Travel Salon edit.",
	},
	{
		key: "the-art-of-gifting",
		title: "The Art of Gifting",
		slug: "the-art-of-gifting",
		content:
			"The best luxury gifts feel chosen, not generic. A silk wrap for someone who travels light, a travel folio for a frequent flyer, or a card case for a first house piece all communicate care without excess. Our Gift Selection is designed around those quiet gestures.",
		excerpt:
			"How to choose a considered gift across silk, cashmere, and small leather goods.",
		coverImagePath: blogImagePath("the-art-of-gifting"),
		author: "Atelier Journal",
		category: "gifting",
		status: "published",
		featured: false,
		readingTime: 3,
		tags: ["gifting", "silk", "cashmere", "journal"],
		metaTitle: "The Art of Gifting",
		metaDescription: "A gifting guide across the 86d Atelier seed assortment.",
	},
];

export const pages: SeedPage[] = [
	{
		key: "about",
		title: "About 86d Atelier",
		slug: "about",
		content:
			"86d Atelier is a fictional luxury house created for seed data, centered on travel-ready leather goods, compact timepieces, and accessories with quiet confidence. The assortment is designed to feel editorial yet practical, polished yet never loud.",
		excerpt: "The story and point of view behind the 86d Atelier house line.",
		status: "published",
		showInNavigation: false,
		position: 0,
		featuredImagePath: pageImagePath("about"),
		metaTitle: "About 86d Atelier",
		metaDescription:
			"Learn the point of view behind the 86d Atelier seed storefront.",
	},
	{
		key: "contact",
		title: "Contact",
		slug: "contact",
		content:
			"Reach the Atelier Concierge at concierge@atelier.86d.app or +1-212-555-0108. Our team handles product questions, gifting guidance, and appointment requests Monday through Saturday from 10am to 7pm Eastern.",
		excerpt:
			"Contact the Atelier Concierge for product, gifting, and appointment support.",
		status: "published",
		showInNavigation: false,
		position: 1,
		featuredImagePath: pageImagePath("contact"),
		metaTitle: "Contact 86d Atelier",
		metaDescription: "Get in touch with the 86d Atelier Concierge.",
	},
	{
		key: "concierge",
		title: "Concierge Services",
		slug: "concierge",
		content:
			"Our concierge offering covers guided gifting, private appointments, travel packing edits, and extended product guidance. For flagship clients we also offer coordinated showroom pickup and premium delivery windows where available.",
		excerpt:
			"Appointment booking, guided gifting, and premium support services.",
		status: "published",
		showInNavigation: true,
		position: 2,
		featuredImagePath: pageImagePath("concierge"),
		metaTitle: "Concierge Services",
		metaDescription:
			"Private appointments, guided gifting, and premium support from 86d Atelier.",
	},
	{
		key: "shipping-returns",
		title: "Shipping & Returns",
		slug: "shipping-returns",
		content:
			"Orders over $750 receive complimentary insured ground shipping in the continental US. Express and premium metro delivery options are available at checkout where applicable. Returns are accepted within 21 days in original condition, with concierge-assisted exchanges for timepieces and leather goods.",
		excerpt:
			"Shipping thresholds, insured delivery, and returns for the 86d Atelier seed store.",
		status: "published",
		showInNavigation: false,
		position: 3,
		featuredImagePath: pageImagePath("shipping-returns"),
		metaTitle: "Shipping & Returns",
		metaDescription:
			"Insured shipping and concise returns guidance for 86d Atelier.",
	},
	{
		key: "care-guide",
		title: "Care Guide",
		slug: "care-guide",
		content:
			"Leather pieces should be stored upright in their dust bags and conditioned lightly as needed. Silk should be folded flat or rolled, and cashmere should rest between wears. For timepieces, avoid extended moisture exposure and schedule routine service through the concierge.",
		excerpt: "Care guidance across leather, silk, cashmere, and timepieces.",
		status: "published",
		showInNavigation: false,
		position: 4,
		featuredImagePath: pageImagePath("care-guide"),
		metaTitle: "Care Guide",
		metaDescription:
			"How to care for 86d Atelier leather goods, silk, cashmere, and watches.",
	},
];

export const reviews: SeedReview[] = [
	{
		productKey: "regent-penny-loafer",
		customerKey: "eleanor-vale",
		authorName: "Eleanor V.",
		authorEmail: "eleanor@example.com",
		rating: 5,
		title: "Exactly the kind of loafer I wanted",
		body: "The shape feels polished without being rigid, and the leather softened beautifully after two wears. It works with tailoring and denim equally well.",
		status: "approved",
		isVerifiedPurchase: true,
		merchantResponse:
			"Thank you, Eleanor. The Regent was designed for exactly that kind of wardrobe flexibility.",
	},
	{
		productKey: "observatory-chronograph",
		authorName: "Marcus C.",
		authorEmail: "marcus@example.com",
		rating: 5,
		title: "Substantial but still refined",
		body: "The chronograph has enough presence to feel special, but the dial is still restrained. It reads much more expensive than it already is.",
		status: "approved",
		isVerifiedPurchase: true,
	},
	{
		productKey: "palais-top-handle",
		authorName: "Sofia A.",
		authorEmail: "sofia@example.com",
		rating: 5,
		title: "The structure is beautiful",
		body: "It stands upright on its own, fits far more than expected, and the interior layout is genuinely useful instead of decorative.",
		status: "approved",
		isVerifiedPurchase: true,
	},
	{
		productKey: "avenue-crescent-clutch",
		authorName: "Lena R.",
		authorEmail: "lena@example.com",
		rating: 4,
		title: "Elegant evening piece",
		body: "Beautiful shape and finish. I only wish it came with a slimmer optional chain, but the clutch itself is excellent.",
		status: "approved",
		isVerifiedPurchase: false,
	},
	{
		productKey: "grand-tour-passport-folio",
		authorName: "Noah S.",
		authorEmail: "noah@example.com",
		rating: 5,
		title: "A great travel companion",
		body: "It keeps my passport, boarding passes, and pen in one place without looking bulky. Feels extremely well made.",
		status: "approved",
		isVerifiedPurchase: true,
	},
	{
		productKey: "silk-twill-wrap",
		authorName: "Amelia D.",
		authorEmail: "amelia@example.com",
		rating: 5,
		title: "Soft drape and very polished",
		body: "The colors are muted in the best way and the silk has a beautiful hand. It instantly makes simple outfits feel considered.",
		status: "approved",
		isVerifiedPurchase: true,
	},
];

export const faqCategories = [
	{
		key: "orders-shipping",
		name: "Orders & Shipping",
		slug: "orders-shipping",
		description:
			"Shipping timelines, insured delivery, and concierge order support.",
		position: 0,
	},
	{
		key: "care-materials",
		name: "Care & Materials",
		slug: "care-materials",
		description: "Leather, silk, cashmere, and timepiece care guidance.",
		position: 1,
	},
	{
		key: "appointments-gifting",
		name: "Appointments & Gifting",
		slug: "appointments-gifting",
		description: "Private appointments, gifting, and showroom pickup.",
		position: 2,
	},
];

export const faqItems = [
	{
		categoryKey: "orders-shipping",
		question: "Do you offer complimentary shipping?",
		answer:
			"Yes. Orders over $750 receive complimentary insured ground shipping within the continental United States.",
		slug: "complimentary-shipping",
		position: 0,
	},
	{
		categoryKey: "orders-shipping",
		question: "Can I request premium delivery?",
		answer:
			"Select metro areas may see premium courier delivery windows at checkout, and concierge clients can request additional coordination when available.",
		slug: "premium-delivery",
		position: 1,
	},
	{
		categoryKey: "care-materials",
		question: "How should I care for the leather goods?",
		answer:
			"Store leather pieces upright in their dust bags, avoid prolonged direct sunlight, and condition lightly only when the surface begins to feel dry.",
		slug: "care-for-leather-goods",
		position: 0,
	},
	{
		categoryKey: "care-materials",
		question: "Do your watches require special servicing?",
		answer:
			"For automatic pieces, routine servicing every few years is recommended. The concierge can help coordinate care guidance and service timing.",
		slug: "watch-servicing",
		position: 1,
	},
	{
		categoryKey: "appointments-gifting",
		question: "Can I book a private appointment?",
		answer:
			"Yes. Use the concierge page or contact the team directly to request showroom appointments or guided gifting sessions.",
		slug: "private-appointment",
		position: 0,
	},
	{
		categoryKey: "appointments-gifting",
		question: "Do you provide gift guidance?",
		answer:
			"The concierge can recommend options based on budget, destination, and occasion, with an emphasis on easy-to-travel and quietly elegant pieces.",
		slug: "gift-guidance",
		position: 1,
	},
];

export const seoMeta = [
	{
		path: "/",
		title: "86d Atelier | Quiet Luxury Accessories and Timepieces",
		description:
			"Discover the 86d Atelier seed storefront: refined leather goods, sculpted footwear, and compact timepieces.",
		ogTitle: "86d Atelier",
		ogDescription:
			"Quiet luxury accessories, leather goods, and travel-ready timepieces.",
		ogType: "website",
	},
	{
		path: "/products",
		title: "Shop the Atelier | 86d Atelier",
		description:
			"Browse all 86d Atelier seed products across footwear, handbags, small leather goods, scarves, and timepieces.",
	},
	{
		path: "/collections",
		title: "Collections | 86d Atelier",
		description:
			"Explore House Icons, Leather Atelier, Timepiece Gallery, and other curated edits from the 86d Atelier seed catalog.",
	},
	{
		path: "/blog",
		title: "Journal | 86d Atelier",
		description:
			"Read the 86d Atelier journal for craft notes, travel styling, and gifting guidance.",
	},
];

export const searchSynonyms = [
	{ term: "loafer", synonyms: ["penny loafer", "slip-on", "driver"] },
	{ term: "timepiece", synonyms: ["watch", "chronograph", "gmt"] },
	{ term: "crossbody", synonyms: ["shoulder bag", "chain bag", "bag"] },
	{ term: "billfold", synonyms: ["wallet", "zip wallet", "card case"] },
	{ term: "wrap", synonyms: ["scarf", "silk", "shawl"] },
	{ term: "atelier", synonyms: ["house", "luxury", "quiet luxury"] },
];

export const newsletterSubscribers = [
	{
		email: "eleanor@example.com",
		firstName: "Eleanor",
		lastName: "Vale",
		status: "active",
		source: "appointment",
	},
	{
		email: "marcus@example.com",
		firstName: "Marcus",
		lastName: "Chen",
		status: "active",
		source: "footer",
	},
	{
		email: "sofia@example.com",
		firstName: "Sofia",
		lastName: "Alvarez",
		status: "active",
		source: "checkout",
	},
];

export const trustBadges = [
	{
		name: "Insured Delivery",
		description: "Complimentary insured ground shipping on $750+ orders",
		icon: "shield-check",
		position: "0",
		priority: 0,
		isActive: true,
	},
	{
		name: "Atelier Concierge",
		description: "Private appointments and guided gifting support",
		icon: "sparkles",
		position: "1",
		priority: 1,
		isActive: true,
	},
	{
		name: "Craft-First Materials",
		description:
			"Calfskin leather, silk twill, cashmere, and automatic movements",
		icon: "gem",
		position: "2",
		priority: 2,
		isActive: true,
	},
];

export const activityEvents = [
	{
		productKey: "palais-top-handle",
		eventType: "purchase",
		region: "NY",
		country: "United States",
		city: "New York",
		quantity: 1,
	},
	{
		productKey: "observatory-chronograph",
		eventType: "purchase",
		region: "IL",
		country: "United States",
		city: "Chicago",
		quantity: 1,
	},
	{
		productKey: "silk-twill-wrap",
		eventType: "purchase",
		region: "TX",
		country: "United States",
		city: "Dallas",
		quantity: 2,
	},
];

export const productLabels = [
	{
		key: "house-icon",
		name: "House Icon",
		slug: "house-icon",
		displayText: "House Icon",
		type: "badge",
		color: "#FDF9F6",
		backgroundColor: "#2F2520",
		priority: 0,
		isActive: true,
	},
	{
		key: "limited-run",
		name: "Limited Run",
		slug: "limited-run",
		displayText: "Limited Run",
		type: "badge",
		color: "#FFF7ED",
		backgroundColor: "#8A5D3B",
		priority: 1,
		isActive: true,
	},
	{
		key: "new-arrival",
		name: "New Arrival",
		slug: "new-arrival",
		displayText: "New Arrival",
		type: "badge",
		color: "#F6F4EF",
		backgroundColor: "#6F5A4B",
		priority: 2,
		isActive: true,
	},
];

export const labelAssignments = {
	"house-icon": [
		"regent-penny-loafer",
		"meridian-automatic-38",
		"palais-top-handle",
		"silk-twill-wrap",
	],
	"limited-run": ["observatory-chronograph", "avenue-crescent-clutch"],
	"new-arrival": [
		"grand-tour-passport-folio",
		"cashmere-cap",
		"cashmere-fringe-scarf",
	],
};

export const shippingZones = [
	{ key: "domestic", name: "United States", countries: ["US"], isActive: true },
	{
		key: "international",
		name: "International",
		countries: [],
		isActive: true,
	},
];

export const shippingRates = [
	{
		key: "domestic-ground",
		zoneKey: "domestic",
		name: "Insured Ground",
		price: 1800,
		minOrderAmount: 0,
		isActive: true,
	},
	{
		key: "domestic-complimentary",
		zoneKey: "domestic",
		name: "Complimentary Insured Ground",
		price: 0,
		minOrderAmount: 75000,
		isActive: true,
	},
	{
		key: "domestic-express",
		zoneKey: "domestic",
		name: "Priority Express",
		price: 4200,
		minOrderAmount: 0,
		isActive: true,
	},
	{
		key: "international-priority",
		zoneKey: "international",
		name: "International Priority",
		price: 9500,
		minOrderAmount: 0,
		isActive: true,
	},
];

export const taxRates = [
	{
		key: "new-york-sales-tax",
		name: "New York Sales Tax",
		country: "US",
		state: "NY",
		city: "*",
		postalCode: "*",
		rate: 0.08875,
		type: "percentage",
		enabled: true,
		priority: 0,
		compound: false,
		inclusive: false,
	},
	{
		key: "illinois-sales-tax",
		name: "Chicago Sales Tax",
		country: "US",
		state: "IL",
		city: "Chicago",
		postalCode: "*",
		rate: 0.1025,
		type: "percentage",
		enabled: true,
		priority: 0,
		compound: false,
		inclusive: false,
	},
	{
		key: "california-sales-tax",
		name: "California Sales Tax",
		country: "US",
		state: "CA",
		city: "*",
		postalCode: "*",
		rate: 0.0725,
		type: "percentage",
		enabled: true,
		priority: 0,
		compound: false,
		inclusive: false,
	},
];

export const taxCategory = {
	key: "default",
	name: "Luxury Goods (Default)",
	description: "Default tax category for the 86d Atelier seed assortment.",
};

export const discounts = [
	{
		key: "complimentary-shipping",
		name: "Complimentary Insured Shipping",
		description: "Complimentary insured ground shipping on qualifying orders.",
		type: "free_shipping",
		value: 0,
		minimumAmount: 75000,
		appliesTo: "all",
		stackable: true,
		isActive: true,
		code: "ATELIERSHIP",
	},
	{
		key: "private-appointment-credit",
		name: "Private Appointment Credit",
		description:
			"Reserved for concierge-assisted orders following a showroom appointment.",
		type: "fixed_amount",
		value: 2500,
		minimumAmount: 50000,
		appliesTo: "all",
		stackable: false,
		isActive: true,
		code: "SALON25",
	},
];

export const announcement = {
	title: "Complimentary insured shipping on orders over $750",
	content: "Book a private appointment or shop the House Icons edit.",
	type: "bar",
	position: "top",
	backgroundColor: "#2F2520",
	textColor: "#F8F4EF",
	linkUrl: "/collections/house-icons",
	linkText: "Explore House Icons",
	priority: 0,
	isActive: true,
	isDismissible: true,
	targetAudience: "all",
};

export const redirects = [
	{
		sourcePath: "/shop",
		targetPath: "/products",
		statusCode: 301,
		isActive: true,
		isRegex: false,
		preserveQueryString: true,
		note: "Luxury catalog shop shortcut",
		hitCount: 0,
	},
	{
		sourcePath: "/journal",
		targetPath: "/blog",
		statusCode: 301,
		isActive: true,
		isRegex: false,
		preserveQueryString: true,
		note: "Journal alias",
		hitCount: 0,
	},
	{
		sourcePath: "/appointments",
		targetPath: "/concierge",
		statusCode: 302,
		isActive: true,
		isRegex: false,
		preserveQueryString: false,
		note: "Appointment requests flow through concierge",
		hitCount: 0,
	},
];

export const sitemapConfig = {
	baseUrl: "https://atelier.86d.app",
	includeProducts: true,
	includeCollections: true,
	includePages: true,
	includeBlog: true,
	includeBrands: true,
	defaultChangeFreq: "weekly",
	defaultPriority: 0.5,
	productChangeFreq: "weekly",
	productPriority: 0.8,
	collectionChangeFreq: "weekly",
	collectionPriority: 0.7,
	pageChangeFreq: "monthly",
	pagePriority: 0.6,
	blogChangeFreq: "monthly",
	blogPriority: 0.6,
	excludedPaths: ["/admin", "/api", "/checkout"],
};

export const storeLocations = [
	{
		key: "new-york-flagship",
		name: "86d Atelier Flagship",
		slug: "new-york-flagship",
		description:
			"Private appointments, gifting guidance, and core house assortment in lower Manhattan.",
		address: "18 Mercer Street",
		city: "New York",
		state: "NY",
		postalCode: "10013",
		country: "US",
		latitude: 40.7241,
		longitude: -74.0018,
		phone: "+1-212-555-0108",
		email: "nyc@atelier.86d.app",
		hours: {
			monday: { open: "10:00", close: "19:00" },
			tuesday: { open: "10:00", close: "19:00" },
			wednesday: { open: "10:00", close: "19:00" },
			thursday: { open: "10:00", close: "19:00" },
			friday: { open: "10:00", close: "20:00" },
			saturday: { open: "11:00", close: "19:00" },
			sunday: { open: "12:00", close: "17:00" },
		},
		amenities: ["wifi", "private-appointments", "gift-wrapping"],
		isActive: true,
		isFeatured: true,
		pickupEnabled: true,
	},
	{
		key: "chicago-salon",
		name: "86d Atelier Oak Street Salon",
		slug: "chicago-salon",
		description:
			"An appointment-led salon for gifting, travel edits, and quiet luxury essentials.",
		address: "55 E Oak Street",
		city: "Chicago",
		state: "IL",
		postalCode: "60611",
		country: "US",
		latitude: 41.9016,
		longitude: -87.6253,
		phone: "+1-312-555-0108",
		email: "chicago@atelier.86d.app",
		hours: {
			monday: { open: "11:00", close: "18:00" },
			tuesday: { open: "11:00", close: "18:00" },
			wednesday: { open: "11:00", close: "18:00" },
			thursday: { open: "11:00", close: "18:00" },
			friday: { open: "11:00", close: "19:00" },
			saturday: { open: "11:00", close: "19:00" },
			sunday: { open: "12:00", close: "17:00" },
		},
		amenities: ["private-appointments", "gift-wrapping"],
		isActive: true,
		isFeatured: false,
		pickupEnabled: true,
	},
];

export const pickupLocation = {
	name: "86d Atelier Flagship",
	address: "18 Mercer Street",
	city: "New York",
	state: "NY",
	postalCode: "10013",
	country: "US",
	phone: "+1-212-555-0108",
	email: "pickup@atelier.86d.app",
	latitude: 40.7241,
	longitude: -74.0018,
	preparationMinutes: 120,
	active: true,
	sortOrder: 0,
};

export const pickupWindows = [
	{
		dayOfWeek: 2,
		startTime: "11:00",
		endTime: "18:00",
		capacity: 10,
		active: true,
		sortOrder: 0,
	},
	{
		dayOfWeek: 3,
		startTime: "11:00",
		endTime: "18:00",
		capacity: 10,
		active: true,
		sortOrder: 1,
	},
	{
		dayOfWeek: 4,
		startTime: "11:00",
		endTime: "18:00",
		capacity: 10,
		active: true,
		sortOrder: 2,
	},
	{
		dayOfWeek: 5,
		startTime: "11:00",
		endTime: "19:00",
		capacity: 12,
		active: true,
		sortOrder: 3,
	},
	{
		dayOfWeek: 6,
		startTime: "11:00",
		endTime: "19:00",
		capacity: 12,
		active: true,
		sortOrder: 4,
	},
];

export const deliverySchedules = [
	{
		name: "Afternoon Concierge Delivery",
		dayOfWeek: 2,
		startTime: "13:00",
		endTime: "17:00",
		capacity: 6,
		surchargeInCents: 2500,
		active: true,
		sortOrder: 0,
	},
	{
		name: "Evening Concierge Delivery",
		dayOfWeek: 4,
		startTime: "17:00",
		endTime: "21:00",
		capacity: 4,
		surchargeInCents: 4500,
		active: true,
		sortOrder: 1,
	},
	{
		name: "Saturday Atelier Delivery",
		dayOfWeek: 6,
		startTime: "11:00",
		endTime: "16:00",
		capacity: 5,
		surchargeInCents: 3500,
		active: true,
		sortOrder: 2,
	},
];

export const demoOrder = {
	orderNumber: "AT-1001",
	customerKey: "marcus-chen",
	currency: "USD",
	status: "completed",
	paymentStatus: "paid",
	items: [
		{
			productKey: "grand-tour-passport-folio",
			variantKey: "grand-tour-passport-folio:cog",
			quantity: 1,
		},
		{
			productKey: "silk-twill-wrap",
			variantKey: "silk-twill-wrap:cmr",
			quantity: 1,
		},
	],
	shippingAmount: 0,
	taxAmount: 8303,
	discountAmount: 0,
	shippingAddress: {
		firstName: "Marcus",
		lastName: "Chen",
		line1: "920 W Fulton Market",
		city: "Chicago",
		state: "IL",
		postalCode: "60607",
		country: "US",
	},
};

export const summary = {
	house: houseBrand.name,
	productCount: products.length,
	categoryCount: categories.length,
	collectionCount: collections.length,
	blogCount: blogPosts.length,
};

export const productByKey = Object.fromEntries(
	products.map((product) => [product.key, product]),
) as Record<string, SeedProduct>;
