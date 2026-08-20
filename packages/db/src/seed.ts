#!/usr/bin/env tsx

/**
 * Database Seed Script
 *
 * Seeds a deterministic luxury-house demo catalog for development and E2E work.
 *
 * Usage:
 *   bun run db:seed
 *   DATABASE_URL=... bun run db:seed
 *
 * What it creates:
 *   - Admin user (APP_ADMIN_EMAIL / APP_ADMIN_PASSWORD env vars, or admin@example.com / password123)
 *   - 16 luxury products with variants across 6 categories
 *   - 6 mirrored collections in both products + collections modules
 *   - 1 house brand, 3 customers, 1 demo order, and supporting module data
 *   - Uploaded local seed assets stored under stores/{STORE_ID}/seed/luxury-house/...
 *
 * Stock images are produced with: bun run seed:fetch-luxury-assets (see packages/db/seed/luxury-stock-sources.json).
 */

import { createHash, randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createStorageFromEnv } from "@86d-app/storage/factory";
import type { StorageProvider } from "@86d-app/storage/types";
import pg from "pg";
import { workspaceRootFromImportMeta } from "../../../internals/lib/workspace-root.ts";
import {
	activityEvents,
	announcement,
	blogPosts,
	categories,
	collections,
	customerAddresses,
	customers,
	deliverySchedules,
	demoOrder,
	discounts,
	faqCategories,
	faqItems,
	houseBrand,
	labelAssignments,
	navigationItems,
	newsletterSubscribers,
	pages,
	pickupLocation,
	pickupWindows,
	productByKey,
	productLabels,
	products,
	redirects,
	reviews,
	type SeedProduct,
	type SeedVariant,
	searchSynonyms,
	seoMeta,
	shippingRates,
	shippingZones,
	sitemapConfig,
	storeLocations,
	storeSettings,
	summary,
	taxCategory,
	taxRates,
	trustBadges,
} from "../seed/catalog/luxury-house.ts";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error("DATABASE_URL environment variable is required");
	process.exit(1);
}

const STORE_ID = process.env.STORE_ID || "de005b9d-c517-4c65-896e-8edef5cf5a94";
const ADMIN_EMAIL = process.env.APP_ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.APP_ADMIN_PASSWORD || "password123";
const DB_ROOT = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = workspaceRootFromImportMeta(import.meta.url);
const now = new Date().toISOString();
const ASSET_ROOT = resolve(DB_ROOT, "../seed/assets/luxury-house");
const ASSET_KEY_PREFIX = `stores/${STORE_ID}/seed/luxury-house`;
const rootPackage = JSON.parse(
	readFileSync(join(WORKSPACE_ROOT, "package.json"), "utf8"),
) as { version?: string };
const fallbackModuleVersion = rootPackage.version ?? "0.0.4";

const pool = new pg.Pool({ connectionString: DATABASE_URL });

function uuid(key: string): string {
	const hash = createHash("sha256").update(`86d-seed-v2:${key}`).digest("hex");
	return [
		hash.slice(0, 8),
		hash.slice(8, 12),
		`4${hash.slice(13, 16)}`,
		`${(0x8 | (Number.parseInt(hash[16], 16) & 0x3)).toString(16)}${hash.slice(17, 20)}`,
		hash.slice(20, 32),
	].join("-");
}

function hashPassword(password: string): string {
	const salt = randomBytes(16).toString("hex");
	const key = scryptSync(password.normalize("NFKC"), salt, 64, {
		N: 16384,
		r: 16,
		p: 1,
		maxmem: 64 * 1024 * 1024,
	});
	return `${salt}:${key.toString("hex")}`;
}

function cuid(): string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
	let result = "c";
	for (let i = 0; i < 24; i++) {
		result += chars[Math.floor(Math.random() * chars.length)];
	}
	return result;
}

function idsByKey<T extends { key: string }>(
	prefix: string,
	items: T[],
): Record<string, string> {
	return Object.fromEntries(
		items.map((item) => [item.key, uuid(`${prefix}:${item.key}`)]),
	);
}

function mimeTypeForPath(relativePath: string): string {
	switch (extname(relativePath).toLowerCase()) {
		case ".webp":
			return "image/webp";
		case ".png":
			return "image/png";
		case ".jpg":
		case ".jpeg":
			return "image/jpeg";
		default:
			throw new Error(`Unsupported seed asset type: ${relativePath}`);
	}
}

function moduleVersion(moduleName: string): string {
	const packagePath = resolve(
		process.cwd(),
		"modules",
		moduleName,
		"package.json",
	);
	if (!existsSync(packagePath)) return fallbackModuleVersion;
	const pkg = JSON.parse(readFileSync(packagePath, "utf8")) as {
		version?: string;
	};
	return pkg.version ?? fallbackModuleVersion;
}

type AssetResolver = {
	resolveUrl(relativePath: string): Promise<string>;
};

function shouldProxyUploadUrls(): boolean {
	return (process.env.STORAGE_PUBLIC_URL_MODE ?? "direct") === "proxy";
}

function buildPublicUploadUrl(key: string): string {
	return `/uploads/${key}`;
}

function createAssetResolver(storage: StorageProvider): AssetResolver {
	const cache = new Map<string, string>();

	return {
		async resolveUrl(relativePath: string): Promise<string> {
			const existing = cache.get(relativePath);
			if (existing) return existing;

			const absolutePath = resolve(ASSET_ROOT, relativePath);
			const key = `${ASSET_KEY_PREFIX}/${relativePath}`;
			const content = readFileSync(absolutePath);
			const result = await storage.upload({
				key,
				content,
				contentType: mimeTypeForPath(relativePath),
			});
			const publicUrl = shouldProxyUploadUrls()
				? buildPublicUploadUrl(key)
				: result.url;
			cache.set(relativePath, publicUrl);
			return publicUrl;
		},
	};
}

type ResolvedProduct = SeedProduct & {
	id: string;
	categoryId: string;
	inventory: number;
	images: string[];
	variantRecords: Array<
		SeedVariant & {
			id: string;
			productId: string;
		}
	>;
};

const adminUserId = uuid("admin-user");
const adminAccountId = uuid("admin-account");
const moduleIds: Record<string, string> = {};
const moduleNames = [
	"products",
	"collections",
	"cart",
	"orders",
	"customers",
	"settings",
	"inventory",
	"shipping",
	"discounts",
	"reviews",
	"newsletter",
	"analytics",
	"subscriptions",
	"digital-downloads",
	"payments",
	"seo",
	"blog",
	"search",
	"navigation",
	"pages",
	"media",
	"notifications",
	"checkout",
	"tax",
	"fulfillment",
	"brands",
	"announcements",
	"wishlist",
	"recently-viewed",
	"comparisons",
	"recommendations",
	"faq",
	"forms",
	"tickets",
	"loyalty",
	"gift-cards",
	"store-credits",
	"affiliates",
	"referrals",
	"social-proof",
	"product-labels",
	"product-qa",
	"product-feeds",
	"memberships",
	"multi-currency",
	"price-lists",
	"bulk-pricing",
	"bundles",
	"flash-sales",
	"waitlist",
	"backorders",
	"preorders",
	"appointments",
	"auctions",
	"automations",
	"customer-groups",
	"quotes",
	"store-locator",
	"returns",
	"revenue",
	"audit-log",
	"vendors",
	"gift-registry",
	"gift-wrapping",
	"delivery-slots",
	"invoices",
	"store-pickup",
	"import-export",
	"warranties",
	"abandoned-carts",
	"braintree",
	"paypal",
	"square",
	"stripe",
	"redirects",
	"sitemap",
	"amazon",
	"doordash",
	"ebay",
	"etsy",
	"facebook-shop",
	"favor",
	"gamification",
	"google-shopping",
	"instagram-shop",
	"kiosk",
	"order-notes",
	"photo-booth",
	"pinterest-shop",
	"qr-code",
	"saved-addresses",
	"social-sharing",
	"tiktok-shop",
	"tipping",
	"toast",
	"uber-direct",
	"uber-eats",
	"walmart",
	"wish",
	"x-shop",
];
const seededModuleNames = [
	"products",
	"collections",
	"brands",
	"customers",
	"settings",
	"inventory",
	"navigation",
	"orders",
	"reviews",
	"blog",
	"pages",
	"shipping",
	"tax",
	"discounts",
	"faq",
	"announcements",
	"seo",
	"search",
	"newsletter",
	"social-proof",
	"product-labels",
	"redirects",
	"sitemap",
	"store-locator",
	"store-pickup",
	"delivery-slots",
	"wishlist",
	"loyalty",
	"flash-sales",
	"bundles",
	"subscriptions",
	"gift-cards",
	"appointments",
	"memberships",
	"warranties",
	"auctions",
	"store-credits",
	"preorders",
	"referrals",
	"affiliates",
	"customer-groups",
	"abandoned-carts",
	"digital-downloads",
	"quotes",
	"returns",
	"backorders",
	"gift-registry",
	"bulk-pricing",
	"gift-wrapping",
	"invoices",
	"gamification",
	"multi-currency",
	"waitlist",
	// batch 6 — core modules
	"cart",
	"checkout",
	"notifications",
	"recently-viewed",
	"recommendations",
	"forms",
	"tipping",
	"order-notes",
	"fulfillment",
	"audit-log",
	"vendors",
	"tickets",
	"product-qa",
	"comparisons",
	"price-lists",
	"product-feeds",
	"import-export",
	"saved-addresses",
	"media",
	"automations",
	"payments",
	"analytics",
	"social-sharing",
	"qr-code",
	"kiosk",
	"photo-booth",
	"revenue",
	// batch 7 — channel/marketplace modules
	"amazon",
	"ebay",
	"etsy",
	"tiktok-shop",
	"google-shopping",
	"facebook-shop",
	"instagram-shop",
	"walmart",
	"x-shop",
	"pinterest-shop",
	"doordash",
	"uber-direct",
	"uber-eats",
	"favor",
	"toast",
	"wish",
	"stripe",
	"paypal",
	"square",
	"braintree",
];

for (const name of moduleNames) {
	moduleIds[name] = uuid(`module:${STORE_ID}:${name}`);
}

const categoryIds = idsByKey("category", categories);
const productIds = idsByKey("product", products);
const customerIds = idsByKey("customer", customers);
const collectionIds = idsByKey("collection", collections);
const faqCategoryIds = idsByKey("faq-category", faqCategories);
const blogPostIds = idsByKey("blog-post", blogPosts);
const pageIds = idsByKey("page", pages);
const labelIds = idsByKey("label", productLabels);
const shippingZoneIds = idsByKey("shipping-zone", shippingZones);
const locationIds = idsByKey("store-location", storeLocations);
const variantIdByKey: Record<string, string> = {};
const variantByKey: Record<string, SeedVariant> = {};

for (const product of products) {
	for (const variant of product.variants) {
		variantIdByKey[variant.key] = uuid(`variant:${variant.key}`);
		variantByKey[variant.key] = variant;
	}
}

async function ensureStoreRecord(client: pg.PoolClient) {
	const { rows } = await client.query(
		`SELECT EXISTS (
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name = 'Store'
		) AS "exists"`,
	);
	if (!rows[0]?.exists) return;

	const storeExists = await client.query(
		`SELECT 1 FROM "Store" WHERE id = $1`,
		[STORE_ID],
	);
	if (storeExists.rows.length > 0) return;

	const businessId = uuid("seed-business");
	await client.query(
		`INSERT INTO "Business" (id, cuid, name, "createdAt", "updatedAt")
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (id) DO NOTHING`,
		[businessId, cuid(), "86d Atelier Holdings", now, now],
	);

	await client.query(
		`INSERT INTO "Store" (id, cuid, name, "businessId", "createdAt", "updatedAt")
		 VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT (id) DO NOTHING`,
		[STORE_ID, cuid(), "86d Atelier", businessId, now, now],
	);
}

async function insertModuleData(
	client: pg.PoolClient,
	moduleName: string,
	entityType: string,
	entityId: string,
	data: Record<string, unknown>,
) {
	if (!moduleIds[moduleName]) return;
	const record: Record<string, unknown> = {
		...data,
		id: entityId,
	};
	if (record.createdAt === undefined) {
		record.createdAt = now;
	}
	if (record.updatedAt === undefined) {
		record.updatedAt = now;
	}

	const columns = Object.keys(record);
	const values = columns.map((key) => {
		const value = record[key];
		if (
			value !== null &&
			typeof value === "object" &&
			!(value instanceof Date)
		) {
			return JSON.stringify(value);
		}
		return value;
	});
	const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
	const columnList = columns.map((c) => `"${c}"`).join(", ");
	const updates = columns
		.filter((c) => c !== "id")
		.map((c) => `"${c}" = EXCLUDED."${c}"`)
		.join(", ");

	await client.query(
		`INSERT INTO "mod_${moduleName}"."${entityType}" (${columnList})
		 VALUES (${placeholders})
		 ON CONFLICT ("id") DO UPDATE SET ${updates}`,
		values,
	);
}

async function seedAdminUser(client: pg.PoolClient) {
	const hashedPassword = hashPassword(ADMIN_PASSWORD);

	const userResult = await client.query<{ id: string }>(
		`INSERT INTO "User" (id, cuid, name, email, "emailVerified", role, "createdAt", "updatedAt")
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 ON CONFLICT (email) DO UPDATE SET role = $6, name = $3
		 RETURNING id`,
		[adminUserId, cuid(), "Admin User", ADMIN_EMAIL, true, "admin", now, now],
	);
	const userId = userResult.rows[0]?.id;
	if (!userId) {
		throw new Error("Failed to resolve admin user ID during seed");
	}

	const existingAccount = await client.query<{ id: string }>(
		`SELECT id FROM "Account" WHERE "userId" = $1 AND "providerId" = $2 LIMIT 1`,
		[userId, "credential"],
	);

	if (existingAccount.rows[0]?.id) {
		await client.query(
			`UPDATE "Account"
			 SET "accountId" = $2, password = $3, "updatedAt" = $4
			 WHERE id = $1`,
			[existingAccount.rows[0].id, userId, hashedPassword, now],
		);
		return;
	}

	await client.query(
		`INSERT INTO "Account" (id, cuid, "accountId", "providerId", password, "userId", "createdAt", "updatedAt")
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		[
			adminAccountId,
			cuid(),
			userId,
			"credential",
			hashedPassword,
			userId,
			now,
			now,
		],
	);
}

async function seedModules(client: pg.PoolClient) {
	await ensureStoreRecord(client);
	for (const name of moduleNames) {
		const result = await client.query<{ id: string }>(
			`INSERT INTO "Module" (id, cuid, name, version, "isEnabled", "storeId", "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			 ON CONFLICT ("storeId", name) DO UPDATE
			 SET version = $4, "isEnabled" = true, "updatedAt" = $8
			 RETURNING id`,
			[
				moduleIds[name],
				cuid(),
				name,
				moduleVersion(name),
				true,
				STORE_ID,
				now,
				now,
			],
		);
		if (result.rows[0]?.id) {
			moduleIds[name] = result.rows[0].id;
		}
	}
}

async function resetManagedModuleData(client: pg.PoolClient) {
	for (const name of seededModuleNames) {
		if (!moduleIds[name]) continue;
		await client.query(
			`DO $$ BEGIN
			  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'mod_${name}') THEN
			    EXECUTE 'DROP SCHEMA IF EXISTS "mod_${name}" CASCADE';
			  END IF;
			END $$;`,
		);
	}
}

async function applySeedModuleSchema(client: pg.PoolClient) {
	const { compileModuleDeclarations, emitSql } = await import(
		"@86d-app/core/schema"
	);
	const { applyModuleDdl } = await import("./schema/apply-disposable-ddl");
	const { CURATED_STORE_MODULES } = await import(
		"@86d-app/core/curated-modules"
	);
	type SeedModule = import("@86d-app/core/types/module").Module;
	const modulesDir = join(WORKSPACE_ROOT, "modules");
	const loaded: SeedModule[] = [];

	for (const moduleId of [
		...CURATED_STORE_MODULES,
		...seededModuleNames.filter(
			(name) => !(CURATED_STORE_MODULES as readonly string[]).includes(name),
		),
	]) {
		try {
			const mod = await import(join(modulesDir, moduleId, "src/index.ts"));
			if (typeof mod.default === "function") {
				loaded.push(mod.default({}));
			}
		} catch {
			// Module absent or unloadable — skip.
		}
	}
	const report = compileModuleDeclarations(loaded);
	const sql = emitSql(report.transcoded);
	await applyModuleDdl(
		{
			exec: async (statement) => {
				await client.query(statement);
			},
		},
		sql,
	);
}

async function resolveProducts(
	assets: AssetResolver,
): Promise<ResolvedProduct[]> {
	const resolvedProducts: ResolvedProduct[] = [];
	for (const product of products) {
		const images: string[] = [];
		for (const relativePath of product.imagePaths) {
			images.push(await assets.resolveUrl(relativePath));
		}
		const variantRecords = product.variants.map((variant) => ({
			...variant,
			id: variantIdByKey[variant.key],
			productId: productIds[product.key],
		}));
		resolvedProducts.push({
			...product,
			id: productIds[product.key],
			categoryId: categoryIds[product.categoryKey],
			inventory: variantRecords.reduce(
				(sum, variant) => sum + variant.inventory,
				0,
			),
			images,
			variantRecords,
		});
	}
	return resolvedProducts;
}

async function seedProducts(client: pg.PoolClient, assets: AssetResolver) {
	for (const category of categories) {
		const image = await assets.resolveUrl(category.imagePath);
		await insertModuleData(
			client,
			"products",
			"category",
			categoryIds[category.key],
			{
				id: categoryIds[category.key],
				name: category.name,
				slug: category.slug,
				description: category.description,
				image,
				position: category.position,
				isVisible: category.isVisible,
				metadata: category.metadata ?? {},
				createdAt: now,
				updatedAt: now,
			},
		);
	}
	const resolvedProducts = await resolveProducts(assets);
	for (const product of resolvedProducts) {
		await insertModuleData(client, "products", "product", product.id, {
			id: product.id,
			name: product.name,
			slug: product.slug,
			description: product.description,
			shortDescription: product.shortDescription,
			price: product.price,
			...(product.compareAtPrice != null && {
				compareAtPrice: product.compareAtPrice,
			}),
			...(product.costPrice != null && { costPrice: product.costPrice }),
			sku: product.sku,
			inventory: product.inventory,
			trackInventory: product.trackInventory,
			allowBackorder: product.allowBackorder,
			status: product.status,
			categoryId: product.categoryId,
			images: product.images,
			tags: product.tags,
			metadata: product.metadata,
			weight: product.weight,
			weightUnit: product.weightUnit,
			isFeatured: product.isFeatured,
			createdAt: now,
			updatedAt: now,
		});

		for (const variant of product.variantRecords) {
			await insertModuleData(client, "products", "productVariant", variant.id, {
				id: variant.id,
				productId: variant.productId,
				name: variant.name,
				sku: variant.sku,
				price: variant.price,
				...(variant.compareAtPrice != null && {
					compareAtPrice: variant.compareAtPrice,
				}),
				...(variant.costPrice != null && { costPrice: variant.costPrice }),
				inventory: variant.inventory,
				options: variant.options,
				images: product.images,
				weight: variant.weight,
				weightUnit: variant.weightUnit ?? "kg",
				position: product.variantRecords.findIndex(
					(item) => item.id === variant.id,
				),
				createdAt: now,
				updatedAt: now,
			});
		}
	}
}

function inventoryItemId(
	productId: string,
	variantId?: string,
	locationId?: string,
): string {
	return [productId, variantId ?? "_", locationId ?? "_"].join(":");
}

async function seedCollections(client: pg.PoolClient, assets: AssetResolver) {
	for (const collection of collections) {
		const image = await assets.resolveUrl(collection.imagePath);
		await insertModuleData(
			client,
			"products",
			"collection",
			collectionIds[collection.key],
			{
				id: collectionIds[collection.key],
				name: collection.name,
				slug: collection.slug,
				description: collection.description,
				image,
				isFeatured: collection.isFeatured,
				isVisible: collection.isVisible,
				position: collection.position,
				metadata: collection.metadata ?? {},
				createdAt: now,
				updatedAt: now,
			},
		);
		for (const [position, productKey] of collection.productKeys.entries()) {
			const linkId = uuid(
				`products-collection-link:${collection.key}:${productKey}`,
			);
			await insertModuleData(client, "products", "collectionProduct", linkId, {
				id: linkId,
				collectionId: collectionIds[collection.key],
				productId: productIds[productKey],
				position,
				createdAt: now,
			});
		}
	}
}

async function seedCollectionsModule(
	client: pg.PoolClient,
	assets: AssetResolver,
) {
	for (const collection of collections) {
		const image = await assets.resolveUrl(collection.imagePath);
		await insertModuleData(
			client,
			"collections",
			"collection",
			collectionIds[collection.key],
			{
				id: collectionIds[collection.key],
				title: collection.name,
				slug: collection.slug,
				description: collection.description,
				image,
				type: "manual",
				sortOrder: "manual",
				isActive: true,
				isFeatured: collection.isFeatured,
				position: collection.position,
				conditions: { match: "all", rules: [] },
				...(collection.seoTitle != null && { seoTitle: collection.seoTitle }),
				...(collection.seoDescription != null && {
					seoDescription: collection.seoDescription,
				}),
				publishedAt: now,
				createdAt: now,
				updatedAt: now,
			},
		);

		for (const [position, productKey] of collection.productKeys.entries()) {
			const linkId = uuid(
				`collections-module-link:${collection.key}:${productKey}`,
			);
			await insertModuleData(
				client,
				"collections",
				"collectionProduct",
				linkId,
				{
					id: linkId,
					collectionId: collectionIds[collection.key],
					productId: productIds[productKey],
					position,
					addedAt: now,
				},
			);
		}
	}
}

async function seedBrands(client: pg.PoolClient, assets: AssetResolver) {
	const brandId = uuid(`brand:${houseBrand.key}`);
	await insertModuleData(client, "brands", "brand", brandId, {
		id: brandId,
		name: houseBrand.name,
		slug: houseBrand.slug,
		description: houseBrand.description,
		logo: await assets.resolveUrl(houseBrand.logoPath),
		bannerImage: await assets.resolveUrl(houseBrand.bannerImagePath),
		website: houseBrand.website,
		isActive: houseBrand.isActive,
		isFeatured: houseBrand.isFeatured,
		position: houseBrand.position,
		seoTitle: houseBrand.seoTitle,
		seoDescription: houseBrand.seoDescription,
		createdAt: now,
		updatedAt: now,
	});

	for (const product of products) {
		const linkId = uuid(`brand-product:${houseBrand.key}:${product.key}`);
		await insertModuleData(client, "brands", "brandProduct", linkId, {
			id: linkId,
			brandId,
			productId: productIds[product.key],
			assignedAt: now,
		});
	}
}

async function seedCustomers(client: pg.PoolClient) {
	for (const customer of customers) {
		await insertModuleData(
			client,
			"customers",
			"customer",
			customerIds[customer.key],
			{
				id: customerIds[customer.key],
				email: customer.email,
				firstName: customer.firstName,
				lastName: customer.lastName,
				phone: customer.phone,
				metadata: customer.preferences ?? {},
				createdAt: now,
				updatedAt: now,
			},
		);
	}

	for (const [index, address] of customerAddresses.entries()) {
		const addressId = uuid(`customer-address:${address.customerKey}:${index}`);
		await insertModuleData(client, "customers", "customerAddress", addressId, {
			id: addressId,
			customerId: customerIds[address.customerKey],
			type: address.type,
			firstName: address.firstName,
			lastName: address.lastName,
			line1: address.line1,
			...(address.line2 != null && { line2: address.line2 }),
			city: address.city,
			state: address.state,
			postalCode: address.postalCode,
			country: address.country,
			isDefault: address.isDefault,
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedSettings(client: pg.PoolClient) {
	for (const setting of storeSettings) {
		const settingId = uuid(`setting:${setting.key}`);
		await insertModuleData(client, "settings", "storeSetting", settingId, {
			id: settingId,
			key: setting.key,
			value: setting.value,
			group: setting.group,
			updatedAt: now,
		});
	}
}

async function seedInventory(client: pg.PoolClient) {
	for (const product of products) {
		const productId = productIds[product.key];
		const quantity = product.variants.reduce(
			(sum, variant) => sum + variant.inventory,
			0,
		);
		const inventoryId = inventoryItemId(productId);
		await insertModuleData(client, "inventory", "inventoryItem", inventoryId, {
			id: inventoryId,
			productId,
			quantity,
			reserved: 0,
			allowBackorder: product.allowBackorder,
			lowStockThreshold: 4,
			createdAt: now,
			updatedAt: now,
		});

		for (const variant of product.variants) {
			const variantId = variantIdByKey[variant.key];
			const variantInventoryId = inventoryItemId(productId, variantId);
			await insertModuleData(
				client,
				"inventory",
				"inventoryItem",
				variantInventoryId,
				{
					id: variantInventoryId,
					productId,
					variantId,
					quantity: variant.inventory,
					reserved: 0,
					allowBackorder: product.allowBackorder,
					lowStockThreshold: 2,
					createdAt: now,
					updatedAt: now,
				},
			);
		}
	}
}

async function seedNavigation(client: pg.PoolClient) {
	const menuId = uuid("menu:main");
	await insertModuleData(client, "navigation", "menu", menuId, {
		id: menuId,
		name: "Main Navigation",
		slug: "main",
		location: "header",
		isActive: true,
		metadata: { theme: summary.house },
		createdAt: now,
		updatedAt: now,
	});

	for (const item of navigationItems) {
		const itemId = uuid(`menu-item:${menuId}:${item.label}`);
		await insertModuleData(client, "navigation", "menuItem", itemId, {
			id: itemId,
			menuId,
			label: item.label,
			type: "link",
			url: item.url,
			position: item.position,
			isVisible: true,
			openInNewTab: false,
			metadata: {},
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedDemoOrder(client: pg.PoolClient) {
	const orderId = uuid("order:demo");
	const orderItems = demoOrder.items.map((item) => {
		const product = productByKey[item.productKey];
		const variant = variantByKey[item.variantKey];
		return {
			id: uuid(`order-item:${item.variantKey}`),
			orderId,
			productId: productIds[item.productKey],
			variantId: variantIdByKey[item.variantKey],
			name: product.name,
			sku: variant?.sku ?? product.sku,
			price: variant?.price ?? product.price,
			quantity: item.quantity,
			subtotal: (variant?.price ?? product.price) * item.quantity,
			metadata: { options: variant?.options ?? {} },
		};
	});
	const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
	const total =
		subtotal +
		demoOrder.taxAmount +
		demoOrder.shippingAmount -
		demoOrder.discountAmount;

	await insertModuleData(client, "orders", "order", orderId, {
		id: orderId,
		orderNumber: demoOrder.orderNumber,
		customerId: customerIds[demoOrder.customerKey],
		subtotal,
		taxAmount: demoOrder.taxAmount,
		shippingAmount: demoOrder.shippingAmount,
		discountAmount: demoOrder.discountAmount,
		giftCardAmount: 0,
		total,
		currency: demoOrder.currency,
		status: demoOrder.status,
		paymentStatus: demoOrder.paymentStatus,
		metadata: { theme: summary.house },
		createdAt: now,
		updatedAt: now,
	});

	for (const item of orderItems) {
		await insertModuleData(client, "orders", "orderItem", item.id, item);
	}

	const addressId = uuid("order-address:demo");
	await insertModuleData(client, "orders", "orderAddress", addressId, {
		id: addressId,
		orderId,
		type: "shipping",
		...demoOrder.shippingAddress,
	});

	const partyId = uuid("core-party:demo-customer");
	const subjectId = uuid("core-subject:demo-order");
	const transactionId = uuid("core-transaction:demo-order");
	const expectedMinor = Math.round(total * 100);
	await client.query(
		`INSERT INTO core.party (id, kind, "displayName", email)
		 VALUES ($1, 'person', $2, $3)
		 ON CONFLICT (id) DO UPDATE SET "displayName" = EXCLUDED."displayName", email = EXCLUDED.email`,
		[
			partyId,
			customers.find((c) => c.key === demoOrder.customerKey)?.name ??
				"Customer",
			customers.find((c) => c.key === demoOrder.customerKey)?.email ?? null,
		],
	);
	await client.query(
		`INSERT INTO core.subject (id, kind, owner_module, party_id, currency, expected_minor, settle_state)
		 VALUES ($1, 'order', 'orders', $2, $3, $4, 'settled')
		 ON CONFLICT (id) DO UPDATE SET expected_minor = EXCLUDED.expected_minor, settle_state = EXCLUDED.settle_state`,
		[subjectId, partyId, demoOrder.currency, expectedMinor],
	);
	await client.query(
		`INSERT INTO core.transaction (id, subject_id, authorized_minor, captured_minor, refunded_minor)
		 VALUES ($1, $2, $3, $3, 0)
		 ON CONFLICT (id) DO UPDATE SET authorized_minor = EXCLUDED.authorized_minor, captured_minor = EXCLUDED.captured_minor`,
		[transactionId, subjectId, expectedMinor],
	);
}

async function seedReviews(client: pg.PoolClient) {
	for (const review of reviews) {
		const reviewId = uuid(`review:${review.productKey}:${review.authorEmail}`);
		await insertModuleData(client, "reviews", "review", reviewId, {
			id: reviewId,
			productId: productIds[review.productKey],
			...(review.customerKey != null && {
				customerId: customerIds[review.customerKey],
			}),
			authorName: review.authorName,
			authorEmail: review.authorEmail,
			rating: review.rating,
			title: review.title,
			body: review.body,
			status: review.status,
			isVerifiedPurchase: review.isVerifiedPurchase,
			helpfulCount: 0,
			images: [],
			...(review.merchantResponse != null && {
				merchantResponse: review.merchantResponse,
				merchantResponseAt: now,
			}),
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedBlog(client: pg.PoolClient, assets: AssetResolver) {
	for (const post of blogPosts) {
		await insertModuleData(client, "blog", "post", blogPostIds[post.key], {
			id: blogPostIds[post.key],
			title: post.title,
			slug: post.slug,
			content: post.content,
			excerpt: post.excerpt,
			coverImage: await assets.resolveUrl(post.coverImagePath),
			author: post.author,
			category: post.category,
			status: post.status,
			featured: post.featured,
			readingTime: post.readingTime,
			tags: post.tags,
			metaTitle: post.metaTitle,
			metaDescription: post.metaDescription,
			views: 0,
			publishedAt: now,
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedPages(client: pg.PoolClient, assets: AssetResolver) {
	for (const page of pages) {
		await insertModuleData(client, "pages", "page", pageIds[page.key], {
			id: pageIds[page.key],
			title: page.title,
			slug: page.slug,
			content: page.content,
			excerpt: page.excerpt,
			status: page.status,
			metaTitle: page.metaTitle,
			metaDescription: page.metaDescription,
			featuredImage: await assets.resolveUrl(page.featuredImagePath),
			position: page.position,
			showInNavigation: page.showInNavigation,
			publishedAt: now,
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedShipping(client: pg.PoolClient) {
	for (const zone of shippingZones) {
		await insertModuleData(
			client,
			"shipping",
			"shippingZone",
			shippingZoneIds[zone.key],
			{
				id: shippingZoneIds[zone.key],
				name: zone.name,
				countries: zone.countries,
				isActive: zone.isActive,
				createdAt: now,
				updatedAt: now,
			},
		);
	}

	for (const rate of shippingRates) {
		const rateId = uuid(`shipping-rate:${rate.key}`);
		await insertModuleData(client, "shipping", "shippingRate", rateId, {
			id: rateId,
			zoneId: shippingZoneIds[rate.zoneKey],
			name: rate.name,
			price: rate.price,
			minOrderAmount: rate.minOrderAmount,
			isActive: rate.isActive,
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedTax(client: pg.PoolClient) {
	for (const rate of taxRates) {
		await insertModuleData(
			client,
			"tax",
			"taxRate",
			uuid(`tax-rate:${rate.key}`),
			{
				id: uuid(`tax-rate:${rate.key}`),
				name: rate.name,
				country: rate.country,
				state: rate.state,
				city: rate.city,
				postalCode: rate.postalCode,
				rate: rate.rate,
				type: rate.type,
				categoryId: taxCategory.key,
				enabled: rate.enabled,
				priority: rate.priority,
				compound: rate.compound,
				inclusive: rate.inclusive,
				createdAt: now,
				updatedAt: now,
			},
		);
	}

	await insertModuleData(client, "tax", "taxCategory", taxCategory.key, {
		id: taxCategory.key,
		name: taxCategory.name,
		description: taxCategory.description,
		createdAt: now,
		updatedAt: now,
	});
}

async function seedDiscounts(client: pg.PoolClient) {
	for (const discount of discounts) {
		const discountId = uuid(`discount:${discount.key}`);
		await insertModuleData(client, "discounts", "discount", discountId, {
			id: discountId,
			name: discount.name,
			description: discount.description,
			type: discount.type,
			value: discount.value,
			minimumAmount: discount.minimumAmount,
			appliesTo: discount.appliesTo,
			stackable: discount.stackable,
			usedCount: 0,
			isActive: discount.isActive,
			metadata: { theme: summary.house },
			createdAt: now,
			updatedAt: now,
		});

		const codeId = uuid(`discount-code:${discount.key}`);
		await insertModuleData(client, "discounts", "discountCode", codeId, {
			id: codeId,
			discountId,
			code: discount.code,
			usedCount: 0,
			isActive: discount.isActive,
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedFaq(client: pg.PoolClient) {
	for (const category of faqCategories) {
		await insertModuleData(
			client,
			"faq",
			"faqCategory",
			faqCategoryIds[category.key],
			{
				id: faqCategoryIds[category.key],
				name: category.name,
				slug: category.slug,
				description: category.description,
				position: category.position,
				isVisible: true,
				metadata: {},
				createdAt: now,
				updatedAt: now,
			},
		);
	}

	for (const item of faqItems) {
		const itemId = uuid(`faq-item:${item.slug}`);
		await insertModuleData(client, "faq", "faqItem", itemId, {
			id: itemId,
			categoryId: faqCategoryIds[item.categoryKey],
			question: item.question,
			answer: item.answer,
			slug: item.slug,
			position: item.position,
			isVisible: true,
			tags: [],
			helpfulCount: 0,
			notHelpfulCount: 0,
			metadata: {},
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedAnnouncements(client: pg.PoolClient) {
	const announcementId = uuid("announcement:atelier");
	await insertModuleData(
		client,
		"announcements",
		"announcement",
		announcementId,
		{
			id: announcementId,
			...announcement,
			impressions: 0,
			clicks: 0,
			dismissals: 0,
			createdAt: now,
			updatedAt: now,
		},
	);
}

async function seedSeo(client: pg.PoolClient) {
	for (const meta of seoMeta) {
		const metaId = uuid(`seo:${meta.path}`);
		await insertModuleData(client, "seo", "metaTag", metaId, {
			id: metaId,
			...meta,
			noIndex: "false",
			noFollow: "false",
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedSearch(client: pg.PoolClient, assets: AssetResolver) {
	const resolvedProducts = await resolveProducts(assets);
	for (const product of resolvedProducts) {
		const indexId = uuid(`search-index:${product.key}`);
		await insertModuleData(client, "search", "searchIndex", indexId, {
			id: indexId,
			entityType: "product",
			entityId: product.id,
			title: product.name,
			body: product.description,
			tags: product.tags,
			url: `/products/${product.slug}`,
			image: product.images[0],
			metadata: {
				price: product.price,
				sku: product.sku,
				category: product.categoryKey,
				brand: houseBrand.name,
			},
			indexedAt: now,
		});
	}

	for (const synonym of searchSynonyms) {
		const synonymId = uuid(`search-synonym:${synonym.term}`);
		await insertModuleData(client, "search", "searchSynonym", synonymId, {
			id: synonymId,
			term: synonym.term,
			synonyms: synonym.synonyms,
			createdAt: now,
		});
	}
}

async function seedNewsletter(client: pg.PoolClient) {
	for (const subscriber of newsletterSubscribers) {
		const subscriberId = uuid(`newsletter:${subscriber.email}`);
		await insertModuleData(client, "newsletter", "subscriber", subscriberId, {
			id: subscriberId,
			...subscriber,
			tags: ["atelier"],
			metadata: {},
			subscribedAt: now,
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedSocialProof(client: pg.PoolClient, assets: AssetResolver) {
	for (const badge of trustBadges) {
		const badgeId = uuid(`trust-badge:${badge.name}`);
		await insertModuleData(client, "social-proof", "trustBadge", badgeId, {
			id: badgeId,
			...badge,
			createdAt: now,
			updatedAt: now,
		});
	}

	const resolvedProducts = await resolveProducts(assets);
	const productImageByKey = Object.fromEntries(
		resolvedProducts.map((product) => [product.key, product.images[0]]),
	) as Record<string, string>;

	for (const event of activityEvents) {
		const product = productByKey[event.productKey];
		const eventId = uuid(`activity-event:${event.productKey}:${event.city}`);
		await insertModuleData(client, "social-proof", "activityEvent", eventId, {
			id: eventId,
			productId: productIds[event.productKey],
			productName: product.name,
			productSlug: product.slug,
			productImage: productImageByKey[event.productKey],
			eventType: event.eventType,
			region: event.region,
			country: event.country,
			city: event.city,
			quantity: event.quantity,
			createdAt: now,
		});
	}
}

async function seedProductLabels(client: pg.PoolClient) {
	for (const label of productLabels) {
		await insertModuleData(
			client,
			"product-labels",
			"label",
			labelIds[label.key],
			{
				id: labelIds[label.key],
				name: label.name,
				slug: label.slug,
				displayText: label.displayText,
				type: label.type,
				color: label.color,
				backgroundColor: label.backgroundColor,
				priority: label.priority,
				isActive: label.isActive,
				createdAt: now,
				updatedAt: now,
			},
		);
	}

	for (const [labelKey, productKeys] of Object.entries(labelAssignments)) {
		for (const [position, productKey] of productKeys.entries()) {
			const linkId = uuid(`label-assignment:${labelKey}:${productKey}`);
			await insertModuleData(client, "product-labels", "productLabel", linkId, {
				id: linkId,
				productId: productIds[productKey],
				labelId: labelIds[labelKey],
				position: String(position),
				assignedAt: now,
			});
		}
	}
}

async function seedRedirects(client: pg.PoolClient) {
	for (const redirect of redirects) {
		const redirectId = uuid(`redirect:${redirect.sourcePath}`);
		await insertModuleData(client, "redirects", "redirect", redirectId, {
			id: redirectId,
			...redirect,
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedSitemap(client: pg.PoolClient) {
	const configId = uuid("sitemap-config");
	await insertModuleData(client, "sitemap", "sitemapConfig", configId, {
		id: configId,
		...sitemapConfig,
		lastGenerated: now,
		createdAt: now,
		updatedAt: now,
	});
}

async function seedWishlist(client: pg.PoolClient) {
	const wishlists: Array<{
		customerKey: string;
		email: string;
		productKey: string;
		note?: string;
	}> = [
		{
			customerKey: "eleanor-vale",
			email: "eleanor@example.com",
			productKey: "regent-penny-loafer",
			note: "Perfect for Paris.",
		},
		{
			customerKey: "eleanor-vale",
			email: "eleanor@example.com",
			productKey: "montclair-chelsea-boot",
		},
		{
			customerKey: "marcus-chen",
			email: "marcus@example.com",
			productKey: "sable-slingback-pump",
		},
		{
			customerKey: "sofia-alvarez",
			email: "sofia@example.com",
			productKey: "regent-penny-loafer",
		},
	];

	for (const entry of wishlists) {
		const product = productByKey[entry.productKey];
		if (!product) continue;
		const itemId = uuid(`wishlist:${entry.customerKey}:${entry.productKey}`);
		await insertModuleData(client, "wishlist", "wishlistItem", itemId, {
			id: itemId,
			customerId: customerIds[entry.customerKey],
			customerEmail: entry.email,
			productId: productIds[entry.productKey],
			productName: product.name,
			...(entry.note ? { note: entry.note } : {}),
			addedAt: now,
		});
	}
}

async function seedLoyalty(client: pg.PoolClient) {
	const accounts = [
		{
			customerKey: "eleanor-vale",
			tier: "gold" as const,
			lifetimeEarned: 2450,
			lifetimeRedeemed: 200,
		},
		{
			customerKey: "marcus-chen",
			tier: "silver" as const,
			lifetimeEarned: 890,
			lifetimeRedeemed: 0,
		},
		{
			customerKey: "sofia-alvarez",
			tier: "bronze" as const,
			lifetimeEarned: 165,
			lifetimeRedeemed: 0,
		},
	];

	for (const entry of accounts) {
		const accountId = uuid(`loyalty-account:${entry.customerKey}`);
		await insertModuleData(client, "loyalty", "loyaltyAccount", accountId, {
			id: accountId,
			customerId: customerIds[entry.customerKey],
			balance: entry.lifetimeEarned - entry.lifetimeRedeemed,
			lifetimeEarned: entry.lifetimeEarned,
			lifetimeRedeemed: entry.lifetimeRedeemed,
			tier: entry.tier,
			status: "active",
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedFlashSales(client: pg.PoolClient) {
	const saleStartsAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
	const saleEndsAt = new Date(
		Date.now() + 30 * 24 * 60 * 60 * 1000,
	).toISOString();

	const saleId = uuid("flash-sale:weekend-edit");
	await insertModuleData(client, "flash-sales", "flashSale", saleId, {
		id: saleId,
		name: "Atelier Weekend Edit",
		slug: "weekend-edit",
		description:
			"Selected house pieces at exclusive prices, this weekend only.",
		status: "active",
		startsAt: saleStartsAt,
		endsAt: saleEndsAt,
		createdAt: now,
		updatedAt: now,
	});

	const saleProducts: Array<{
		productKey: string;
		discountPct: number;
		order: number;
	}> = [
		{ productKey: "regent-penny-loafer", discountPct: 20, order: 0 },
		{ productKey: "montclair-chelsea-boot", discountPct: 15, order: 1 },
	];

	for (const { productKey, discountPct, order } of saleProducts) {
		const product = productByKey[productKey];
		if (!product) continue;
		const saleProductId = uuid(`flash-sale-product:weekend-edit:${productKey}`);
		const originalPrice = product.price;
		const salePrice = Math.round(originalPrice * (1 - discountPct / 100));
		await insertModuleData(
			client,
			"flash-sales",
			"flashSaleProduct",
			saleProductId,
			{
				id: saleProductId,
				flashSaleId: saleId,
				productId: productIds[productKey],
				productName: product.name,
				productSlug: product.slug,
				salePrice,
				originalPrice,
				stockLimit: 20,
				stockSold: 0,
				sortOrder: order,
				createdAt: now,
			},
		);
	}
}

async function seedSubscriptions(client: pg.PoolClient) {
	const planId = uuid("subscription-plan:atelier-privilege");
	await insertModuleData(client, "subscriptions", "subscriptionPlan", planId, {
		id: planId,
		name: "Atelier Privilege",
		description:
			"Early access to new arrivals, exclusive member pricing, and complimentary alterations on every order.",
		price: 15000,
		currency: "USD",
		interval: "month",
		intervalCount: 1,
		trialDays: 14,
		isActive: true,
		createdAt: now,
		updatedAt: now,
	});

	const periodStart = new Date(
		Date.now() - 8 * 24 * 60 * 60 * 1000,
	).toISOString();
	const periodEnd = new Date(
		Date.now() + 22 * 24 * 60 * 60 * 1000,
	).toISOString();

	const subscribers = [
		{ customerKey: "eleanor-vale", email: "eleanor@example.com" },
		{ customerKey: "marcus-chen", email: "marcus@example.com" },
	];

	for (const { customerKey, email } of subscribers) {
		const subId = uuid(`subscription:${customerKey}:atelier-privilege`);
		await insertModuleData(client, "subscriptions", "subscription", subId, {
			id: subId,
			planId,
			customerId: customerIds[customerKey],
			email,
			status: "active",
			currentPeriodStart: periodStart,
			currentPeriodEnd: periodEnd,
			cancelAtPeriodEnd: false,
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedBundles(client: pg.PoolClient) {
	const bundleId = uuid("bundle:atelier-weekend");
	await insertModuleData(client, "bundles", "bundle", bundleId, {
		id: bundleId,
		name: "Weekend Atelier Bundle",
		slug: "weekend-atelier",
		description:
			"Our most versatile pairing — the Regent Penny Loafer and Montclair Chelsea Boot. Two house signatures, dressed together.",
		status: "active",
		discountType: "percentage",
		discountValue: 12,
		minQuantity: 2,
		sortOrder: 0,
		createdAt: now,
		updatedAt: now,
	});

	const bundleProducts: Array<{
		productKey: string;
		quantity: number;
		sortOrder: number;
	}> = [
		{ productKey: "regent-penny-loafer", quantity: 1, sortOrder: 0 },
		{ productKey: "montclair-chelsea-boot", quantity: 1, sortOrder: 1 },
	];

	for (const { productKey, quantity, sortOrder } of bundleProducts) {
		const product = productByKey[productKey];
		if (!product) continue;
		const itemId = uuid(`bundle-item:atelier-weekend:${productKey}`);
		await insertModuleData(client, "bundles", "bundleItem", itemId, {
			id: itemId,
			bundleId,
			productId: productIds[productKey],
			quantity,
			sortOrder,
			productName: product.name,
			productSlug: product.slug,
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedStoreLocator(client: pg.PoolClient) {
	for (const location of storeLocations) {
		await insertModuleData(
			client,
			"store-locator",
			"location",
			locationIds[location.key],
			{
				id: locationIds[location.key],
				...location,
				createdAt: now,
				updatedAt: now,
			},
		);
	}
}

async function seedStorePickup(client: pg.PoolClient) {
	const pickupLocationId = uuid("pickup-location:flagship");
	await insertModuleData(
		client,
		"store-pickup",
		"pickupLocation",
		pickupLocationId,
		{
			id: pickupLocationId,
			...pickupLocation,
			createdAt: now,
			updatedAt: now,
		},
	);

	for (const [index, window] of pickupWindows.entries()) {
		const windowId = uuid(`pickup-window:${index}`);
		await insertModuleData(client, "store-pickup", "pickupWindow", windowId, {
			id: windowId,
			locationId: pickupLocationId,
			...window,
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedDeliverySlots(client: pg.PoolClient) {
	for (const schedule of deliverySchedules) {
		const scheduleId = uuid(`delivery-slot:${schedule.name}`);
		await insertModuleData(
			client,
			"delivery-slots",
			"deliverySchedule",
			scheduleId,
			{
				id: scheduleId,
				...schedule,
				createdAt: now,
				updatedAt: now,
			},
		);
	}
}

async function seedGiftCards(client: pg.PoolClient) {
	const orderId = uuid("order:demo");

	const cards = [
		{
			key: "gc:eleanor-250",
			code: "GIFT-VALE-8801-ATRL",
			initialBalance: 25000,
			currentBalance: 25000,
			currency: "USD",
			status: "active",
			recipientEmail: "eleanor@example.com",
			recipientName: "Eleanor Vale",
			customerId: customerIds["eleanor-vale"],
			purchasedByCustomerId: customerIds["marcus-chen"],
			senderName: "Marcus Chen",
			senderEmail: "marcus@example.com",
			message: "Enjoy the new collection.",
			deliveryMethod: "email",
			delivered: true,
			deliveredAt: now,
		},
		{
			key: "gc:marcus-200",
			code: "GIFT-CHEN-2024-ATLR",
			initialBalance: 20000,
			currentBalance: 10000,
			currency: "USD",
			status: "active",
			recipientEmail: "marcus@example.com",
			recipientName: "Marcus Chen",
			customerId: customerIds["marcus-chen"],
			deliveryMethod: "email",
			delivered: true,
			deliveredAt: now,
		},
		{
			key: "gc:sofia-50",
			code: "GIFT-ALVZ-5050-ATRL",
			initialBalance: 5000,
			currentBalance: 0,
			currency: "USD",
			status: "depleted",
			recipientEmail: "sofia@example.com",
			recipientName: "Sofia Alvarez",
			customerId: customerIds["sofia-alvarez"],
			deliveryMethod: "email",
			delivered: true,
			deliveredAt: now,
		},
	];

	const cardIds: Record<string, string> = {};
	for (const card of cards) {
		const cardId = uuid(card.key);
		cardIds[card.key] = cardId;
		const { key: _key, ...cardData } = card;
		await insertModuleData(client, "gift-cards", "giftCard", cardId, {
			id: cardId,
			...cardData,
			createdAt: now,
			updatedAt: now,
		});
	}

	// Transaction: Marcus's card — $100 redemption on the demo order
	const txId1 = uuid("gc-tx:marcus-200:debit-1");
	await insertModuleData(client, "gift-cards", "giftCardTransaction", txId1, {
		id: txId1,
		giftCardId: cardIds["gc:marcus-200"],
		type: "debit",
		amount: 10000,
		balanceAfter: 10000,
		orderId,
		customerId: customerIds["marcus-chen"],
		note: "Applied to order AT-1001",
		createdAt: now,
	});

	// Transaction: Sofia's card — fully depleted
	const txId2 = uuid("gc-tx:sofia-50:debit-1");
	await insertModuleData(client, "gift-cards", "giftCardTransaction", txId2, {
		id: txId2,
		giftCardId: cardIds["gc:sofia-50"],
		type: "debit",
		amount: 5000,
		balanceAfter: 0,
		customerId: customerIds["sofia-alvarez"],
		createdAt: now,
	});
}

async function seedAppointments(client: pg.PoolClient) {
	const personalShoppingId = uuid("appointment-service:personal-shopping");
	const alterationsId = uuid("appointment-service:alterations");
	const claireId = uuid("appointment-staff:claire-dubois");
	const antoineId = uuid("appointment-staff:antoine-moreau");

	await insertModuleData(
		client,
		"appointments",
		"service",
		personalShoppingId,
		{
			id: personalShoppingId,
			name: "Personal Shopping",
			slug: "personal-shopping",
			description:
				"A private session with our in-house stylist. We curate a selection based on your style profile before you arrive.",
			duration: 60,
			price: 0,
			currency: "USD",
			status: "active",
			maxCapacity: 1,
			sortOrder: 0,
			createdAt: now,
			updatedAt: now,
		},
	);

	await insertModuleData(client, "appointments", "service", alterationsId, {
		id: alterationsId,
		name: "Alterations Consultation",
		slug: "alterations-consultation",
		description:
			"Meet with our master tailor to discuss bespoke adjustments and fit corrections for any garment.",
		duration: 45,
		price: 0,
		currency: "USD",
		status: "active",
		maxCapacity: 1,
		sortOrder: 1,
		createdAt: now,
		updatedAt: now,
	});

	await insertModuleData(client, "appointments", "staff", claireId, {
		id: claireId,
		name: "Claire Dubois",
		email: "claire@86d-atelier.com",
		bio: "Senior stylist with 12 years at the Atelier. Specialises in wardrobe curation and occasion dressing.",
		status: "active",
		createdAt: now,
		updatedAt: now,
	});

	await insertModuleData(client, "appointments", "staff", antoineId, {
		id: antoineId,
		name: "Antoine Moreau",
		email: "antoine@86d-atelier.com",
		bio: "Master tailor trained in Paris. Handles bespoke alterations, monogramming, and custom commissions.",
		status: "active",
		createdAt: now,
		updatedAt: now,
	});

	// Claire handles personal shopping; Antoine handles alterations
	await insertModuleData(
		client,
		"appointments",
		"staffService",
		uuid("staff-svc:claire:ps"),
		{
			id: uuid("staff-svc:claire:ps"),
			staffId: claireId,
			serviceId: personalShoppingId,
			createdAt: now,
		},
	);
	await insertModuleData(
		client,
		"appointments",
		"staffService",
		uuid("staff-svc:antoine:alt"),
		{
			id: uuid("staff-svc:antoine:alt"),
			staffId: antoineId,
			serviceId: alterationsId,
			createdAt: now,
		},
	);

	// Weekly schedule: Mon–Fri 10:00–18:00 for Claire
	const weekdays = [1, 2, 3, 4, 5];
	for (const day of weekdays) {
		const schedId = uuid(`schedule:claire:${day}`);
		await insertModuleData(client, "appointments", "schedule", schedId, {
			id: schedId,
			staffId: claireId,
			dayOfWeek: day,
			startTime: "10:00",
			endTime: "18:00",
			createdAt: now,
		});
	}

	// Tue–Sat 11:00–19:00 for Antoine
	const antoineDays = [2, 3, 4, 5, 6];
	for (const day of antoineDays) {
		const schedId = uuid(`schedule:antoine:${day}`);
		await insertModuleData(client, "appointments", "schedule", schedId, {
			id: schedId,
			staffId: antoineId,
			dayOfWeek: day,
			startTime: "11:00",
			endTime: "19:00",
			createdAt: now,
		});
	}

	// Upcoming confirmed appointment: Eleanor with Claire (personal shopping)
	const eleanorApptId = uuid("appointment:eleanor:personal-shopping");
	const eleanorStart = new Date(
		Date.now() + 3 * 24 * 60 * 60 * 1000,
	).toISOString();
	const eleanorEnd = new Date(
		Date.now() + 3 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000,
	).toISOString();
	await insertModuleData(client, "appointments", "appointment", eleanorApptId, {
		id: eleanorApptId,
		serviceId: personalShoppingId,
		staffId: claireId,
		customerId: customerIds["eleanor-vale"],
		customerName: "Eleanor Vale",
		customerEmail: "eleanor@example.com",
		startsAt: eleanorStart,
		endsAt: eleanorEnd,
		status: "confirmed",
		price: 0,
		currency: "USD",
		createdAt: now,
		updatedAt: now,
	});

	// Upcoming confirmed appointment: Marcus with Antoine (alterations)
	const marcusApptId = uuid("appointment:marcus:alterations");
	const marcusStart = new Date(
		Date.now() + 5 * 24 * 60 * 60 * 1000,
	).toISOString();
	const marcusEnd = new Date(
		Date.now() + 5 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000,
	).toISOString();
	await insertModuleData(client, "appointments", "appointment", marcusApptId, {
		id: marcusApptId,
		serviceId: alterationsId,
		staffId: antoineId,
		customerId: customerIds["marcus-chen"],
		customerName: "Marcus Chen",
		customerEmail: "marcus@example.com",
		startsAt: marcusStart,
		endsAt: marcusEnd,
		status: "confirmed",
		price: 0,
		currency: "USD",
		createdAt: now,
		updatedAt: now,
	});
}

async function seedMemberships(client: pg.PoolClient) {
	const clubPlanId = uuid("membership-plan:atelier-club");
	const maisonPlanId = uuid("membership-plan:atelier-maison");

	await insertModuleData(client, "memberships", "membershipPlan", clubPlanId, {
		id: clubPlanId,
		name: "Atelier Club",
		slug: "atelier-club",
		description:
			"Monthly membership for the discerning shopper. Priority access, complimentary alterations, and exclusive member events.",
		price: 9900,
		billingInterval: "month",
		trialDays: 0,
		features: [
			"10% off all purchases",
			"Free standard shipping",
			"Early access to new arrivals",
		],
		isActive: true,
		maxMembers: null,
		sortOrder: 0,
		createdAt: now,
		updatedAt: now,
	});

	await insertModuleData(
		client,
		"memberships",
		"membershipPlan",
		maisonPlanId,
		{
			id: maisonPlanId,
			name: "Atelier Maison",
			slug: "atelier-maison",
			description:
				"Annual membership for our most valued clients. Includes all Club benefits plus a personal stylist, bespoke services, and invitations to private previews.",
			price: 79900,
			billingInterval: "year",
			trialDays: 0,
			features: [
				"20% off all purchases",
				"Free express shipping",
				"Priority personal stylist access",
				"Exclusive Maison preview events",
				"Complimentary monogramming",
			],
			isActive: true,
			maxMembers: 50,
			sortOrder: 1,
			createdAt: now,
			updatedAt: now,
		},
	);

	// Benefits
	const clubBenefits = [
		{
			type: "discount",
			value: "10",
			description: "10% off all full-price items",
		},
		{
			type: "shipping",
			value: "free_standard",
			description: "Free standard shipping on all orders",
		},
		{
			type: "access",
			value: "early_access",
			description: "48-hour early access to new arrivals",
		},
	];
	for (const [i, benefit] of clubBenefits.entries()) {
		const benefitId = uuid(`membership-benefit:club:${i}`);
		await insertModuleData(
			client,
			"memberships",
			"membershipBenefit",
			benefitId,
			{
				id: benefitId,
				planId: clubPlanId,
				...benefit,
				isActive: true,
				createdAt: now,
			},
		);
	}

	const maisonBenefits = [
		{
			type: "discount",
			value: "20",
			description: "20% off all full-price items",
		},
		{
			type: "shipping",
			value: "free_express",
			description: "Free express shipping on all orders",
		},
		{
			type: "stylist",
			value: "personal_stylist",
			description: "Access to personal stylist consultations",
		},
		{
			type: "access",
			value: "maison_events",
			description: "Invitations to Maison private previews",
		},
		{
			type: "service",
			value: "monogramming",
			description: "Complimentary monogramming on all orders",
		},
	];
	for (const [i, benefit] of maisonBenefits.entries()) {
		const benefitId = uuid(`membership-benefit:maison:${i}`);
		await insertModuleData(
			client,
			"memberships",
			"membershipBenefit",
			benefitId,
			{
				id: benefitId,
				planId: maisonPlanId,
				...benefit,
				isActive: true,
				createdAt: now,
			},
		);
	}

	// Members: Eleanor → Maison, Marcus → Club
	const membershipStart = new Date(
		Date.now() - 45 * 24 * 60 * 60 * 1000,
	).toISOString();
	const membershipEnd = new Date(
		Date.now() + 320 * 24 * 60 * 60 * 1000,
	).toISOString();
	const clubEnd = new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString();

	const eleanorMembershipId = uuid("membership:eleanor:maison");
	await insertModuleData(
		client,
		"memberships",
		"membership",
		eleanorMembershipId,
		{
			id: eleanorMembershipId,
			customerId: customerIds["eleanor-vale"],
			planId: maisonPlanId,
			status: "active",
			startDate: membershipStart,
			endDate: membershipEnd,
			createdAt: now,
			updatedAt: now,
		},
	);

	const marcusMembershipId = uuid("membership:marcus:club");
	await insertModuleData(
		client,
		"memberships",
		"membership",
		marcusMembershipId,
		{
			id: marcusMembershipId,
			customerId: customerIds["marcus-chen"],
			planId: clubPlanId,
			status: "active",
			startDate: membershipStart,
			endDate: clubEnd,
			createdAt: now,
			updatedAt: now,
		},
	);
}

async function seedWarranties(client: pg.PoolClient) {
	const manufacturerPlanId = uuid("warranty-plan:manufacturer-12");
	const extendedPlanId = uuid("warranty-plan:atelier-protection-24");

	await insertModuleData(
		client,
		"warranties",
		"warrantyPlan",
		manufacturerPlanId,
		{
			id: manufacturerPlanId,
			name: "Manufacturer Warranty",
			description:
				"Standard manufacturer coverage included with every Atelier purchase.",
			type: "manufacturer",
			durationMonths: 12,
			price: 0,
			coverageDetails:
				"Covers manufacturing defects in materials and workmanship. Does not cover normal wear or accidental damage.",
			exclusions:
				"Wear and tear, accidental damage, water damage, unauthorised repairs.",
			isActive: true,
			createdAt: now,
			updatedAt: now,
		},
	);

	await insertModuleData(client, "warranties", "warrantyPlan", extendedPlanId, {
		id: extendedPlanId,
		name: "Atelier Protection Plan",
		description:
			"Extended 24-month protection covering accidental damage and wear on fine leather goods and timepieces.",
		type: "extended",
		durationMonths: 24,
		price: 4999,
		coverageDetails:
			"All manufacturer warranty coverage plus accidental damage, stitching failures, hardware defects, and complimentary annual conditioning service.",
		exclusions:
			"Loss or theft, intentional damage, alterations by third parties.",
		isActive: true,
		createdAt: now,
		updatedAt: now,
	});

	const orderId = uuid("order:demo");
	const purchaseDate = new Date(
		Date.now() - 10 * 24 * 60 * 60 * 1000,
	).toISOString();
	const manufacturerExpiry = new Date(
		Date.now() - 10 * 24 * 60 * 60 * 1000 + 365 * 24 * 60 * 60 * 1000,
	).toISOString();
	const extendedExpiry = new Date(
		Date.now() - 10 * 24 * 60 * 60 * 1000 + 2 * 365 * 24 * 60 * 60 * 1000,
	).toISOString();

	// Manufacturer warranty on the Grand Tour Passport Folio from the demo order
	const folioWarrantyId = uuid("warranty-reg:marcus:folio:manufacturer");
	await insertModuleData(
		client,
		"warranties",
		"warrantyRegistration",
		folioWarrantyId,
		{
			id: folioWarrantyId,
			warrantyPlanId: manufacturerPlanId,
			orderId,
			customerId: customerIds["marcus-chen"],
			productId: productIds["grand-tour-passport-folio"],
			productName: "Grand Tour Passport Folio",
			purchaseDate,
			expiresAt: manufacturerExpiry,
			status: "active",
			createdAt: now,
			updatedAt: now,
		},
	);

	// Extended protection on the Silk Twill Wrap from the demo order
	const wrapWarrantyId = uuid("warranty-reg:marcus:silk-wrap:extended");
	await insertModuleData(
		client,
		"warranties",
		"warrantyRegistration",
		wrapWarrantyId,
		{
			id: wrapWarrantyId,
			warrantyPlanId: extendedPlanId,
			orderId,
			customerId: customerIds["marcus-chen"],
			productId: productIds["silk-twill-wrap"],
			productName: "Silk Twill Wrap",
			purchaseDate,
			expiresAt: extendedExpiry,
			status: "active",
			createdAt: now,
			updatedAt: now,
		},
	);
}

async function seedAuctions(client: pg.PoolClient) {
	const auctionId = uuid("auction:observatory-chronograph:steel-slate");
	const startsAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
	const endsAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

	await insertModuleData(client, "auctions", "auction", auctionId, {
		id: auctionId,
		title: "Observatory Chronograph — Steel / Slate Strap",
		description:
			"A single archive specimen from the Atelier's private collection. Unworn, complete with original box and papers. Available for the first time through live auction.",
		productId: productIds["observatory-chronograph"],
		productName: "Observatory Chronograph",
		type: "english",
		status: "active",
		startingPrice: 300000,
		reservePrice: 340000,
		buyNowPrice: 420000,
		bidIncrement: 5000,
		currentBid: 325000,
		bidCount: 3,
		highestBidderId: customerIds["eleanor-vale"],
		antiSnipingEnabled: true,
		antiSnipingMinutes: 5,
		startsAt,
		endsAt,
		createdAt: now,
		updatedAt: now,
	});

	// Bids in chronological order
	const bid1 = uuid("bid:auction-obs:marcus:1");
	const bid2 = uuid("bid:auction-obs:eleanor:1");
	const bid3 = uuid("bid:auction-obs:marcus:2");
	const bid4 = uuid("bid:auction-obs:eleanor:2");

	const bids = [
		{
			id: bid1,
			customerId: customerIds["marcus-chen"],
			customerName: "Marcus Chen",
			amount: 300000,
			isWinning: false,
			isAutoBid: false,
		},
		{
			id: bid2,
			customerId: customerIds["eleanor-vale"],
			customerName: "Eleanor Vale",
			amount: 305000,
			isWinning: false,
			isAutoBid: false,
		},
		{
			id: bid3,
			customerId: customerIds["marcus-chen"],
			customerName: "Marcus Chen",
			amount: 310000,
			isWinning: false,
			isAutoBid: false,
		},
		{
			id: bid4,
			customerId: customerIds["eleanor-vale"],
			customerName: "Eleanor Vale",
			amount: 325000,
			isWinning: true,
			isAutoBid: false,
		},
	];

	for (const bid of bids) {
		await insertModuleData(client, "auctions", "bid", bid.id, {
			...bid,
			auctionId,
			createdAt: now,
		});
	}
}

async function seedStoreCredits(client: pg.PoolClient) {
	const accounts = [
		{
			customerKey: "eleanor-vale",
			email: "eleanor@example.com",
			balance: 7500,
			lifetimeCredited: 12500,
			lifetimeDebited: 5000,
		},
		{
			customerKey: "marcus-chen",
			email: "marcus@example.com",
			balance: 12500,
			lifetimeCredited: 12500,
			lifetimeDebited: 0,
		},
	];

	for (const entry of accounts) {
		const accountId = uuid(`store-credit-account:${entry.customerKey}`);
		await insertModuleData(
			client,
			"store-credits",
			"creditAccount",
			accountId,
			{
				id: accountId,
				customerId: customerIds[entry.customerKey],
				customerEmail: entry.email,
				balance: entry.balance,
				lifetimeCredited: entry.lifetimeCredited,
				lifetimeDebited: entry.lifetimeDebited,
				currency: "USD",
				status: "active",
				createdAt: now,
				updatedAt: now,
			},
		);

		// Initial credit transaction
		const txId = uuid(`store-credit-tx:${entry.customerKey}:initial`);
		await insertModuleData(client, "store-credits", "creditTransaction", txId, {
			id: txId,
			accountId,
			type: "credit",
			amount: entry.lifetimeCredited,
			balanceAfter: entry.lifetimeCredited,
			reason: "promotional",
			description: "Welcome credit — Atelier loyalty reward",
			createdAt: now,
		});

		// Debit transaction for Eleanor only
		if (entry.lifetimeDebited > 0) {
			const debitId = uuid(`store-credit-tx:${entry.customerKey}:debit-1`);
			const orderId = uuid("order:demo");
			await insertModuleData(
				client,
				"store-credits",
				"creditTransaction",
				debitId,
				{
					id: debitId,
					accountId,
					type: "debit",
					amount: entry.lifetimeDebited,
					balanceAfter: entry.balance,
					reason: "order_payment",
					description: "Applied to order AT-1001",
					referenceType: "order",
					referenceId: orderId,
					createdAt: now,
				},
			);
		}
	}
}

async function seedPreorders(client: pg.PoolClient) {
	const campaignId = uuid("preorder-campaign:cashmere-fringe-scarf");
	const campaignStart = new Date(
		Date.now() - 7 * 24 * 60 * 60 * 1000,
	).toISOString();
	const campaignEnd = new Date(
		Date.now() + 21 * 24 * 60 * 60 * 1000,
	).toISOString();
	const estimatedShip = new Date(
		Date.now() + 60 * 24 * 60 * 60 * 1000,
	).toISOString();

	const cashmereScarf = productByKey["cashmere-fringe-scarf"];

	await insertModuleData(client, "preorders", "preorderCampaign", campaignId, {
		id: campaignId,
		productId: productIds["cashmere-fringe-scarf"],
		productName: cashmereScarf?.name ?? "Cashmere Fringe Scarf",
		status: "active",
		paymentType: "full",
		price: cashmereScarf?.price ?? 28500,
		maxQuantity: 30,
		currentQuantity: 2,
		startDate: campaignStart,
		endDate: campaignEnd,
		estimatedShipDate: estimatedShip,
		message:
			"Reserve your Autumn edition Cashmere Fringe Scarf before it arrives. Limited to 30 pieces worldwide.",
		createdAt: now,
		updatedAt: now,
	});

	const preorderItems = [
		{
			customerKey: "eleanor-vale",
			email: "eleanor@example.com",
		},
		{
			customerKey: "sofia-alvarez",
			email: "sofia@example.com",
		},
	];

	for (const entry of preorderItems) {
		const itemId = uuid(
			`preorder-item:${entry.customerKey}:cashmere-fringe-scarf`,
		);
		await insertModuleData(client, "preorders", "preorderItem", itemId, {
			id: itemId,
			campaignId,
			customerId: customerIds[entry.customerKey],
			customerEmail: entry.email,
			quantity: 1,
			status: "confirmed",
			depositPaid: cashmereScarf?.price ?? 28500,
			totalPrice: cashmereScarf?.price ?? 28500,
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedReferrals(client: pg.PoolClient) {
	// Reward rule
	const ruleId = uuid("referral-rule:default");
	await insertModuleData(client, "referrals", "rewardRule", ruleId, {
		id: ruleId,
		name: "Atelier Friend Referral",
		referrerRewardType: "store_credit",
		referrerRewardValue: 2500,
		refereeRewardType: "store_credit",
		refereeRewardValue: 1500,
		minOrderAmount: 10000,
		active: true,
		createdAt: now,
		updatedAt: now,
	});

	// Referral codes for each customer
	const refCodes = [
		{
			customerKey: "eleanor-vale",
			email: "eleanor@example.com",
			code: "ELEANOR-ATELIER",
		},
		{
			customerKey: "marcus-chen",
			email: "marcus@example.com",
			code: "MARCUS-ATELIER",
		},
		{
			customerKey: "sofia-alvarez",
			email: "sofia@example.com",
			code: "SOFIA-ATELIER",
		},
	];

	const codeIds: Record<string, string> = {};
	for (const entry of refCodes) {
		const codeId = uuid(`referral-code:${entry.customerKey}`);
		codeIds[entry.customerKey] = codeId;
		await insertModuleData(client, "referrals", "referralCode", codeId, {
			id: codeId,
			customerId: customerIds[entry.customerKey],
			customerEmail: entry.email,
			code: entry.code,
			active: true,
			usageCount: entry.customerKey === "eleanor-vale" ? 1 : 0,
			maxUses: 0,
			createdAt: now,
		});
	}

	// Completed referral: Eleanor referred Sofia
	const referralId = uuid("referral:eleanor:sofia");
	await insertModuleData(client, "referrals", "referral", referralId, {
		id: referralId,
		referrerCodeId: codeIds["eleanor-vale"],
		referrerCustomerId: customerIds["eleanor-vale"],
		referrerEmail: "eleanor@example.com",
		refereeCustomerId: customerIds["sofia-alvarez"],
		refereeEmail: "sofia@example.com",
		status: "completed",
		referrerRewarded: true,
		refereeRewarded: true,
		completedAt: now,
		createdAt: now,
	});
}

async function seedAffiliates(client: pg.PoolClient) {
	const affiliates = [
		{
			key: "the-sartorial-edit",
			name: "The Sartorial Edit",
			email: "collab@thesartorialedit.com",
			website: "https://thesartorialedit.com",
			code: "SARTORIAL20",
			commissionRate: 12,
			status: "active",
			totalClicks: 842,
			totalConversions: 14,
			totalRevenue: 1240000,
			totalCommission: 148800,
			totalPaid: 100000,
		},
		{
			key: "curated-luxury-guide",
			name: "Curated Luxury Guide",
			email: "partnerships@curatedluxuryguide.com",
			website: "https://curatedluxuryguide.com",
			code: "CLG15",
			commissionRate: 10,
			status: "active",
			totalClicks: 376,
			totalConversions: 7,
			totalRevenue: 645000,
			totalCommission: 64500,
			totalPaid: 64500,
		},
	];

	for (const aff of affiliates) {
		const affId = uuid(`affiliate:${aff.key}`);
		const { key: _key, ...affData } = aff;
		await insertModuleData(client, "affiliates", "affiliate", affId, {
			id: affId,
			...affData,
			createdAt: now,
			updatedAt: now,
		});

		// One affiliate link per affiliate (homepage)
		const linkId = uuid(`affiliate-link:${aff.key}:home`);
		await insertModuleData(client, "affiliates", "affiliateLink", linkId, {
			id: linkId,
			affiliateId: affId,
			targetUrl: "/",
			slug: `${aff.code.toLowerCase()}-home`,
			clicks: aff.totalClicks,
			conversions: aff.totalConversions,
			revenue: aff.totalRevenue,
			active: true,
			createdAt: now,
		});

		// One conversion (latest order)
		const orderId = uuid("order:demo");
		const convId = uuid(`affiliate-conversion:${aff.key}:1`);
		await insertModuleData(
			client,
			"affiliates",
			"affiliateConversion",
			convId,
			{
				id: convId,
				affiliateId: affId,
				linkId,
				orderId,
				orderAmount: 157000,
				commissionRate: aff.commissionRate,
				commissionAmount: Math.round(157000 * aff.commissionRate) / 100,
				status: "approved",
				paidAt: now,
				createdAt: now,
			},
		);
	}
}

async function seedCustomerGroups(client: pg.PoolClient) {
	const groups = [
		{
			key: "vip",
			name: "VIP",
			slug: "vip",
			description:
				"Top-tier clients with lifetime spend over $10,000 or by direct invitation.",
			type: "manual",
			priority: 10,
		},
		{
			key: "maison-members",
			name: "Maison Members",
			slug: "maison-members",
			description: "Active Atelier Maison annual membership holders.",
			type: "manual",
			priority: 5,
		},
		{
			key: "new-arrivals",
			name: "New Customers",
			slug: "new-customers",
			description: "Customers who have joined in the past 90 days.",
			type: "automatic",
			priority: 1,
		},
	];

	const groupIds: Record<string, string> = {};
	for (const group of groups) {
		const groupId = uuid(`customer-group:${group.key}`);
		groupIds[group.key] = groupId;
		const { key: _key, ...groupData } = group;
		await insertModuleData(
			client,
			"customer-groups",
			"customerGroup",
			groupId,
			{
				id: groupId,
				...groupData,
				isActive: true,
				metadata: {},
				createdAt: now,
				updatedAt: now,
			},
		);
	}

	// Memberships: Eleanor → VIP + Maison Members, Marcus → Maison Members, Sofia → New Customers
	const memberships = [
		{ customerKey: "eleanor-vale", groupKey: "vip" },
		{ customerKey: "eleanor-vale", groupKey: "maison-members" },
		{ customerKey: "marcus-chen", groupKey: "maison-members" },
		{ customerKey: "sofia-alvarez", groupKey: "new-arrivals" },
	];

	for (const entry of memberships) {
		const membershipId = uuid(
			`group-membership:${entry.customerKey}:${entry.groupKey}`,
		);
		await insertModuleData(
			client,
			"customer-groups",
			"groupMembership",
			membershipId,
			{
				id: membershipId,
				groupId: groupIds[entry.groupKey],
				customerId: customerIds[entry.customerKey],
				joinedAt: now,
				metadata: {},
			},
		);
	}
}

async function seedAbandonedCarts(client: pg.PoolClient) {
	const softScarf = productByKey["cashmere-fringe-scarf"];
	const loafer = productByKey["regent-penny-loafer"];

	const cartItems = (product: typeof softScarf, variantKey: string) =>
		product
			? [
					{
						productId: productIds[product.slug],
						productName: product.name,
						variantId: uuid(`variant:${variantKey}`),
						variantLabel: "Truffle",
						quantity: 1,
						price: product.price,
						imageUrl: null,
					},
				]
			: [];

	// Active abandoned cart (Marcus left a loafer in his cart)
	const cart1Id = uuid("abandoned-cart:marcus:loafer");
	await insertModuleData(client, "abandoned-carts", "abandonedCart", cart1Id, {
		id: cart1Id,
		cartId: uuid("cart:marcus:session-1"),
		customerId: customerIds["marcus-chen"],
		email: "marcus@example.com",
		items: cartItems(loafer, "regent-penny-loafer:onx-42"),
		cartTotal: loafer?.price ?? 49500,
		currency: "USD",
		status: "active",
		recoveryToken: uuid("recovery-token:marcus:loafer").replace(/-/g, ""),
		attemptCount: 1,
		lastActivityAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
		abandonedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
		metadata: {},
		createdAt: now,
		updatedAt: now,
	});

	// Recovered abandoned cart (Sofia recovered her scarf cart)
	const cart2Id = uuid("abandoned-cart:sofia:scarf");
	await insertModuleData(client, "abandoned-carts", "abandonedCart", cart2Id, {
		id: cart2Id,
		cartId: uuid("cart:sofia:session-2"),
		customerId: customerIds["sofia-alvarez"],
		email: "sofia@example.com",
		items: cartItems(softScarf, "cashmere-fringe-scarf:trf"),
		cartTotal: softScarf?.price ?? 28500,
		currency: "USD",
		status: "recovered",
		recoveryToken: uuid("recovery-token:sofia:scarf").replace(/-/g, ""),
		attemptCount: 2,
		lastActivityAt: new Date(
			Date.now() - 2 * 24 * 60 * 60 * 1000,
		).toISOString(),
		abandonedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
		recoveredAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
		recoveredOrderId: uuid("order:demo"),
		metadata: {},
		createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
		updatedAt: now,
	});
}

async function seedDigitalDownloads(client: pg.PoolClient) {
	// Downloadable leather care guide linked to the Grand Tour Passport Folio
	const fileId = uuid("download-file:leather-care-guide");
	await insertModuleData(
		client,
		"digital-downloads",
		"downloadableFile",
		fileId,
		{
			id: fileId,
			productId: productIds["grand-tour-passport-folio"],
			name: "Atelier Leather Care Guide",
			url: "/downloads/86d-atelier-leather-care-guide.pdf",
			fileSize: 2048000,
			mimeType: "application/pdf",
			isActive: true,
			createdAt: now,
			updatedAt: now,
		},
	);

	// Download token for Marcus (purchased via demo order)
	const tokenId = uuid("download-token:marcus:leather-care-guide");
	const orderId = uuid("order:demo");
	await insertModuleData(
		client,
		"digital-downloads",
		"downloadToken",
		tokenId,
		{
			id: tokenId,
			token: uuid("token:marcus:leather-care-guide").replace(/-/g, ""),
			fileId,
			orderId,
			email: "marcus@example.com",
			maxDownloads: 5,
			downloadCount: 1,
			expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
			createdAt: now,
			updatedAt: now,
		},
	);
}

async function seedQuotes(client: pg.PoolClient) {
	const quoteId = uuid("quote:marcus:chronographs-corp");
	const expiresAt = new Date(
		Date.now() + 14 * 24 * 60 * 60 * 1000,
	).toISOString();
	const chronograph = productByKey["observatory-chronograph"];

	await insertModuleData(client, "quotes", "quote", quoteId, {
		id: quoteId,
		customerId: customerIds["marcus-chen"],
		customerEmail: "marcus@example.com",
		customerName: "Marcus Chen",
		companyName: "Chen Capital Partners",
		status: "under_review",
		notes:
			"Corporate gifting — 3 pieces for senior partners. Would like engraving options.",
		adminNotes: "High-value account. Follow up with bespoke engraving quote.",
		subtotal: (chronograph?.price ?? 345000) * 3,
		discount: 25000,
		total: (chronograph?.price ?? 345000) * 3 - 25000,
		expiresAt,
		metadata: {},
		createdAt: now,
		updatedAt: now,
	});

	// Quote items
	const qItemId = uuid("quote-item:marcus:chronograph:1");
	await insertModuleData(client, "quotes", "quoteItem", qItemId, {
		id: qItemId,
		quoteId,
		productId: productIds["observatory-chronograph"],
		productName: chronograph?.name ?? "Observatory Chronograph",
		sku: "AT-OBS-SSL",
		quantity: 3,
		unitPrice: chronograph?.price ?? 345000,
		offeredPrice: (chronograph?.price ?? 345000) * 3 - 25000,
		notes: "Steel / Slate Strap preferred",
		createdAt: now,
		updatedAt: now,
	});
}

async function seedReturns(client: pg.PoolClient) {
	const orderId = uuid("order:demo");
	const returnId = uuid("return:marcus:silk-twill-wrap");
	const silkWrap = productByKey["silk-twill-wrap"];

	await insertModuleData(client, "returns", "returnRequest", returnId, {
		id: returnId,
		orderId,
		customerId: customerIds["marcus-chen"],
		customerEmail: "marcus@example.com",
		status: "approved",
		refundMethod: "store_credit",
		refundAmount: silkWrap?.price ?? 28500,
		currency: "USD",
		reason: "Colour not as expected",
		customerNotes:
			"The Camargue colourway appeared darker in person than online.",
		adminNotes: "Approved. Store credit issued.",
		createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
		updatedAt: now,
	});

	// Return item
	const returnItemId = uuid("return-item:marcus:silk-twill-wrap:1");
	await insertModuleData(client, "returns", "returnItem", returnItemId, {
		id: returnItemId,
		returnRequestId: returnId,
		orderItemId: uuid(`order-item:demo:silk-twill-wrap`),
		productName: silkWrap?.name ?? "Silk Twill Wrap",
		sku: "AT-STW-CMR",
		quantity: 1,
		unitPrice: silkWrap?.price ?? 28500,
		returnedQuantity: 1,
		reason: "Colour not as expected",
		condition: "like_new",
		createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
	});
}

async function seedBackorders(client: pg.PoolClient) {
	const loafer = productByKey["regent-penny-loafer"];
	const estimatedDate = new Date(
		Date.now() + 21 * 24 * 60 * 60 * 1000,
	).toISOString();

	// Backorder policy for the loafer
	const policyId = uuid("backorder-policy:regent-penny-loafer");
	await insertModuleData(client, "backorders", "backorderPolicy", policyId, {
		id: policyId,
		productId: productIds["regent-penny-loafer"],
		enabled: true,
		maxQuantityPerOrder: 2,
		maxTotalBackorders: 20,
		estimatedLeadDays: 21,
		autoConfirm: true,
		message:
			"This style is currently on backorder. Estimated delivery in 3 weeks.",
		createdAt: now,
		updatedAt: now,
	});

	// 2 backordered items
	const backorderCustomers = [
		{
			customerKey: "eleanor-vale",
			email: "eleanor@example.com",
			variantKey: "regent-penny-loafer:wnl-40",
		},
		{
			customerKey: "sofia-alvarez",
			email: "sofia@example.com",
			variantKey: "regent-penny-loafer:onx-38",
		},
	];

	for (const entry of backorderCustomers) {
		const backorderId = uuid(`backorder:${entry.customerKey}:loafer`);
		await insertModuleData(client, "backorders", "backorder", backorderId, {
			id: backorderId,
			productId: productIds["regent-penny-loafer"],
			productName: loafer?.name ?? "Regent Penny Loafer",
			variantId: uuid(`variant:${entry.variantKey}`),
			variantLabel: entry.variantKey.split(":")[1]?.toUpperCase(),
			customerId: customerIds[entry.customerKey],
			customerEmail: entry.email,
			quantity: 1,
			status: "confirmed",
			estimatedAvailableAt: estimatedDate,
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedGiftRegistry(client: pg.PoolClient) {
	const registryId = uuid("gift-registry:eleanor:wedding");
	const eventDate = new Date(
		Date.now() + 180 * 24 * 60 * 60 * 1000,
	).toISOString();

	await insertModuleData(client, "gift-registry", "registry", registryId, {
		id: registryId,
		customerId: customerIds["eleanor-vale"],
		customerName: "Eleanor Vale",
		title: "Eleanor & James — Spring Wedding",
		description:
			"We are so grateful for your presence. These are a few pieces we love from the Atelier.",
		type: "wedding",
		slug: "eleanor-james-wedding-2026",
		visibility: "public",
		status: "active",
		eventDate,
		thankYouMessage:
			"Thank you for thinking of us — every gift means the world.",
		itemCount: 3,
		purchasedCount: 1,
		createdAt: now,
		updatedAt: now,
	});

	// 3 registry items
	const items = [
		{
			key: "loafer",
			productKey: "regent-penny-loafer",
			priority: "must_have" as const,
			note: "Perfect for the honeymoon.",
			quantityDesired: 1,
			quantityReceived: 1,
		},
		{
			key: "handbag",
			productKey: "palais-top-handle",
			priority: "must_have" as const,
			note: null,
			quantityDesired: 1,
			quantityReceived: 0,
		},
		{
			key: "watch",
			productKey: "meridian-automatic-38",
			priority: "dream" as const,
			note: "A dream piece for a milestone occasion.",
			quantityDesired: 1,
			quantityReceived: 0,
		},
	];

	for (const item of items) {
		const product = productByKey[item.productKey];
		if (!product) continue;
		const itemId = uuid(`registry-item:eleanor-wedding:${item.key}`);
		await insertModuleData(client, "gift-registry", "registryItem", itemId, {
			id: itemId,
			registryId,
			productId: productIds[item.productKey],
			productName: product.name,
			priceInCents: product.price,
			quantityDesired: item.quantityDesired,
			quantityReceived: item.quantityReceived,
			priority: item.priority,
			...(item.note ? { note: item.note } : {}),
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedBulkPricing(client: pg.PoolClient) {
	const ruleId = uuid("bulk-pricing-rule:footwear-volume");

	await insertModuleData(client, "bulk-pricing", "pricingRule", ruleId, {
		id: ruleId,
		name: "Footwear Volume Discount",
		description:
			"Volume discounts on all Atelier footwear styles for wholesale and corporate accounts.",
		scope: "collection",
		targetId: collectionIds.footwear,
		priority: 10,
		active: true,
		createdAt: now,
		updatedAt: now,
	});

	const tiers = [
		{
			min: 3,
			max: 5,
			type: "percentage",
			value: 5,
			label: "Buy 3–5 pairs, save 5%",
		},
		{
			min: 6,
			max: 11,
			type: "percentage",
			value: 10,
			label: "Buy 6–11 pairs, save 10%",
		},
		{
			min: 12,
			max: null,
			type: "percentage",
			value: 15,
			label: "Buy 12+ pairs, save 15%",
		},
	];

	for (const [i, tier] of tiers.entries()) {
		const tierId = uuid(`bulk-pricing-tier:footwear:${i}`);
		await insertModuleData(client, "bulk-pricing", "pricingTier", tierId, {
			id: tierId,
			ruleId,
			minQuantity: tier.min,
			maxQuantity: tier.max,
			discountType: tier.type,
			discountValue: tier.value,
			label: tier.label,
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedGiftWrapping(client: pg.PoolClient) {
	const options = [
		{
			key: "classic",
			name: "Classic Tissue Wrap",
			description:
				"Our house tissue paper with a satin ribbon. Complimentary with every order.",
			priceInCents: 0,
			sortOrder: 0,
		},
		{
			key: "signature-box",
			name: "Atelier Signature Box",
			description:
				"Rigid gift box in Atelier ivory, sealed with wax and a grosgrain ribbon.",
			priceInCents: 1500,
			sortOrder: 1,
		},
		{
			key: "black-lacquer",
			name: "Atelier Black Lacquer",
			description:
				"Matte-black lacquer box with gold foil monogram, velvet interior, and a hand-tied bow.",
			priceInCents: 2500,
			sortOrder: 2,
		},
	];

	const optionIds: Record<string, string> = {};
	for (const opt of options) {
		const optId = uuid(`wrap-option:${opt.key}`);
		optionIds[opt.key] = optId;
		const { key: _key, ...optData } = opt;
		await insertModuleData(client, "gift-wrapping", "wrapOption", optId, {
			id: optId,
			...optData,
			active: true,
			createdAt: now,
			updatedAt: now,
		});
	}

	// Wrap selection on the demo order (Passport Folio in Signature Box)
	const orderId = uuid("order:demo");
	const orderItemId = uuid("order-item:demo:grand-tour-passport-folio");
	const selectionId = uuid("wrap-selection:demo-order:folio");
	await insertModuleData(
		client,
		"gift-wrapping",
		"wrapSelection",
		selectionId,
		{
			id: selectionId,
			orderId,
			orderItemId,
			wrapOptionId: optionIds["signature-box"],
			wrapOptionName: "Atelier Signature Box",
			priceInCents: 1500,
			recipientName: "Eleanor Vale",
			giftMessage: "With love — Marcus.",
			customerId: customerIds["marcus-chen"],
			createdAt: now,
		},
	);
}

async function seedInvoices(client: pg.PoolClient) {
	const invoiceId = uuid("invoice:demo-order");
	const orderId = uuid("order:demo");
	const issuedAt = new Date(
		Date.now() - 10 * 24 * 60 * 60 * 1000,
	).toISOString();
	const dueDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
	const silkWrap = productByKey["silk-twill-wrap"];
	const folio = productByKey["grand-tour-passport-folio"];
	const subtotal = (silkWrap?.price ?? 28500) + (folio?.price ?? 89500);
	const taxAmount = 8303;
	const total = subtotal + taxAmount;

	await insertModuleData(client, "invoices", "invoice", invoiceId, {
		id: invoiceId,
		invoiceNumber: "INV-2026-0001",
		orderId,
		customerId: customerIds["marcus-chen"],
		customerName: "Marcus Chen",
		status: "paid",
		paymentTerms: "due_on_receipt",
		issuedAt,
		dueDate,
		subtotal,
		taxAmount,
		shippingAmount: 0,
		discountAmount: 0,
		total,
		amountPaid: total,
		amountDue: 0,
		currency: "USD",
		notes: "Thank you for your order.",
		createdAt: issuedAt,
		updatedAt: now,
	});

	// Invoice line items
	const invoiceItems = [
		{ productKey: "grand-tour-passport-folio", quantity: 1 },
		{ productKey: "silk-twill-wrap", quantity: 1 },
	];

	for (const [i, item] of invoiceItems.entries()) {
		const product = productByKey[item.productKey];
		if (!product) continue;
		const lineId = uuid(`invoice-line:demo:${i}`);
		await insertModuleData(client, "invoices", "invoiceLine", lineId, {
			id: lineId,
			invoiceId,
			productId: productIds[item.productKey],
			description: product.name,
			quantity: item.quantity,
			unitPrice: product.price,
			total: product.price * item.quantity,
			createdAt: issuedAt,
		});
	}
}

async function seedGamification(client: pg.PoolClient) {
	const gameId = uuid("game:atelier-spin");

	await insertModuleData(client, "gamification", "game", gameId, {
		id: gameId,
		name: "Atelier Lucky Draw",
		description: "Spin for a chance to win an exclusive Atelier reward.",
		type: "wheel",
		isActive: true,
		requireEmail: true,
		requireNewsletterOptIn: false,
		maxPlaysPerUser: 1,
		cooldownMinutes: 10080,
		totalPlays: 2,
		totalWins: 2,
		settings: {
			wheelColors: ["#1a1a1a", "#e8ddd0", "#8b7355", "#c5b99a"],
			spinDuration: 4000,
		},
		createdAt: now,
		updatedAt: now,
	});

	const prizes = [
		{
			key: "5pct-off",
			name: "5% Off Your Next Order",
			type: "discount-percent",
			value: "5",
			probability: 0.4,
			maxWins: -1,
			currentWins: 1,
		},
		{
			key: "free-shipping",
			name: "Free Express Shipping",
			type: "free-shipping",
			value: "express",
			probability: 0.35,
			maxWins: -1,
			currentWins: 1,
		},
		{
			key: "15pct-off",
			name: "15% Off Your Next Order",
			type: "discount-percent",
			value: "15",
			probability: 0.15,
			maxWins: 50,
			currentWins: 0,
		},
		{
			key: "no-prize",
			name: "Better luck next time",
			type: "no-prize",
			value: "0",
			probability: 0.1,
			maxWins: -1,
			currentWins: 0,
		},
	];

	const prizeIds: Record<string, string> = {};
	for (const prize of prizes) {
		const prizeId = uuid(`prize:atelier-spin:${prize.key}`);
		prizeIds[prize.key] = prizeId;
		const { key: _key, ...prizeData } = prize;
		await insertModuleData(client, "gamification", "prize", prizeId, {
			id: prizeId,
			gameId,
			...prizeData,
			discountCode: prize.type.startsWith("discount")
				? `ATELIER${prize.value}`
				: undefined,
			isActive: true,
			createdAt: now,
		});
	}

	// 2 plays: Eleanor won 5% (redeemed), Sofia won free shipping
	const plays = [
		{
			key: "eleanor",
			customerKey: "eleanor-vale",
			email: "eleanor@example.com",
			prizeKey: "5pct-off",
			isRedeemed: true,
			redeemedAt: now,
		},
		{
			key: "sofia",
			customerKey: "sofia-alvarez",
			email: "sofia@example.com",
			prizeKey: "free-shipping",
			isRedeemed: false,
		},
	];

	for (const play of plays) {
		const playId = uuid(`play:atelier-spin:${play.key}`);
		const prize = prizes.find((p) => p.key === play.prizeKey);
		await insertModuleData(client, "gamification", "play", playId, {
			id: playId,
			gameId,
			email: play.email,
			customerId: customerIds[play.customerKey],
			result: "win",
			prizeId: prizeIds[play.prizeKey],
			prizeName: prize?.name,
			prizeValue: prize?.value,
			isRedeemed: play.isRedeemed,
			...(play.redeemedAt ? { redeemedAt: play.redeemedAt } : {}),
			createdAt: now,
		});
	}
}

async function seedMultiCurrency(client: pg.PoolClient) {
	const currencies = [
		{
			code: "USD",
			name: "US Dollar",
			symbol: "$",
			exchangeRate: 1,
			isBase: true,
			sortOrder: 0,
		},
		{
			code: "EUR",
			name: "Euro",
			symbol: "€",
			exchangeRate: 0.92,
			isBase: false,
			sortOrder: 1,
			symbolPosition: "after" as const,
		},
		{
			code: "GBP",
			name: "British Pound",
			symbol: "£",
			exchangeRate: 0.79,
			isBase: false,
			sortOrder: 2,
		},
		{
			code: "JPY",
			name: "Japanese Yen",
			symbol: "¥",
			exchangeRate: 149.5,
			isBase: false,
			sortOrder: 3,
			decimalPlaces: 0,
		},
	];

	for (const currency of currencies) {
		const currencyId = uuid(`currency:${currency.code}`);
		await insertModuleData(client, "multi-currency", "currency", currencyId, {
			id: currencyId,
			decimalPlaces: currency.decimalPlaces ?? 2,
			isActive: true,
			symbolPosition: currency.symbolPosition ?? "before",
			thousandsSeparator: ",",
			decimalSeparator: ".",
			roundingMode: "round",
			...currency,
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedWaitlist(client: pg.PoolClient) {
	const chronograph = productByKey["observatory-chronograph"];

	const entries = [
		{
			customerKey: "marcus-chen",
			email: "marcus@example.com",
			variant: "rose-cocoa",
		},
		{
			customerKey: "sofia-alvarez",
			email: "sofia@example.com",
			variant: "rose-cocoa",
		},
	];

	for (const entry of entries) {
		const entryId = uuid(
			`waitlist:${entry.customerKey}:observatory-chronograph:${entry.variant}`,
		);
		await insertModuleData(client, "waitlist", "waitlistEntry", entryId, {
			id: entryId,
			productId: productIds["observatory-chronograph"],
			productName: chronograph?.name ?? "Observatory Chronograph",
			variantId: uuid(`variant:observatory-chronograph:${entry.variant}`),
			variantLabel: "Rose / Cocoa Strap",
			email: entry.email,
			customerId: customerIds[entry.customerKey],
			status: "waiting",
			createdAt: now,
		});
	}
}

async function seedCart(client: pg.PoolClient) {
	const now = new Date().toISOString();

	// Marcus: active cart with Observatory Chronograph
	const marcusCartId = uuid("cart:marcus-chen:active");
	await insertModuleData(client, "cart", "cart", marcusCartId, {
		id: marcusCartId,
		customerId: customerIds["marcus-chen"],
		status: "active",
		expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
		createdAt: now,
		updatedAt: now,
	});
	const marcusCartItemId = uuid(
		"cart-item:marcus-chen:observatory-chronograph",
	);
	await insertModuleData(client, "cart", "cartItem", marcusCartItemId, {
		id: marcusCartItemId,
		cartId: marcusCartId,
		productId: productIds["observatory-chronograph"],
		variantId: uuid("variant:observatory-chronograph:rose-cocoa"),
		quantity: 1,
		price: 345000,
		productName: "Observatory Chronograph",
		productSlug: "observatory-chronograph",
		createdAt: now,
		updatedAt: now,
	});

	// Sofia: abandoned cart with Cashmere Fringe Scarf
	const sofiaCartId = uuid("cart:sofia-alvarez:abandoned");
	await insertModuleData(client, "cart", "cart", sofiaCartId, {
		id: sofiaCartId,
		customerId: customerIds["sofia-alvarez"],
		status: "abandoned",
		expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
		createdAt: now,
		updatedAt: now,
	});
	const sofiaCartItemId = uuid("cart-item:sofia-alvarez:cashmere-fringe-scarf");
	await insertModuleData(client, "cart", "cartItem", sofiaCartItemId, {
		id: sofiaCartItemId,
		cartId: sofiaCartId,
		productId: productIds["cashmere-fringe-scarf"],
		variantId: uuid("variant:cashmere-fringe-scarf:ivory"),
		quantity: 1,
		price: 49500,
		productName: "Cashmere Fringe Scarf",
		productSlug: "cashmere-fringe-scarf",
		createdAt: now,
		updatedAt: now,
	});
}

async function seedCheckout(client: pg.PoolClient) {
	const now = new Date().toISOString();
	const orderId = uuid("order:demo");
	const sessionId = uuid("checkout:demo-order");

	await insertModuleData(client, "checkout", "checkoutSession", sessionId, {
		id: sessionId,
		cartId: uuid("cart:eleanor-vale:completed"),
		customerId: customerIds["eleanor-vale"],
		orderId,
		status: "completed",
		subtotal: 89500,
		taxAmount: 7697,
		shippingAmount: 0,
		discountAmount: 0,
		total: 97197,
		currency: "USD",
		completedAt: now,
		createdAt: now,
		updatedAt: now,
	});

	const lineItems = [
		{
			productId: productIds["grand-tour-passport-folio"],
			productName: "Grand Tour Passport Folio",
			quantity: 1,
			price: 44500,
		},
		{
			productId: productIds["silk-twill-wrap"],
			productName: "Silk Twill Wrap",
			quantity: 1,
			price: 45000,
		},
	];
	for (const item of lineItems) {
		const lineItemId = uuid(`checkout-line:demo-order:${item.productId}`);
		await insertModuleData(client, "checkout", "checkoutLineItem", lineItemId, {
			id: lineItemId,
			sessionId,
			productId: item.productId,
			productName: item.productName,
			quantity: item.quantity,
			price: item.price,
			createdAt: now,
		});
	}
}

async function seedNotifications(client: pg.PoolClient) {
	const now = new Date().toISOString();

	// Templates
	const templates = [
		{
			id: uuid("notif-tpl:order-confirmed"),
			slug: "order-confirmed",
			name: "Order Confirmed",
			type: "transactional",
			titleTemplate: "Your order #{{orderNumber}} is confirmed",
			bodyTemplate: "Thank you for your order. We'll notify you when it ships.",
		},
		{
			id: uuid("notif-tpl:order-shipped"),
			slug: "order-shipped",
			name: "Order Shipped",
			type: "transactional",
			titleTemplate: "Your order is on its way",
			bodyTemplate:
				"Your order #{{orderNumber}} has shipped. Track it here: {{trackingUrl}}",
		},
		{
			id: uuid("notif-tpl:promotion"),
			slug: "new-arrivals",
			name: "New Arrivals",
			type: "marketing",
			titleTemplate: "New arrivals at Atelier",
			bodyTemplate:
				"Discover our latest pieces crafted for the discerning collector.",
		},
	];
	for (const tpl of templates) {
		await insertModuleData(client, "notifications", "template", tpl.id, {
			...tpl,
			isActive: true,
			createdAt: now,
			updatedAt: now,
		});
	}

	// Preferences
	for (const [key, channel] of [
		["eleanor-vale", "email"],
		["marcus-chen", "email"],
		["sofia-alvarez", "sms"],
	] as const) {
		const prefId = uuid(`notif-pref:${key}`);
		await insertModuleData(client, "notifications", "preference", prefId, {
			id: prefId,
			customerId: customerIds[key],
			channel,
			orderUpdates: true,
			promotions: key !== "marcus-chen",
			createdAt: now,
			updatedAt: now,
		});
	}

	// Notifications
	const notifications = [
		{
			key: "eleanor-order-confirmed",
			customerId: "eleanor-vale",
			type: "order-confirmed",
			channel: "email",
			priority: "high",
			title: "Your order #ORD-2026-0001 is confirmed",
			body: "Thank you for your order. We'll notify you when it ships.",
			read: true,
		},
		{
			key: "eleanor-order-shipped",
			customerId: "eleanor-vale",
			type: "order-shipped",
			channel: "email",
			priority: "high",
			title: "Your order is on its way",
			body: "Your order has shipped with UPS. Track: 1Z999AA10123456784",
			read: false,
		},
		{
			key: "marcus-new-arrivals",
			customerId: "marcus-chen",
			type: "promotion",
			channel: "email",
			priority: "normal",
			title: "New arrivals at Atelier",
			body: "Discover our latest pieces crafted for the discerning collector.",
			read: false,
		},
	];
	for (const n of notifications) {
		const notifId = uuid(`notification:${n.key}`);
		await insertModuleData(client, "notifications", "notification", notifId, {
			id: notifId,
			customerId: customerIds[n.customerId as keyof typeof customerIds],
			type: n.type,
			channel: n.channel,
			priority: n.priority,
			title: n.title,
			body: n.body,
			read: n.read,
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedRecentlyViewed(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const views = [
		{
			key: "eleanor-loafer",
			customerKey: "eleanor-vale",
			productKey: "regent-penny-loafer",
		},
		{
			key: "marcus-chronograph",
			customerKey: "marcus-chen",
			productKey: "observatory-chronograph",
		},
		{
			key: "sofia-scarf",
			customerKey: "sofia-alvarez",
			productKey: "cashmere-fringe-scarf",
		},
		{
			key: "marcus-folio",
			customerKey: "marcus-chen",
			productKey: "grand-tour-passport-folio",
		},
		{
			key: "eleanor-wrap",
			customerKey: "eleanor-vale",
			productKey: "silk-twill-wrap",
		},
	];

	for (const view of views) {
		const product = productByKey[view.productKey];
		const viewId = uuid(`recently-viewed:${view.key}`);
		await insertModuleData(client, "recently-viewed", "productView", viewId, {
			id: viewId,
			customerId: customerIds[view.customerKey as keyof typeof customerIds],
			productId: productIds[view.productKey],
			productName: product?.name ?? view.productKey,
			productSlug: product?.slug ?? view.productKey,
			productImage: product?.imagePaths?.[0] ?? "",
			viewedAt: now,
			createdAt: now,
		});
	}
}

async function seedRecommendations(client: pg.PoolClient) {
	const now = new Date().toISOString();

	// Recommendation rules
	const rules = [
		{
			id: uuid("rec-rule:similar-accessories"),
			name: "Similar Accessories",
			strategy: "similar",
			sourceProductId: productIds["silk-twill-wrap"],
			targetProductIds: [
				productIds["cashmere-fringe-scarf"],
				productIds["grand-tour-passport-folio"],
			],
			weight: 1.0,
		},
		{
			id: uuid("rec-rule:frequently-bought-together"),
			name: "Frequently Bought Together",
			strategy: "frequently_bought_together",
			sourceProductId: productIds["observatory-chronograph"],
			targetProductIds: [
				productIds["grand-tour-passport-folio"],
				productIds["regent-penny-loafer"],
			],
			weight: 0.85,
		},
	];
	for (const rule of rules) {
		await insertModuleData(
			client,
			"recommendations",
			"recommendationRule",
			rule.id,
			{ ...rule, isActive: true, createdAt: now, updatedAt: now },
		);
	}

	// Co-occurrences (products viewed/bought together)
	const pairs = [
		[
			productIds["observatory-chronograph"],
			productIds["grand-tour-passport-folio"],
			12,
		],
		[productIds["silk-twill-wrap"], productIds["cashmere-fringe-scarf"], 9],
		[
			productIds["regent-penny-loafer"],
			productIds["grand-tour-passport-folio"],
			7,
		],
	] as const;
	for (const [p1, p2, count] of pairs) {
		const coId = uuid(`co-occurrence:${p1}:${p2}`);
		await insertModuleData(client, "recommendations", "coOccurrence", coId, {
			id: coId,
			productId1: p1,
			productId2: p2,
			count,
			updatedAt: now,
		});
	}

	// Product interactions
	const interactions = [
		{
			key: "eleanor-view-loafer",
			customerKey: "eleanor-vale",
			productKey: "regent-penny-loafer",
			type: "view",
		},
		{
			key: "marcus-view-chronograph",
			customerKey: "marcus-chen",
			productKey: "observatory-chronograph",
			type: "view",
		},
		{
			key: "marcus-purchase-folio",
			customerKey: "marcus-chen",
			productKey: "grand-tour-passport-folio",
			type: "purchase",
		},
	];
	for (const interaction of interactions) {
		const interactionId = uuid(`rec-interaction:${interaction.key}`);
		const product = productByKey[interaction.productKey];
		await insertModuleData(
			client,
			"recommendations",
			"productInteraction",
			interactionId,
			{
				id: interactionId,
				productId:
					productIds[interaction.productKey as keyof typeof productIds],
				customerId:
					customerIds[interaction.customerKey as keyof typeof customerIds],
				type: interaction.type,
				productName: product?.name ?? interaction.productKey,
				productSlug: product?.slug ?? interaction.productKey,
				productPrice: product?.price,
				createdAt: now,
			},
		);
	}
}

async function seedForms(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const formId = uuid("form:contact-us");
	await insertModuleData(client, "forms", "form", formId, {
		id: formId,
		name: "Contact Us",
		slug: "contact",
		description:
			"Reach out to our client relations team for personalized assistance.",
		fields: [
			{
				name: "name",
				label: "Full Name",
				type: "text",
				required: true,
				position: 0,
			},
			{
				name: "email",
				label: "Email Address",
				type: "email",
				required: true,
				position: 1,
			},
			{
				name: "subject",
				label: "Subject",
				type: "select",
				required: true,
				position: 2,
				options: [
					"Product inquiry",
					"Order support",
					"Styling advice",
					"Partnership",
				],
			},
			{
				name: "message",
				label: "Message",
				type: "textarea",
				required: true,
				position: 3,
				placeholder: "How can we assist you?",
			},
		],
		submitLabel: "Send Message",
		successMessage:
			"Thank you for reaching out. A member of our client relations team will respond within 24 hours.",
		notifyEmail: "clientrelations@example.com",
		honeypotEnabled: true,
		maxSubmissions: 0,
		submissionCount: 1,
		isActive: true,
		createdAt: now,
		updatedAt: now,
	});

	const submissionId = uuid("form-submission:contact-us:sofia");
	await insertModuleData(client, "forms", "formSubmission", submissionId, {
		id: submissionId,
		formId,
		values: {
			name: "Sofia Alvarez",
			email: "sofia@example.com",
			subject: "Styling advice",
			message:
				"I'm looking for a gift for my partner who appreciates fine accessories. Could you suggest pieces that complement the Observatory Chronograph?",
		},
		ipAddress: "203.0.113.42",
		status: "new",
		createdAt: now,
		updatedAt: now,
	});
}

async function seedTipping(client: pg.PoolClient) {
	const now = new Date().toISOString();
	const orderId = uuid("order:demo");

	const settingsId = uuid("tip-settings:default");
	await insertModuleData(client, "tipping", "tipSettings", settingsId, {
		id: settingsId,
		presetPercents: [15, 18, 20, 25],
		allowCustom: true,
		maxPercent: 50,
		defaultPercent: 18,
		isEnabled: true,
		createdAt: now,
		updatedAt: now,
	});

	const tipId = uuid("tip:demo-order");
	await insertModuleData(client, "tipping", "tip", tipId, {
		id: tipId,
		orderId,
		amount: 1611,
		type: "percent",
		percent: 18,
		recipientType: "staff",
		status: "paid",
		createdAt: now,
		updatedAt: now,
	});
}

async function seedOrderNotes(client: pg.PoolClient) {
	const now = new Date().toISOString();
	const orderId = uuid("order:demo");
	const adminUserId = uuid("admin-user");

	const noteId = uuid("order-note:demo-order:fulfillment");
	await insertModuleData(client, "order-notes", "orderNote", noteId, {
		id: noteId,
		orderId,
		authorId: adminUserId,
		authorName: "Atelier Team",
		content:
			"Customer requested gift wrapping with a handwritten card. Items have been carefully wrapped in signature tissue. Passport folio monogrammed with initials E.V.",
		isInternal: true,
		isPinned: true,
		createdAt: now,
		updatedAt: now,
	});

	const customerNoteId = uuid("order-note:demo-order:customer");
	await insertModuleData(client, "order-notes", "orderNote", customerNoteId, {
		id: customerNoteId,
		orderId,
		authorId: customerIds["eleanor-vale"],
		authorName: "Eleanor Vale",
		content:
			"Please monogram the folio with 'E.V.' and include a gift note for my anniversary.",
		isInternal: false,
		isPinned: false,
		createdAt: now,
		updatedAt: now,
	});
}

async function seedFulfillment(client: pg.PoolClient) {
	const now = new Date().toISOString();
	const orderId = uuid("order:demo");
	const fulfillmentId = uuid("fulfillment:demo-order");

	await insertModuleData(client, "fulfillment", "fulfillment", fulfillmentId, {
		id: fulfillmentId,
		orderId,
		status: "delivered",
		items: [
			{
				productId: productIds["grand-tour-passport-folio"],
				productName: "Grand Tour Passport Folio",
				quantity: 1,
			},
			{
				productId: productIds["silk-twill-wrap"],
				productName: "Silk Twill Wrap",
				quantity: 1,
			},
		],
		carrier: "UPS",
		trackingNumber: "1Z999AA10123456784",
		trackingUrl: "https://www.ups.com/track?tracknum=1Z999AA10123456784",
		shippedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
		deliveredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
		createdAt: now,
		updatedAt: now,
	});
}

async function seedAuditLog(client: pg.PoolClient) {
	const adminUserId = uuid("admin-user");
	const now = new Date().toISOString();

	const entries = [
		{
			id: uuid("audit:order-created"),
			action: "order.created",
			resource: "order",
			resourceId: uuid("order:demo"),
			actorId: adminUserId,
			actorType: "admin",
			description: "Order ORD-2026-0001 created for Eleanor Vale",
			changes: { status: { from: null, to: "pending" } },
		},
		{
			id: uuid("audit:product-updated:observatory"),
			action: "product.updated",
			resource: "product",
			resourceId: productIds["observatory-chronograph"],
			actorId: adminUserId,
			actorType: "admin",
			description: "Updated stock level for Observatory Chronograph",
			changes: { inventory: { from: 12, to: 11 } },
		},
		{
			id: uuid("audit:customer-updated:eleanor"),
			action: "customer.updated",
			resource: "customer",
			resourceId: customerIds["eleanor-vale"],
			actorId: adminUserId,
			actorType: "admin",
			description: "Updated loyalty tier for Eleanor Vale to Gold",
			changes: { loyaltyTier: { from: "silver", to: "gold" } },
		},
	];

	for (const entry of entries) {
		await insertModuleData(client, "audit-log", "auditEntry", entry.id, {
			...entry,
			ipAddress: "10.0.0.1",
			userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
			createdAt: now,
		});
	}
}

async function seedVendors(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const vendorId = uuid("vendor:maison-tessier");
	await insertModuleData(client, "vendors", "vendor", vendorId, {
		id: vendorId,
		name: "Maison Tessier",
		slug: "maison-tessier",
		email: "wholesale@maisontessier.com",
		phone: "+33 1 42 86 00 00",
		commissionRate: 12.5,
		status: "active",
		addressLine1: "14 Rue du Faubourg Saint-Honoré",
		city: "Paris",
		postalCode: "75008",
		country: "FR",
		bio: "Family-owned Parisian atelier producing fine leather goods since 1952.",
		createdAt: now,
		updatedAt: now,
	});

	const products = [
		{ productKey: "grand-tour-passport-folio", sku: "MT-GTF-001" },
		{ productKey: "regent-penny-loafer", sku: "MT-RPL-002" },
	];
	for (const p of products) {
		const vpId = uuid(`vendor-product:${vendorId}:${p.productKey}`);
		await insertModuleData(client, "vendors", "vendorProduct", vpId, {
			id: vpId,
			vendorId,
			productId: productIds[p.productKey as keyof typeof productIds],
			vendorSku: p.sku,
			status: "active",
			createdAt: now,
			updatedAt: now,
		});
	}

	const payoutId = uuid("vendor-payout:maison-tessier:2026-q1");
	await insertModuleData(client, "vendors", "vendorPayout", payoutId, {
		id: payoutId,
		vendorId,
		amount: 16688,
		currency: "USD",
		status: "paid",
		periodStart: "2026-01-01T00:00:00.000Z",
		periodEnd: "2026-03-31T23:59:59.999Z",
		paidAt: now,
		createdAt: now,
		updatedAt: now,
	});
}

async function seedTickets(client: pg.PoolClient) {
	const now = new Date().toISOString();
	const adminUserId = uuid("admin-user");

	const categoryId = uuid("ticket-category:order-support");
	await insertModuleData(client, "tickets", "ticketCategory", categoryId, {
		id: categoryId,
		name: "Order Support",
		slug: "order-support",
		position: 0,
		isActive: true,
		createdAt: now,
		updatedAt: now,
	});

	const stylingCategoryId = uuid("ticket-category:styling-advice");
	await insertModuleData(
		client,
		"tickets",
		"ticketCategory",
		stylingCategoryId,
		{
			id: stylingCategoryId,
			name: "Styling Advice",
			slug: "styling-advice",
			position: 1,
			isActive: true,
			createdAt: now,
			updatedAt: now,
		},
	);

	const ticketId = uuid("ticket:0001");
	await insertModuleData(client, "tickets", "ticket", ticketId, {
		id: ticketId,
		number: 1,
		categoryId,
		subject: "Monogram status for order ORD-2026-0001",
		description:
			"I placed an order and requested a monogram on the Grand Tour Passport Folio. Could you confirm the initials 'E.V.' have been noted?",
		status: "resolved",
		priority: "high",
		customerEmail: "eleanor@example.com",
		customerId: customerIds["eleanor-vale"],
		assigneeId: adminUserId,
		createdAt: now,
		updatedAt: now,
		resolvedAt: now,
	});

	const messages = [
		{
			id: uuid("ticket-message:0001:customer"),
			body: "I placed an order and requested a monogram on the Grand Tour Passport Folio. Could you confirm the initials 'E.V.' have been noted?",
			authorType: "customer",
			authorName: "Eleanor Vale",
			isInternal: false,
		},
		{
			id: uuid("ticket-message:0001:staff"),
			body: "Good afternoon, Ms. Vale. I can confirm that your monogram request for 'E.V.' has been noted and will be completed before dispatch. Your order is on schedule for delivery within 3–5 business days.",
			authorType: "staff",
			authorName: "Atelier Client Relations",
			isInternal: false,
		},
	];
	for (const msg of messages) {
		await insertModuleData(client, "tickets", "ticketMessage", msg.id, {
			...msg,
			ticketId,
			createdAt: now,
		});
	}
}

async function seedProductQa(client: pg.PoolClient) {
	const now = new Date().toISOString();
	const adminUserId = uuid("admin-user");

	const questions = [
		{
			id: uuid("qa-question:chronograph-movement"),
			productId: productIds["observatory-chronograph"],
			customerKey: "marcus-chen",
			authorName: "Marcus Chen",
			body: "What type of movement does the Observatory Chronograph use, and is it COSC certified?",
			status: "published",
			upvoteCount: 14,
			answerCount: 1,
		},
		{
			id: uuid("qa-question:loafer-sizing"),
			productId: productIds["regent-penny-loafer"],
			customerKey: "sofia-alvarez",
			authorName: "Sofia Alvarez",
			body: "Do these run true to size, or should I size up? I usually wear a 37 in European sizing.",
			status: "published",
			upvoteCount: 8,
			answerCount: 1,
		},
	];

	for (const q of questions) {
		const { customerKey, ...qData } = q;
		await insertModuleData(client, "product-qa", "question", q.id, {
			...qData,
			customerId: customerIds[customerKey as keyof typeof customerIds],
			createdAt: now,
			updatedAt: now,
		});
	}

	const answers = [
		{
			id: uuid("qa-answer:chronograph-movement"),
			questionId: uuid("qa-question:chronograph-movement"),
			productId: productIds["observatory-chronograph"],
			authorName: "Atelier Team",
			body: "The Observatory Chronograph houses our in-house calibre AG-7750, a self-winding mechanical movement with a 68-hour power reserve. It carries full COSC chronometer certification, confirmed at ±2 seconds per day across five positions.",
			isOfficial: true,
			upvoteCount: 12,
			status: "published",
		},
		{
			id: uuid("qa-answer:loafer-sizing"),
			questionId: uuid("qa-question:loafer-sizing"),
			productId: productIds["regent-penny-loafer"],
			authorName: "Atelier Team",
			body: "The Regent Penny Loafer is designed on our classic last and runs true to European sizing. A 37 should fit perfectly. If you prefer a slightly roomier fit or plan to wear with thicker hosiery, we'd suggest 37.5. Our client relations team is happy to discuss fit via appointment.",
			isOfficial: true,
			upvoteCount: 6,
			status: "published",
		},
	];

	for (const answer of answers) {
		await insertModuleData(client, "product-qa", "answer", answer.id, {
			...answer,
			authorId: adminUserId,
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedComparisons(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const items = [
		{
			key: "compare-chronograph",
			sessionId: uuid("session:marcus-chen:compare"),
			customerKey: "marcus-chen",
			productKey: "observatory-chronograph",
			productPrice: 345000,
			attributes: {
				material: "Titanium case, sapphire crystal",
				movement: "In-house AG-7750",
				waterResistance: "100m",
				warranty: "5 years",
			},
		},
		{
			key: "compare-loafer",
			sessionId: uuid("session:marcus-chen:compare"),
			customerKey: "marcus-chen",
			productKey: "regent-penny-loafer",
			productPrice: 89500,
			attributes: {
				material: "Full-grain Cordovan leather",
				sole: "Hand-stitched leather",
				origin: "England",
				warranty: "1 year",
			},
		},
	];

	for (const item of items) {
		const product = productByKey[item.productKey];
		const itemId = uuid(`comparison:${item.key}`);
		await insertModuleData(client, "comparisons", "comparisonItem", itemId, {
			id: itemId,
			customerId: customerIds[item.customerKey as keyof typeof customerIds],
			sessionId: item.sessionId,
			productId: productIds[item.productKey as keyof typeof productIds],
			productName: product?.name ?? item.productKey,
			productSlug: product?.slug ?? item.productKey,
			productImage: product?.imagePaths?.[0] ?? "",
			productPrice: item.productPrice,
			attributes: item.attributes,
			createdAt: now,
		});
	}
}

async function seedPriceLists(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const priceListId = uuid("price-list:holiday-2026");
	await insertModuleData(client, "price-lists", "priceList", priceListId, {
		id: priceListId,
		name: "Holiday Collection 2026",
		slug: "holiday-2026",
		currency: "USD",
		priority: 10,
		status: "scheduled",
		startsAt: "2026-12-01T00:00:00.000Z",
		endsAt: "2026-12-31T23:59:59.999Z",
		createdAt: now,
		updatedAt: now,
	});

	const vipListId = uuid("price-list:vip-members");
	await insertModuleData(client, "price-lists", "priceList", vipListId, {
		id: vipListId,
		name: "VIP Member Pricing",
		slug: "vip-members",
		currency: "USD",
		priority: 20,
		status: "active",
		startsAt: null,
		endsAt: null,
		createdAt: now,
		updatedAt: now,
	});

	const entries = [
		{
			listId: priceListId,
			productKey: "observatory-chronograph",
			price: 310500,
			compareAtPrice: 345000,
		},
		{
			listId: priceListId,
			productKey: "regent-penny-loafer",
			price: 80550,
			compareAtPrice: 89500,
		},
		{
			listId: vipListId,
			productKey: "observatory-chronograph",
			price: 293250,
			compareAtPrice: 345000,
		},
		{
			listId: vipListId,
			productKey: "silk-twill-wrap",
			price: 32850,
			compareAtPrice: 36500,
		},
	];
	for (const entry of entries) {
		const entryId = uuid(`price-entry:${entry.listId}:${entry.productKey}`);
		await insertModuleData(client, "price-lists", "priceEntry", entryId, {
			id: entryId,
			priceListId: entry.listId,
			productId: productIds[entry.productKey as keyof typeof productIds],
			price: entry.price,
			compareAtPrice: entry.compareAtPrice,
			minQuantity: 1,
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedProductFeeds(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const feedId = uuid("feed:google-shopping");
	await insertModuleData(client, "product-feeds", "feed", feedId, {
		id: feedId,
		name: "Google Shopping — US",
		slug: "google-shopping-us",
		channel: "google",
		format: "xml",
		status: "active",
		country: "US",
		currency: "USD",
		fieldMappings: {
			id: "sku",
			title: "name",
			description: "description",
			price: "price",
			link: "url",
			imageLink: "images[0]",
		},
		filters: { status: "active" },
		itemCount: 5,
		lastSyncAt: now,
		createdAt: now,
		updatedAt: now,
	});

	const feedProducts = [
		{ productKey: "observatory-chronograph" },
		{ productKey: "regent-penny-loafer" },
		{ productKey: "grand-tour-passport-folio" },
		{ productKey: "silk-twill-wrap" },
		{ productKey: "cashmere-fringe-scarf" },
	];
	for (const fp of feedProducts) {
		const product = productByKey[fp.productKey];
		const itemId = uuid(`feed-item:google-shopping:${fp.productKey}`);
		await insertModuleData(client, "product-feeds", "feedItem", itemId, {
			id: itemId,
			feedId,
			productId: productIds[fp.productKey as keyof typeof productIds],
			mappedData: {
				id: product?.sku ?? fp.productKey,
				title: product?.name ?? fp.productKey,
				price: `${((product?.price ?? 0) / 100).toFixed(2)} USD`,
				availability: "in_stock",
				condition: "new",
			},
			status: "synced",
			issues: [],
			lastSyncAt: now,
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedImportExport(client: pg.PoolClient) {
	const now = new Date().toISOString();
	const adminUserId = uuid("admin-user");

	const importJobId = uuid("import-job:products-2026-05");
	await insertModuleData(client, "import-export", "importJob", importJobId, {
		id: importJobId,
		type: "products",
		status: "completed",
		filename: "atelier-catalog-2026-05.csv",
		totalRows: 5,
		processedRows: 5,
		failedRows: 0,
		errors: [],
		options: { updateExisting: true, skipImages: false },
		userId: adminUserId,
		completedAt: now,
		createdAt: now,
		updatedAt: now,
	});

	const exportJobId = uuid("export-job:orders-2026-q1");
	await insertModuleData(client, "import-export", "exportJob", exportJobId, {
		id: exportJobId,
		type: "orders",
		status: "completed",
		format: "csv",
		filters: { dateFrom: "2026-01-01", dateTo: "2026-03-31" },
		totalRows: 1,
		userId: adminUserId,
		completedAt: now,
		createdAt: now,
		updatedAt: now,
	});
}

async function seedSavedAddresses(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const addresses = [
		{
			id: uuid("saved-address:eleanor-vale:home"),
			customerKey: "eleanor-vale",
			label: "Home",
			firstName: "Eleanor",
			lastName: "Vale",
			line1: "47 Kensington Park Gardens",
			line2: "Flat 3",
			city: "London",
			state: "England",
			postalCode: "W11 2PN",
			country: "GB",
			phone: "+44 20 7243 0000",
			isDefault: true,
			isDefaultBilling: true,
		},
		{
			id: uuid("saved-address:eleanor-vale:office"),
			customerKey: "eleanor-vale",
			label: "Office",
			firstName: "Eleanor",
			lastName: "Vale",
			line1: "30 St Mary Axe",
			city: "London",
			state: "England",
			postalCode: "EC3A 8BF",
			country: "GB",
			phone: "+44 20 7000 1234",
			isDefault: false,
			isDefaultBilling: false,
		},
	];

	for (const addr of addresses) {
		const { customerKey, ...addrData } = addr;
		await insertModuleData(client, "saved-addresses", "address", addr.id, {
			...addrData,
			customerId: customerIds[customerKey as keyof typeof customerIds],
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedMedia(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const folderId = uuid("media-folder:products");
	await insertModuleData(client, "media", "folder", folderId, {
		id: folderId,
		name: "Products",
		parentId: null,
		createdAt: now,
		updatedAt: now,
	});

	const assets = [
		{
			key: "observatory-chronograph",
			name: "Observatory Chronograph — Hero",
			productKey: "observatory-chronograph",
			mimeType: "image/jpeg",
			width: 1200,
			height: 900,
			size: 312400,
		},
		{
			key: "regent-penny-loafer",
			name: "Regent Penny Loafer — Hero",
			productKey: "regent-penny-loafer",
			mimeType: "image/jpeg",
			width: 1200,
			height: 900,
			size: 287600,
		},
		{
			key: "grand-tour-passport-folio",
			name: "Grand Tour Passport Folio — Hero",
			productKey: "grand-tour-passport-folio",
			mimeType: "image/jpeg",
			width: 1200,
			height: 900,
			size: 198300,
		},
		{
			key: "silk-twill-wrap",
			name: "Silk Twill Wrap — Hero",
			productKey: "silk-twill-wrap",
			mimeType: "image/jpeg",
			width: 1200,
			height: 900,
			size: 241800,
		},
		{
			key: "cashmere-fringe-scarf",
			name: "Cashmere Fringe Scarf — Hero",
			productKey: "cashmere-fringe-scarf",
			mimeType: "image/jpeg",
			width: 1200,
			height: 900,
			size: 259100,
		},
	];

	for (const asset of assets) {
		const assetId = uuid(`media-asset:${asset.key}`);
		const product = productByKey[asset.productKey];
		await insertModuleData(client, "media", "asset", assetId, {
			id: assetId,
			name: asset.name,
			altText: product?.name ?? asset.name,
			url: product?.imagePaths?.[0] ?? "",
			mimeType: asset.mimeType,
			size: asset.size,
			width: asset.width,
			height: asset.height,
			folder: folderId,
			tags: ["product", "hero"],
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedAutomations(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const automations = [
		{
			id: uuid("automation:welcome-email"),
			name: "Welcome Email",
			status: "active",
			triggerEvent: "customer.created",
			conditions: [],
			actions: [{ type: "send_email", template: "welcome", delay: 0 }],
			priority: 10,
			runCount: 3,
		},
		{
			id: uuid("automation:order-confirmation"),
			name: "Order Confirmation Email",
			status: "active",
			triggerEvent: "order.created",
			conditions: [],
			actions: [
				{ type: "send_email", template: "order-confirmed", delay: 0 },
				{ type: "send_notification", channel: "push", delay: 0 },
			],
			priority: 10,
			runCount: 1,
		},
		{
			id: uuid("automation:low-stock-alert"),
			name: "Low Stock Alert",
			status: "active",
			triggerEvent: "inventory.low_stock",
			conditions: [{ field: "quantity", operator: "lte", value: 5 }],
			actions: [
				{
					type: "send_email",
					template: "low-stock-alert",
					to: "inventory@example.com",
					delay: 0,
				},
			],
			priority: 20,
			runCount: 2,
		},
	];

	for (const automation of automations) {
		await insertModuleData(client, "automations", "automation", automation.id, {
			...automation,
			lastRunAt: now,
			createdAt: now,
			updatedAt: now,
		});
	}

	const executionId = uuid("automation-exec:order-confirmation:demo-order");
	await insertModuleData(
		client,
		"automations",
		"automationExecution",
		executionId,
		{
			id: executionId,
			automationId: uuid("automation:order-confirmation"),
			triggerEvent: "order.created",
			triggerPayload: {
				orderId: uuid("order:demo"),
				customerId: customerIds["eleanor-vale"],
			},
			status: "success",
			results: [
				{ action: "send_email", status: "sent", messageId: "re_abc123" },
				{ action: "send_notification", status: "sent" },
			],
			createdAt: now,
			updatedAt: now,
		},
	);
}

async function seedPayments(client: pg.PoolClient) {
	const now = new Date().toISOString();
	const orderId = uuid("order:demo");

	const paymentMethodId = uuid("payment-method:eleanor-vale:visa");
	await insertModuleData(client, "payments", "paymentMethod", paymentMethodId, {
		id: paymentMethodId,
		customerId: customerIds["eleanor-vale"],
		providerMethodId: "pm_1234abcd",
		type: "card",
		last4: "4242",
		brand: "Visa",
		expiryMonth: 12,
		expiryYear: 2027,
		isDefault: true,
		createdAt: now,
		updatedAt: now,
	});

	const paymentIntentId = uuid("payment-intent:demo-order");
	await insertModuleData(client, "payments", "paymentIntent", paymentIntentId, {
		id: paymentIntentId,
		providerIntentId: "pi_3OxLm2Kg1234abcd",
		customerId: customerIds["eleanor-vale"],
		orderId,
		amount: 97197,
		currency: "USD",
		status: "succeeded",
		paymentMethodId,
		capturedAt: now,
		createdAt: now,
		updatedAt: now,
	});
}

async function seedAnalytics(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const events = [
		{
			key: "pageview-home",
			type: "page_view",
			sessionId: uuid("session:anon:1"),
			productId: null,
			orderId: null,
			value: null,
			data: { path: "/", referrer: "https://google.com" },
		},
		{
			key: "product-view-chronograph",
			type: "product_view",
			sessionId: uuid("session:marcus:1"),
			productId: productIds["observatory-chronograph"],
			orderId: null,
			value: null,
			data: { path: "/products/observatory-chronograph" },
		},
		{
			key: "add-to-cart-loafer",
			type: "add_to_cart",
			sessionId: uuid("session:eleanor:1"),
			productId: productIds["regent-penny-loafer"],
			orderId: null,
			value: 89500,
			data: { quantity: 1 },
		},
		{
			key: "purchase-demo",
			type: "purchase",
			sessionId: uuid("session:eleanor:1"),
			productId: null,
			orderId: uuid("order:demo"),
			value: 97197,
			data: { items: 2, currency: "USD" },
		},
	];

	for (const event of events) {
		const eventId = uuid(`analytics-event:${event.key}`);
		await insertModuleData(client, "analytics", "event", eventId, {
			id: eventId,
			type: event.type,
			sessionId: event.sessionId,
			productId: event.productId,
			orderId: event.orderId,
			value: event.value,
			data: event.data,
			createdAt: now,
		});
	}
}

async function seedSocialSharing(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const settingsId = uuid("share-settings:default");
	await insertModuleData(
		client,
		"social-sharing",
		"shareSettings",
		settingsId,
		{
			id: settingsId,
			enabledNetworks: ["instagram", "pinterest", "x", "whatsapp", "email"],
			defaultMessage: "Discover this at Atelier — ",
			hashtags: ["AtelierStyle", "LuxuryFashion", "CraftsmanshipMatters"],
			customTemplates: {
				instagram:
					"Just discovered this at Atelier 🖤 {{productName}} #AtelierStyle",
			},
			createdAt: now,
			updatedAt: now,
		},
	);

	const shareEvents = [
		{
			key: "eleanor-pinterest-loafer",
			network: "pinterest",
			targetType: "product",
			productKey: "regent-penny-loafer",
		},
		{
			key: "sofia-whatsapp-scarf",
			network: "whatsapp",
			targetType: "product",
			productKey: "cashmere-fringe-scarf",
		},
	];

	for (const event of shareEvents) {
		const product = productByKey[event.productKey];
		const eventId = uuid(`share-event:${event.key}`);
		await insertModuleData(client, "social-sharing", "shareEvent", eventId, {
			id: eventId,
			targetType: event.targetType,
			targetId: productIds[event.productKey as keyof typeof productIds],
			network: event.network,
			url: `https://example.com/products/${product?.slug ?? event.productKey}`,
			referrer: null,
			sessionId: uuid(`session:share:${event.key}`),
			createdAt: now,
		});
	}
}

async function seedQrCodes(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const codes = [
		{
			id: uuid("qr:homepage"),
			label: "Store Homepage",
			targetUrl: "https://example.com/",
			targetType: "url",
			format: "png",
			size: 300,
			errorCorrection: "M",
			scanCount: 47,
			isActive: true,
		},
		{
			id: uuid("qr:chronograph-pdp"),
			label: "Observatory Chronograph — In-store Display",
			targetUrl: "https://example.com/products/observatory-chronograph",
			targetType: "product",
			format: "svg",
			size: 400,
			errorCorrection: "H",
			scanCount: 23,
			isActive: true,
		},
	];

	for (const code of codes) {
		await insertModuleData(client, "qr-code", "qrCode", code.id, {
			...code,
			createdAt: now,
			updatedAt: now,
		});
	}

	const scans = [
		{
			id: uuid("qr-scan:homepage:1"),
			qrCodeId: uuid("qr:homepage"),
			userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
		},
		{
			id: uuid("qr-scan:chronograph:1"),
			qrCodeId: uuid("qr:chronograph-pdp"),
			userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X)",
		},
	];

	for (const scan of scans) {
		await insertModuleData(client, "qr-code", "qrScan", scan.id, {
			...scan,
			scannedAt: now,
			ipAddress: "203.0.113.50",
			referrer: null,
			createdAt: now,
		});
	}
}

async function seedKiosk(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const stationId = uuid("kiosk-station:flagship");
	await insertModuleData(client, "kiosk", "kioskStation", stationId, {
		id: stationId,
		name: "Flagship Store — Main Floor",
		location: "47 Kensington Park Gardens, London",
		isOnline: true,
		isActive: true,
		lastHeartbeat: now,
		settings: {
			timeout: 120,
			theme: "light",
			allowGuestCheckout: true,
			showRecommendations: true,
		},
		createdAt: now,
		updatedAt: now,
	});

	const sessionId = uuid("kiosk-session:flagship:recent");
	await insertModuleData(client, "kiosk", "kioskSession", sessionId, {
		id: sessionId,
		stationId,
		status: "completed",
		items: [
			{
				productId: productIds["regent-penny-loafer"],
				productName: "Regent Penny Loafer",
				quantity: 1,
				price: 89500,
			},
		],
		subtotal: 89500,
		tax: 7697,
		tip: 0,
		total: 97197,
		paymentStatus: "paid",
		startedAt: now,
		completedAt: now,
		createdAt: now,
		updatedAt: now,
	});
}

async function seedAmazon(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const listings = [
		{
			productKey: "grand-tour-passport-folio",
			asin: "B0C1234GTF",
			sku: "GTF-001",
			price: 44500,
			quantity: 12,
		},
		{
			productKey: "regent-penny-loafer",
			asin: "B0C5678RPL",
			sku: "RPL-37-BLACK",
			price: 89500,
			quantity: 8,
		},
	];
	for (const listing of listings) {
		const id = uuid(`amazon-listing:${listing.productKey}`);
		await insertModuleData(client, "amazon", "listing", id, {
			id,
			localProductId: productIds[listing.productKey as keyof typeof productIds],
			asin: listing.asin,
			sku: listing.sku,
			title: productByKey[listing.productKey]?.name ?? listing.productKey,
			status: "active",
			fulfillmentChannel: "FBM",
			price: listing.price,
			quantity: listing.quantity,
			condition: "new",
			buyBoxOwned: listing.productKey === "grand-tour-passport-folio",
			lastSyncedAt: now,
			metadata: {},
			createdAt: now,
			updatedAt: now,
		});
	}

	const orderId = uuid("amazon-order:112-3456789-1234567");
	await insertModuleData(client, "amazon", "amazonOrder", orderId, {
		id: orderId,
		amazonOrderId: "112-3456789-1234567",
		status: "shipped",
		fulfillmentChannel: "FBM",
		items: [{ sku: "GTF-001", quantity: 1, price: 44500 }],
		orderTotal: 44500,
		shippingTotal: 0,
		marketplaceFee: 6675,
		netProceeds: 37825,
		buyerName: "A. Richardson",
		shippingAddress: {
			city: "New York",
			state: "NY",
			postalCode: "10001",
			country: "US",
		},
		shipDate: now,
		trackingNumber: "1Z999AA10123400001",
		carrier: "UPS",
		createdAt: now,
		updatedAt: now,
	});

	const syncId = uuid("amazon-inventory-sync:2026-05");
	await insertModuleData(client, "amazon", "inventorySync", syncId, {
		id: syncId,
		status: "completed",
		itemCount: 2,
		syncedAt: now,
		createdAt: now,
		updatedAt: now,
	});
}

async function seedEbay(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const listings = [
		{ productKey: "silk-twill-wrap", externalId: "123456789012", price: 36500 },
		{
			productKey: "cashmere-fringe-scarf",
			externalId: "234567890123",
			price: 49500,
		},
	];
	for (const listing of listings) {
		const id = uuid(`ebay-listing:${listing.productKey}`);
		await insertModuleData(client, "ebay", "listing", id, {
			id,
			localProductId: productIds[listing.productKey as keyof typeof productIds],
			externalListingId: listing.externalId,
			title: productByKey[listing.productKey]?.name ?? listing.productKey,
			status: "active",
			price: listing.price,
			quantity: 5,
			condition: "new",
			listingType: "FixedPriceItem",
			lastSyncedAt: now,
			createdAt: now,
			updatedAt: now,
		});
	}

	const ebayOrderId = uuid("ebay-order:12-34567-89012");
	await insertModuleData(client, "ebay", "ebayOrder", ebayOrderId, {
		id: ebayOrderId,
		externalOrderId: "12-34567-89012",
		status: "shipped",
		items: [{ listingId: "123456789012", quantity: 1, price: 36500 }],
		subtotal: 36500,
		shippingTotal: 0,
		ebayFee: 3650,
		netProceeds: 32850,
		buyerUsername: "style_collector_99",
		shippingAddress: {
			city: "Chicago",
			state: "IL",
			postalCode: "60601",
			country: "US",
		},
		createdAt: now,
		updatedAt: now,
	});
}

async function seedEtsy(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const listings = [
		{
			productKey: "cashmere-fringe-scarf",
			externalId: "1234567890",
			price: 49500,
		},
		{ productKey: "silk-twill-wrap", externalId: "2345678901", price: 36500 },
	];
	for (const listing of listings) {
		const id = uuid(`etsy-listing:${listing.productKey}`);
		await insertModuleData(client, "etsy", "listing", id, {
			id,
			localProductId: productIds[listing.productKey as keyof typeof productIds],
			externalListingId: listing.externalId,
			title: productByKey[listing.productKey]?.name ?? listing.productKey,
			status: "active",
			price: listing.price,
			quantity: 4,
			tags: ["luxury", "handcrafted", "gift"],
			lastSyncedAt: now,
			createdAt: now,
			updatedAt: now,
		});
	}

	const etsyOrderId = uuid("etsy-order:3456789012");
	await insertModuleData(client, "etsy", "etsyOrder", etsyOrderId, {
		id: etsyOrderId,
		externalOrderId: "3456789012",
		status: "completed",
		items: [{ listingId: "1234567890", quantity: 1, price: 49500 }],
		subtotal: 49500,
		shippingTotal: 0,
		etsyFee: 2970,
		netProceeds: 46530,
		buyerName: "H. Dupont",
		shippingAddress: { city: "Paris", country: "FR" },
		createdAt: now,
		updatedAt: now,
	});

	const etsyReviewId = uuid("etsy-review:3456789012");
	await insertModuleData(client, "etsy", "etsyReview", etsyReviewId, {
		id: etsyReviewId,
		orderId: etsyOrderId,
		rating: 5,
		comment:
			"Exquisite quality — the cashmere is incredibly soft. Beautifully packaged, arrived promptly.",
		buyerName: "H. Dupont",
		createdAt: now,
	});
}

async function seedTiktokShop(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const listings = [
		{
			productKey: "regent-penny-loafer",
			externalId: "tts_listing_001",
			price: 89500,
		},
		{
			productKey: "silk-twill-wrap",
			externalId: "tts_listing_002",
			price: 36500,
		},
	];
	for (const listing of listings) {
		const id = uuid(`tiktok-listing:${listing.productKey}`);
		await insertModuleData(client, "tiktok-shop", "listing", id, {
			id,
			localProductId: productIds[listing.productKey as keyof typeof productIds],
			externalProductId: listing.externalId,
			title: productByKey[listing.productKey]?.name ?? listing.productKey,
			status: "active",
			price: listing.price,
			quantity: 6,
			lastSyncedAt: now,
			createdAt: now,
			updatedAt: now,
		});
	}

	const channelOrderId = uuid("tiktok-order:TTS20260513001");
	await insertModuleData(
		client,
		"tiktok-shop",
		"channelOrder",
		channelOrderId,
		{
			id: channelOrderId,
			externalOrderId: "TTS20260513001",
			status: "completed",
			items: [
				{ externalProductId: "tts_listing_002", quantity: 1, price: 36500 },
			],
			subtotal: 36500,
			platformFee: 1825,
			netProceeds: 34675,
			buyerUsername: "luxe_finds_daily",
			shippingAddress: { city: "Los Angeles", state: "CA", country: "US" },
			createdAt: now,
			updatedAt: now,
		},
	);

	const catalogSyncId = uuid("tiktok-catalog-sync:2026-05");
	await insertModuleData(client, "tiktok-shop", "catalogSync", catalogSyncId, {
		id: catalogSyncId,
		status: "completed",
		itemCount: 2,
		syncedAt: now,
		createdAt: now,
		updatedAt: now,
	});
}

async function seedGoogleShopping(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const feedId = uuid("google-shopping-feed:us");
	await insertModuleData(client, "google-shopping", "productFeed", feedId, {
		id: feedId,
		name: "US Merchant Feed",
		merchantId: "123456789",
		country: "US",
		currency: "USD",
		status: "active",
		itemCount: 5,
		lastSubmittedAt: now,
		createdAt: now,
		updatedAt: now,
	});

	const feedItems = [
		{ productKey: "observatory-chronograph" },
		{ productKey: "regent-penny-loafer" },
		{ productKey: "grand-tour-passport-folio" },
		{ productKey: "silk-twill-wrap" },
		{ productKey: "cashmere-fringe-scarf" },
	];
	for (const item of feedItems) {
		const product = productByKey[item.productKey];
		const itemId = uuid(`google-shopping-item:${item.productKey}`);
		await insertModuleData(client, "google-shopping", "channelOrder", itemId, {
			id: itemId,
			feedId,
			localProductId: productIds[item.productKey as keyof typeof productIds],
			offerId: product?.sku ?? item.productKey,
			title: product?.name ?? item.productKey,
			price: product?.price ?? 0,
			currency: "USD",
			availability: "in_stock",
			status: "approved",
			lastSyncedAt: now,
			createdAt: now,
			updatedAt: now,
		});
	}

	const submissionId = uuid("google-shopping-submission:2026-05");
	await insertModuleData(
		client,
		"google-shopping",
		"feedSubmission",
		submissionId,
		{
			id: submissionId,
			feedId,
			status: "success",
			itemsSubmitted: 5,
			itemsSucceeded: 5,
			itemsFailed: 0,
			submittedAt: now,
			createdAt: now,
		},
	);
}

async function seedFacebookShop(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const catalogId = uuid("fb-catalog:atelier");
	await insertModuleData(client, "facebook-shop", "catalogSync", catalogId, {
		id: catalogId,
		catalogId: "fb_catalog_atelier_001",
		status: "active",
		itemCount: 5,
		lastSyncedAt: now,
		createdAt: now,
		updatedAt: now,
	});

	const collectionId = uuid("fb-collection:accessories");
	await insertModuleData(client, "facebook-shop", "collection", collectionId, {
		id: collectionId,
		name: "Accessories",
		externalCollectionId: "fb_col_accessories_001",
		productIds: [
			productIds["silk-twill-wrap"],
			productIds["cashmere-fringe-scarf"],
			productIds["grand-tour-passport-folio"],
		],
		isActive: true,
		createdAt: now,
		updatedAt: now,
	});

	const fbListings = [
		{ productKey: "regent-penny-loafer" },
		{ productKey: "observatory-chronograph" },
	];
	for (const listing of fbListings) {
		const id = uuid(`fb-listing:${listing.productKey}`);
		await insertModuleData(client, "facebook-shop", "listing", id, {
			id,
			localProductId: productIds[listing.productKey as keyof typeof productIds],
			externalProductId: `fb_${listing.productKey.replace(/-/g, "_")}`,
			title: productByKey[listing.productKey]?.name ?? listing.productKey,
			status: "active",
			price: productByKey[listing.productKey]?.price ?? 0,
			lastSyncedAt: now,
			createdAt: now,
			updatedAt: now,
		});
	}

	const channelOrderId = uuid("fb-order:FB20260513001");
	await insertModuleData(
		client,
		"facebook-shop",
		"channelOrder",
		channelOrderId,
		{
			id: channelOrderId,
			externalOrderId: "FB20260513001",
			status: "completed",
			items: [
				{
					externalProductId: "fb_regent_penny_loafer",
					quantity: 1,
					price: 89500,
				},
			],
			subtotal: 89500,
			platformFee: 2685,
			netProceeds: 86815,
			buyerName: "R. Laurent",
			shippingAddress: { city: "Miami", state: "FL", country: "US" },
			createdAt: now,
			updatedAt: now,
		},
	);
}

async function seedInstagramShop(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const catalogSyncId = uuid("ig-catalog-sync:atelier");
	await insertModuleData(
		client,
		"instagram-shop",
		"catalogSync",
		catalogSyncId,
		{
			id: catalogSyncId,
			catalogId: "ig_catalog_atelier_001",
			status: "active",
			itemCount: 5,
			lastSyncedAt: now,
			createdAt: now,
			updatedAt: now,
		},
	);

	const igListings = [
		{ productKey: "silk-twill-wrap" },
		{ productKey: "cashmere-fringe-scarf" },
	];
	for (const listing of igListings) {
		const id = uuid(`ig-listing:${listing.productKey}`);
		await insertModuleData(client, "instagram-shop", "listing", id, {
			id,
			localProductId: productIds[listing.productKey as keyof typeof productIds],
			externalProductId: `ig_${listing.productKey.replace(/-/g, "_")}`,
			title: productByKey[listing.productKey]?.name ?? listing.productKey,
			status: "active",
			price: productByKey[listing.productKey]?.price ?? 0,
			lastSyncedAt: now,
			createdAt: now,
			updatedAt: now,
		});
	}

	const channelOrderId = uuid("ig-order:IG20260513001");
	await insertModuleData(
		client,
		"instagram-shop",
		"channelOrder",
		channelOrderId,
		{
			id: channelOrderId,
			externalOrderId: "IG20260513001",
			status: "completed",
			items: [
				{ externalProductId: "ig_silk_twill_wrap", quantity: 1, price: 36500 },
			],
			subtotal: 36500,
			platformFee: 1825,
			netProceeds: 34675,
			buyerName: "V. Moreau",
			shippingAddress: { city: "Toronto", country: "CA" },
			createdAt: now,
			updatedAt: now,
		},
	);
}

async function seedWalmart(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const items = [
		{
			productKey: "grand-tour-passport-folio",
			externalId: "WM_GTF_001",
			price: 44500,
		},
		{
			productKey: "cashmere-fringe-scarf",
			externalId: "WM_CFS_001",
			price: 49500,
		},
	];
	for (const item of items) {
		const id = uuid(`walmart-item:${item.productKey}`);
		await insertModuleData(client, "walmart", "item", id, {
			id,
			localProductId: productIds[item.productKey as keyof typeof productIds],
			externalItemId: item.externalId,
			title: productByKey[item.productKey]?.name ?? item.productKey,
			status: "published",
			price: item.price,
			quantity: 10,
			condition: "New",
			lastSyncedAt: now,
			createdAt: now,
			updatedAt: now,
		});
	}

	const walmartOrderId = uuid("walmart-order:WM20260513001");
	await insertModuleData(client, "walmart", "walmartOrder", walmartOrderId, {
		id: walmartOrderId,
		externalOrderId: "WM20260513001",
		status: "delivered",
		items: [{ externalItemId: "WM_CFS_001", quantity: 1, price: 49500 }],
		subtotal: 49500,
		shippingTotal: 0,
		walmartFee: 7425,
		netProceeds: 42075,
		customerName: "B. Hoffman",
		shippingAddress: { city: "Dallas", state: "TX", country: "US" },
		createdAt: now,
		updatedAt: now,
	});

	const feedSubmissionId = uuid("walmart-feed-submission:2026-05");
	await insertModuleData(
		client,
		"walmart",
		"feedSubmission",
		feedSubmissionId,
		{
			id: feedSubmissionId,
			feedId: "WM_FEED_20260513",
			status: "processed",
			itemsSubmitted: 2,
			itemsSucceeded: 2,
			itemsFailed: 0,
			submittedAt: now,
			createdAt: now,
		},
	);
}

async function seedXShop(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const xListings = [
		{ productKey: "observatory-chronograph" },
		{ productKey: "regent-penny-loafer" },
	];
	for (const listing of xListings) {
		const id = uuid(`x-listing:${listing.productKey}`);
		await insertModuleData(client, "x-shop", "listing", id, {
			id,
			localProductId: productIds[listing.productKey as keyof typeof productIds],
			externalProductId: `x_${listing.productKey.replace(/-/g, "_")}`,
			title: productByKey[listing.productKey]?.name ?? listing.productKey,
			status: "active",
			price: productByKey[listing.productKey]?.price ?? 0,
			lastSyncedAt: now,
			createdAt: now,
			updatedAt: now,
		});
	}

	const productDropId = uuid("x-shop-drop:atelier-spring-2026");
	await insertModuleData(client, "x-shop", "productDrop", productDropId, {
		id: productDropId,
		name: "Atelier Spring 2026 Drop",
		productIds: [
			productIds["observatory-chronograph"],
			productIds["regent-penny-loafer"],
		],
		dropAt: "2026-03-21T12:00:00.000Z",
		status: "completed",
		tweetId: "1234567890123456789",
		impressions: 48200,
		clicks: 1243,
		createdAt: now,
		updatedAt: now,
	});

	const channelOrderId = uuid("x-shop-order:XS20260513001");
	await insertModuleData(client, "x-shop", "channelOrder", channelOrderId, {
		id: channelOrderId,
		externalOrderId: "XS20260513001",
		status: "completed",
		items: [
			{ externalProductId: "x_regent_penny_loafer", quantity: 1, price: 89500 },
		],
		subtotal: 89500,
		platformFee: 2685,
		netProceeds: 86815,
		buyerHandle: "@style_maven_nyc",
		shippingAddress: { city: "New York", state: "NY", country: "US" },
		createdAt: now,
		updatedAt: now,
	});
}

async function seedPinterestShop(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const catalogSyncId = uuid("pinterest-catalog-sync:atelier");
	await insertModuleData(
		client,
		"pinterest-shop",
		"catalogSync",
		catalogSyncId,
		{
			id: catalogSyncId,
			catalogId: "pin_catalog_atelier_001",
			status: "active",
			itemCount: 5,
			lastSyncedAt: now,
			createdAt: now,
			updatedAt: now,
		},
	);

	const catalogItems = [
		{ productKey: "silk-twill-wrap" },
		{ productKey: "cashmere-fringe-scarf" },
	];
	for (const item of catalogItems) {
		const id = uuid(`pinterest-item:${item.productKey}`);
		await insertModuleData(client, "pinterest-shop", "catalogItem", id, {
			id,
			localProductId: productIds[item.productKey as keyof typeof productIds],
			externalItemId: `pin_${item.productKey.replace(/-/g, "_")}`,
			title: productByKey[item.productKey]?.name ?? item.productKey,
			price: productByKey[item.productKey]?.price ?? 0,
			currency: "USD",
			availability: "in_stock",
			status: "active",
			lastSyncedAt: now,
			createdAt: now,
			updatedAt: now,
		});
	}

	const pins = [
		{ productKey: "silk-twill-wrap", pinId: "PIN_1234567890", repins: 342 },
		{
			productKey: "cashmere-fringe-scarf",
			pinId: "PIN_2345678901",
			repins: 218,
		},
	];
	for (const pin of pins) {
		const id = uuid(`shopping-pin:${pin.productKey}`);
		await insertModuleData(client, "pinterest-shop", "shoppingPin", id, {
			id,
			catalogItemId: uuid(`pinterest-item:${pin.productKey}`),
			externalPinId: pin.pinId,
			boardId: "PIN_BOARD_LUXURY_STYLE",
			impressions: 12400,
			repins: pin.repins,
			clicks: Math.round(pin.repins * 1.8),
			isActive: true,
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedDoordash(client: pg.PoolClient) {
	const now = new Date().toISOString();
	const orderId = uuid("order:demo");

	const zoneId = uuid("doordash-zone:london-w11");
	await insertModuleData(client, "doordash", "deliveryZone", zoneId, {
		id: zoneId,
		name: "Kensington & Chelsea",
		isActive: true,
		radius: 3.0,
		centerLat: 51.5142,
		centerLng: -0.1973,
		minOrderAmount: 5000,
		deliveryFee: 799,
		estimatedMinutes: 45,
		createdAt: now,
		updatedAt: now,
	});

	const quoteId = uuid("doordash-quote:demo-order");
	await insertModuleData(client, "doordash", "quote", quoteId, {
		id: quoteId,
		externalDeliveryId: "D_EXT_20260513_001",
		fee: 799,
		currency: "USD",
		estimatedPickupTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
		estimatedDropoffTime: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
		expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
		createdAt: now,
	});

	const deliveryId = uuid("doordash-delivery:demo-order");
	await insertModuleData(client, "doordash", "delivery", deliveryId, {
		id: deliveryId,
		orderId,
		externalDeliveryId: "D_EXT_20260513_001",
		status: "delivered",
		pickupAddress: {
			street: "47 Kensington Park Gardens",
			city: "London",
			postalCode: "W11 2PN",
			country: "GB",
		},
		dropoffAddress: {
			street: "12 Sloane Square",
			city: "London",
			postalCode: "SW1W 8EG",
			country: "GB",
		},
		fee: 799,
		tip: 200,
		trackingUrl: "https://doordash.com/track/D_EXT_20260513_001",
		driverName: "James P.",
		metadata: {},
		createdAt: now,
		updatedAt: now,
	});
}

async function seedUberDirect(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const serviceAreaId = uuid("uber-direct-area:london-central");
	await insertModuleData(client, "uber-direct", "serviceArea", serviceAreaId, {
		id: serviceAreaId,
		name: "London Central",
		isActive: true,
		polygon: [
			{ lat: 51.51, lng: -0.13 },
			{ lat: 51.52, lng: -0.2 },
			{ lat: 51.5, lng: -0.2 },
			{ lat: 51.5, lng: -0.13 },
		],
		minOrderAmount: 5000,
		deliveryFee: 899,
		estimatedMinutes: 40,
		createdAt: now,
		updatedAt: now,
	});

	const quoteId = uuid("uber-direct-quote:sample");
	await insertModuleData(client, "uber-direct", "quote", quoteId, {
		id: quoteId,
		externalQuoteId: "UBERD_QUOTE_001",
		fee: 899,
		currency: "USD",
		estimatedPickupTime: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
		estimatedDropoffTime: new Date(Date.now() + 40 * 60 * 1000).toISOString(),
		expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
		createdAt: now,
	});

	const deliveryId = uuid("uber-direct-delivery:sample");
	await insertModuleData(client, "uber-direct", "delivery", deliveryId, {
		id: deliveryId,
		orderId: uuid("order:demo"),
		externalDeliveryId: "UBERD_DELIV_001",
		status: "delivered",
		pickupAddress: {
			street: "47 Kensington Park Gardens",
			city: "London",
			postalCode: "W11 2PN",
		},
		dropoffAddress: {
			street: "30 Beauchamp Place",
			city: "London",
			postalCode: "SW3 1NJ",
		},
		fee: 899,
		tip: 150,
		trackingUrl: "https://m.uber.com/track/UBERD_DELIV_001",
		driverName: "Amara S.",
		metadata: {},
		createdAt: now,
		updatedAt: now,
	});
}

async function seedUberEats(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const menuSyncId = uuid("uber-eats-menu-sync:2026-05");
	await insertModuleData(client, "uber-eats", "menuSync", menuSyncId, {
		id: menuSyncId,
		status: "completed",
		itemCount: 5,
		completedAt: now,
		startedAt: now,
		createdAt: now,
	});

	const uberOrderId = uuid("uber-eats-order:UE20260513001");
	await insertModuleData(client, "uber-eats", "uberOrder", uberOrderId, {
		id: uberOrderId,
		externalOrderId: "UE20260513001",
		status: "completed",
		items: [{ name: "Regent Penny Loafer", quantity: 1, price: 89500 }],
		subtotal: 89500,
		deliveryFee: 799,
		tax: 7697,
		total: 97996,
		customerName: "T. Nakamura",
		customerPhone: "+44 7700 900123",
		orderType: "delivery",
		createdAt: now,
		updatedAt: now,
	});
}

async function seedFavor(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const serviceAreaId = uuid("favor-area:london-kensington");
	await insertModuleData(client, "favor", "serviceArea", serviceAreaId, {
		id: serviceAreaId,
		name: "Kensington",
		isActive: true,
		radius: 2.0,
		centerLat: 51.5004,
		centerLng: -0.1774,
		minOrderAmount: 3000,
		deliveryFee: 699,
		estimatedMinutes: 60,
		createdAt: now,
		updatedAt: now,
	});

	const deliveryId = uuid("favor-delivery:sample");
	await insertModuleData(client, "favor", "delivery", deliveryId, {
		id: deliveryId,
		orderId: uuid("order:demo"),
		externalDeliveryId: "FAVOR_DEL_001",
		status: "delivered",
		pickupAddress: {
			street: "47 Kensington Park Gardens",
			city: "London",
			postalCode: "W11 2PN",
		},
		dropoffAddress: {
			street: "5 Ladbroke Grove",
			city: "London",
			postalCode: "W11 3BD",
		},
		fee: 699,
		tip: 100,
		runnerName: "Oliver M.",
		metadata: {},
		createdAt: now,
		updatedAt: now,
	});
}

async function seedToast(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const syncRecord = uuid("toast-sync:products-bulk");
	await insertModuleData(client, "toast", "syncRecord", syncRecord, {
		id: syncRecord,
		entityType: "product",
		entityId: uuid("toast-bulk-sync"),
		externalId: "TOAST_MENU_20260513",
		direction: "export",
		status: "completed",
		syncedAt: now,
		createdAt: now,
		updatedAt: now,
	});

	const mappings = [
		{ productKey: "regent-penny-loafer", externalMenuItemId: "TOAST_ITEM_001" },
		{
			productKey: "grand-tour-passport-folio",
			externalMenuItemId: "TOAST_ITEM_002",
		},
	];
	for (const mapping of mappings) {
		const mappingId = uuid(`toast-menu-mapping:${mapping.productKey}`);
		await insertModuleData(client, "toast", "menuMapping", mappingId, {
			id: mappingId,
			localProductId: productIds[mapping.productKey as keyof typeof productIds],
			externalMenuItemId: mapping.externalMenuItemId,
			isActive: true,
			lastSyncedAt: now,
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function seedWish(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const wishProducts = [
		{ productKey: "cashmere-fringe-scarf", externalId: "WISH_CFS_001" },
		{ productKey: "silk-twill-wrap", externalId: "WISH_STW_001" },
	];
	for (const product of wishProducts) {
		const id = uuid(`wish-product:${product.productKey}`);
		await insertModuleData(client, "wish", "wishProduct", id, {
			id,
			localProductId: productIds[product.productKey as keyof typeof productIds],
			externalProductId: product.externalId,
			title: productByKey[product.productKey]?.name ?? product.productKey,
			price: productByKey[product.productKey]?.price ?? 0,
			status: "active",
			lastSyncedAt: now,
			createdAt: now,
			updatedAt: now,
		});
	}

	const wishOrderId = uuid("wish-order:WISH20260513001");
	await insertModuleData(client, "wish", "wishOrder", wishOrderId, {
		id: wishOrderId,
		externalOrderId: "WISH20260513001",
		status: "shipped",
		items: [{ externalProductId: "WISH_CFS_001", quantity: 1, price: 49500 }],
		subtotal: 49500,
		platformFee: 9900,
		netProceeds: 39600,
		buyerName: "K. Fischer",
		shippingAddress: { city: "Berlin", country: "DE" },
		trackingNumber: "UPS1Z999AA10123400099",
		createdAt: now,
		updatedAt: now,
	});
}

async function seedPhotoBooth(client: pg.PoolClient) {
	const now = new Date().toISOString();

	const sessionId = uuid("photo-session:holiday-2026");
	await insertModuleData(client, "photo-booth", "photoSession", sessionId, {
		id: sessionId,
		name: "Holiday Atelier 2026",
		isActive: false,
		photoCount: 3,
		startedAt: now,
		endedAt: now,
		settings: {
			watermark: true,
			overlayText: "Atelier Holiday 2026",
			autoShare: false,
			filterStyle: "warm",
		},
		createdAt: now,
		updatedAt: now,
	});

	const photos = [
		{
			key: "photo-1",
			email: "eleanor@example.com",
			caption: "Wearing the Observatory Chronograph at the Atelier event",
			sendStatus: "sent",
			isPublic: true,
		},
		{
			key: "photo-2",
			email: "marcus@example.com",
			caption: "Grand Tour Passport Folio — the perfect travel companion",
			sendStatus: "sent",
			isPublic: true,
		},
		{
			key: "photo-3",
			email: "sofia@example.com",
			caption: "Cashmere Fringe Scarf — winter elegance",
			sendStatus: "pending",
			isPublic: false,
		},
	];

	for (const photo of photos) {
		const photoId = uuid(`photo:${photo.key}`);
		await insertModuleData(client, "photo-booth", "photo", photoId, {
			id: photoId,
			sessionId,
			imageUrl: "",
			thumbnailUrl: "",
			caption: photo.caption,
			email: photo.email,
			sendStatus: photo.sendStatus,
			tags: ["atelier", "holiday"],
			isPublic: photo.isPublic,
			createdAt: now,
		});
	}
}

async function main() {
	const client = await pool.connect();
	const storage = createStorageFromEnv();
	const assets = createAssetResolver(storage);

	try {
		await client.query("BEGIN");

		await seedAdminUser(client);
		await seedModules(client);
		await resetManagedModuleData(client);
		await applySeedModuleSchema(client);
		await seedProducts(client, assets);
		await seedCollections(client, assets);
		await seedCollectionsModule(client, assets);
		await seedBrands(client, assets);
		await seedCustomers(client);
		await seedSettings(client);
		await seedInventory(client);
		await seedNavigation(client);
		await seedDemoOrder(client);
		await seedReviews(client);
		await seedBlog(client, assets);
		await seedPages(client, assets);
		await seedShipping(client);
		await seedTax(client);
		await seedDiscounts(client);
		await seedFaq(client);
		await seedAnnouncements(client);
		await seedSeo(client);
		await seedSearch(client, assets);
		await seedNewsletter(client);
		await seedSocialProof(client, assets);
		await seedProductLabels(client);
		await seedRedirects(client);
		await seedSitemap(client);
		await seedStoreLocator(client);
		await seedStorePickup(client);
		await seedDeliverySlots(client);
		await seedWishlist(client);
		await seedLoyalty(client);
		await seedFlashSales(client);
		await seedBundles(client);
		await seedSubscriptions(client);
		await seedGiftCards(client);
		await seedAppointments(client);
		await seedMemberships(client);
		await seedWarranties(client);
		await seedAuctions(client);
		await seedStoreCredits(client);
		await seedPreorders(client);
		await seedReferrals(client);
		await seedAffiliates(client);
		await seedCustomerGroups(client);
		await seedAbandonedCarts(client);
		await seedDigitalDownloads(client);
		await seedQuotes(client);
		await seedReturns(client);
		await seedBackorders(client);
		await seedGiftRegistry(client);
		await seedBulkPricing(client);
		await seedGiftWrapping(client);
		await seedInvoices(client);
		await seedGamification(client);
		await seedMultiCurrency(client);
		await seedWaitlist(client);
		await seedCart(client);
		await seedCheckout(client);
		await seedNotifications(client);
		await seedRecentlyViewed(client);
		await seedRecommendations(client);
		await seedForms(client);
		await seedTipping(client);
		await seedOrderNotes(client);
		await seedFulfillment(client);
		await seedAuditLog(client);
		await seedVendors(client);
		await seedTickets(client);
		await seedProductQa(client);
		await seedComparisons(client);
		await seedPriceLists(client);
		await seedProductFeeds(client);
		await seedImportExport(client);
		await seedSavedAddresses(client);
		await seedMedia(client);
		await seedAutomations(client);
		await seedPayments(client);
		await seedAnalytics(client);
		await seedSocialSharing(client);
		await seedQrCodes(client);
		await seedKiosk(client);
		await seedPhotoBooth(client);
		await seedAmazon(client);
		await seedEbay(client);
		await seedEtsy(client);
		await seedTiktokShop(client);
		await seedGoogleShopping(client);
		await seedFacebookShop(client);
		await seedInstagramShop(client);
		await seedWalmart(client);
		await seedXShop(client);
		await seedPinterestShop(client);
		await seedDoordash(client);
		await seedUberDirect(client);
		await seedUberEats(client);
		await seedFavor(client);
		await seedToast(client);
		await seedWish(client);

		await client.query("COMMIT");
	} catch (error) {
		await client.query("ROLLBACK");
		console.error("\n❌ Seed failed:", error);
		process.exit(1);
	} finally {
		client.release();
		await pool.end();
	}
}

main();
