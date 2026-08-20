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
 *   - Curated Module rows only (compiled tables; stripe is tier-none)
 *   - 3 customers, 1 demo order, and supporting curated module data
 *   - Uploaded local seed assets stored under stores/{STORE_ID}/seed/luxury-house/...
 *
 * Stock images are produced with: bun run seed:fetch-luxury-assets (see packages/db/seed/luxury-stock-sources.json).
 */

import { createHash, randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	CURATED_STORE_MODULES,
	TIER_NONE_CURATED_MODULES,
} from "@86d-app/core/curated-modules";
import { createStorageFromEnv } from "@86d-app/storage/factory";
import type { StorageProvider } from "@86d-app/storage/types";
import pg from "pg";
import { workspaceRootFromImportMeta } from "../../../internals/lib/workspace-root.ts";
import {
	categories,
	collections,
	customerAddresses,
	customers,
	demoOrder,
	discounts,
	houseBrand,
	navigationItems,
	newsletterSubscribers,
	pages,
	productByKey,
	products,
	reviews,
	type SeedProduct,
	type SeedVariant,
	searchSynonyms,
	seoMeta,
	shippingRates,
	shippingZones,
	sitemapConfig,
	storeSettings,
	summary,
	taxCategory,
	taxRates,
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
/** Compiled column allowlists keyed by `module.entity` for seed writes. */
const compiledSeedColumns = new Map<string, ReadonlySet<string>>();
const moduleNames = [...CURATED_STORE_MODULES];
const seededModuleNames = moduleNames.filter(
	(name) => !(TIER_NONE_CURATED_MODULES as readonly string[]).includes(name),
);

for (const name of moduleNames) {
	moduleIds[name] = uuid(`module:${STORE_ID}:${name}`);
}

const categoryIds = idsByKey("category", categories);
const productIds = idsByKey("product", products);
const customerIds = idsByKey("customer", customers);
const collectionIds = idsByKey("collection", collections);
const pageIds = idsByKey("page", pages);
const shippingZoneIds = idsByKey("shipping-zone", shippingZones);
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
	if (!moduleIds[moduleName]) {
		throw new Error(
			`Seed attempted to write ${moduleName}.${entityType} but Module "${moduleName}" is not enabled.`,
		);
	}
	if (!(seededModuleNames as readonly string[]).includes(moduleName)) {
		throw new Error(
			`Seed attempted to write ${moduleName}.${entityType} but Module "${moduleName}" has no compiled tables.`,
		);
	}
	const allowed = compiledSeedColumns.get(`${moduleName}.${entityType}`);
	if (!allowed) {
		throw new Error(
			`Seed attempted to write ${moduleName}.${entityType} but no compiled columns were registered.`,
		);
	}
	const record: Record<string, unknown> = {
		id: entityId,
	};
	for (const [key, value] of Object.entries(data)) {
		if (key === "id" || allowed.has(key)) {
			record[key] = value;
		}
	}
	record.id = entityId;

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

async function resetManagedModuleData(_client: pg.PoolClient) {
	// Seed is idempotent via ON CONFLICT upserts. Do not DROP schemas on re-seed —
	// AUTO_SEED restarts must preserve semantic seed snapshots without wipe drift.
}

async function applySeedModuleSchema(client: pg.PoolClient) {
	const { compileModuleDeclarations, emitSql } = await import(
		"@86d-app/core/schema"
	);
	const { applyModuleDdl } = await import("./schema/apply-disposable-ddl");
	const { loadCuratedModules } = await import("./load-curated-modules");

	const loaded = await loadCuratedModules();
	const report = compileModuleDeclarations(loaded);
	const expectedTables = new Set(seededModuleNames);
	const compiledIds = new Set(report.transcoded.map((entry) => entry.moduleId));
	for (const moduleId of expectedTables) {
		if (!compiledIds.has(moduleId)) {
			throw new Error(
				`Seed expects compiled tables for Module "${moduleId}", but none were produced.`,
			);
		}
	}

	compiledSeedColumns.clear();
	for (const moduleResult of report.transcoded) {
		for (const table of moduleResult.tables) {
			compiledSeedColumns.set(
				`${moduleResult.moduleId}.${table.tableName}`,
				new Set(table.columns.map((column) => column.name)),
			);
		}
	}

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
		revision: 1,
		cartId: uuid("cart:eleanor-vale:completed"),
		customerId: customerIds["eleanor-vale"],
		orderId,
		status: "completed",
		subtotal: 89500,
		taxAmount: 7697,
		shippingAmount: 0,
		discountAmount: 0,
		giftCardAmount: 0,
		storeCreditAmount: 0,
		total: 97197,
		currency: "USD",
		expiresAt: now,
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
			name: item.productName,
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
		await seedCustomers(client);
		await seedSettings(client);
		await seedInventory(client);
		await seedNavigation(client);
		await seedDemoOrder(client);
		await seedReviews(client);
		await seedPages(client, assets);
		await seedShipping(client);
		await seedTax(client);
		await seedDiscounts(client);
		await seedSeo(client);
		await seedSearch(client, assets);
		await seedNewsletter(client);
		await seedSitemap(client);
		await seedCart(client);
		await seedCheckout(client);
		await seedNotifications(client);
		await seedMedia(client);
		await seedPayments(client);
		await seedAnalytics(client);

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
