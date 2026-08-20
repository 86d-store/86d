import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	Customer,
	CustomerAddress,
	CustomerController,
	ImportCustomerResult,
	ImportCustomerRow,
	LoyaltyBalance,
	LoyaltyStats,
	LoyaltyTransaction,
} from "./service";

export function createCustomerController(
	data: ModuleDataService,
	events?: ScopedEventEmitter | undefined,
): CustomerController {
	return {
		async getById(id: string): Promise<Customer | null> {
			return (await data.get("customer", id)) as Customer | null;
		},

		async getByEmail(email: string): Promise<Customer | null> {
			const results = (await data.findMany("customer", {
				where: { email },
				take: 1,
			})) as Customer[];
			return results[0] ?? null;
		},

		async create(params): Promise<Customer> {
			const id = params.id ?? crypto.randomUUID();
			const now = new Date();
			const customer: Customer = {
				id,
				email: params.email,
				firstName: params.firstName,
				lastName: params.lastName,
				phone: params.phone,
				dateOfBirth: params.dateOfBirth,
				tags: params.tags ?? [],
				metadata: params.metadata ?? {},
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("customer", id, customer as Record<string, unknown>);

			if (events) {
				void events.emit("customer.created", {
					customerId: customer.id,
					email: customer.email,
					firstName: customer.firstName,
					lastName: customer.lastName,
				});
			}

			return customer;
		},

		async update(id: string, params): Promise<Customer | null> {
			const existing = (await data.get("customer", id)) as Customer | null;
			if (!existing) return null;

			const updated: Customer = {
				...existing,
				...(params.firstName !== undefined
					? { firstName: params.firstName }
					: {}),
				...(params.lastName !== undefined ? { lastName: params.lastName } : {}),
				...(params.phone !== undefined
					? { phone: params.phone ?? undefined }
					: {}),
				...(params.dateOfBirth !== undefined
					? { dateOfBirth: params.dateOfBirth ?? undefined }
					: {}),
				...(params.tags !== undefined ? { tags: params.tags } : {}),
				...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
				updatedAt: new Date(),
			};
			await data.upsert("customer", id, updated as Record<string, unknown>);
			return updated;
		},

		async delete(id: string): Promise<void> {
			await data.delete("customer", id);
		},

		async list(params): Promise<{ customers: Customer[]; total: number }> {
			const { limit = 20, offset = 0, search, tag } = params;
			const all = (await data.findMany("customer", {})) as Customer[];

			let filtered = search
				? all.filter(
						(c) =>
							c.firstName.toLowerCase().includes(search.toLowerCase()) ||
							c.lastName.toLowerCase().includes(search.toLowerCase()) ||
							c.email.toLowerCase().includes(search.toLowerCase()),
					)
				: all;

			if (tag) {
				const tagLower = tag.toLowerCase();
				filtered = filtered.filter((c) =>
					(c.tags ?? []).some((t) => t.toLowerCase() === tagLower),
				);
			}

			// Sort by createdAt descending
			filtered.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);

			return {
				customers: filtered.slice(offset, offset + limit),
				total: filtered.length,
			};
		},

		async addTags(
			customerId: string,
			tags: string[],
		): Promise<Customer | null> {
			const existing = (await data.get(
				"customer",
				customerId,
			)) as Customer | null;
			if (!existing) return null;

			const currentTags = existing.tags ?? [];
			const merged = [...new Set([...currentTags, ...tags])];
			const updated: Customer = {
				...existing,
				tags: merged,
				updatedAt: new Date(),
			};
			await data.upsert(
				"customer",
				customerId,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		async removeTags(
			customerId: string,
			tags: string[],
		): Promise<Customer | null> {
			const existing = (await data.get(
				"customer",
				customerId,
			)) as Customer | null;
			if (!existing) return null;

			const tagsToRemove = new Set(tags.map((t) => t.toLowerCase()));
			const remaining = (existing.tags ?? []).filter(
				(t) => !tagsToRemove.has(t.toLowerCase()),
			);
			const updated: Customer = {
				...existing,
				tags: remaining,
				updatedAt: new Date(),
			};
			await data.upsert(
				"customer",
				customerId,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		async listAllTags(): Promise<{ tag: string; count: number }[]> {
			const all = (await data.findMany("customer", {})) as Customer[];
			const tagCounts = new Map<string, number>();
			for (const c of all) {
				for (const t of c.tags ?? []) {
					tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
				}
			}
			return [...tagCounts.entries()]
				.map(([tag, count]) => ({ tag, count }))
				.sort((a, b) => b.count - a.count);
		},

		async bulkAddTags(
			customerIds: string[],
			tags: string[],
		): Promise<{ updated: number }> {
			let updated = 0;
			for (const id of customerIds) {
				const existing = (await data.get("customer", id)) as Customer | null;
				if (!existing) continue;
				const currentTags = existing.tags ?? [];
				const merged = [...new Set([...currentTags, ...tags])];
				const record: Customer = {
					...existing,
					tags: merged,
					updatedAt: new Date(),
				};
				await data.upsert("customer", id, record as Record<string, unknown>);
				updated++;
			}
			return { updated };
		},

		async bulkRemoveTags(
			customerIds: string[],
			tags: string[],
		): Promise<{ updated: number }> {
			let updated = 0;
			const tagsToRemove = new Set(tags.map((t) => t.toLowerCase()));
			for (const id of customerIds) {
				const existing = (await data.get("customer", id)) as Customer | null;
				if (!existing) continue;
				const remaining = (existing.tags ?? []).filter(
					(t) => !tagsToRemove.has(t.toLowerCase()),
				);
				const record: Customer = {
					...existing,
					tags: remaining,
					updatedAt: new Date(),
				};
				await data.upsert("customer", id, record as Record<string, unknown>);
				updated++;
			}
			return { updated };
		},

		async listAddresses(customerId: string): Promise<CustomerAddress[]> {
			return (await data.findMany("customerAddress", {
				where: { customerId },
			})) as CustomerAddress[];
		},

		async getAddress(id: string): Promise<CustomerAddress | null> {
			return (await data.get("customerAddress", id)) as CustomerAddress | null;
		},

		async createAddress(params): Promise<CustomerAddress> {
			const id = crypto.randomUUID();
			const now = new Date();
			const address: CustomerAddress = {
				id,
				customerId: params.customerId,
				type: params.type ?? "shipping",
				firstName: params.firstName,
				lastName: params.lastName,
				company: params.company,
				line1: params.line1,
				line2: params.line2,
				city: params.city,
				state: params.state,
				postalCode: params.postalCode,
				country: params.country,
				phone: params.phone,
				isDefault: params.isDefault ?? false,
				createdAt: now,
				updatedAt: now,
			};

			// If marking as default, clear existing defaults of the same type
			if (address.isDefault) {
				const existing = (await data.findMany("customerAddress", {
					where: { customerId: params.customerId, type: address.type },
				})) as CustomerAddress[];
				for (const addr of existing) {
					if (addr.isDefault) {
						await data.upsert("customerAddress", addr.id, {
							...addr,
							isDefault: false,
							updatedAt: new Date(),
						} as Record<string, unknown>);
					}
				}
			}

			await data.upsert(
				"customerAddress",
				id,
				address as Record<string, unknown>,
			);
			return address;
		},

		async updateAddress(id: string, params): Promise<CustomerAddress | null> {
			const existing = (await data.get(
				"customerAddress",
				id,
			)) as CustomerAddress | null;
			if (!existing) return null;

			const updated: CustomerAddress = {
				...existing,
				...(params.type !== undefined ? { type: params.type } : {}),
				...(params.firstName !== undefined
					? { firstName: params.firstName }
					: {}),
				...(params.lastName !== undefined ? { lastName: params.lastName } : {}),
				...(params.company !== undefined
					? { company: params.company ?? undefined }
					: {}),
				...(params.line1 !== undefined ? { line1: params.line1 } : {}),
				...(params.line2 !== undefined
					? { line2: params.line2 ?? undefined }
					: {}),
				...(params.city !== undefined ? { city: params.city } : {}),
				...(params.state !== undefined ? { state: params.state } : {}),
				...(params.postalCode !== undefined
					? { postalCode: params.postalCode }
					: {}),
				...(params.country !== undefined ? { country: params.country } : {}),
				...(params.phone !== undefined
					? { phone: params.phone ?? undefined }
					: {}),
				...(params.isDefault !== undefined
					? { isDefault: params.isDefault }
					: {}),
				updatedAt: new Date(),
			};

			// If marking as default, clear existing defaults of the same type
			if (params.isDefault) {
				const siblings = (await data.findMany("customerAddress", {
					where: { customerId: existing.customerId, type: updated.type },
				})) as CustomerAddress[];
				for (const addr of siblings) {
					if (addr.id !== id && addr.isDefault) {
						await data.upsert("customerAddress", addr.id, {
							...addr,
							isDefault: false,
							updatedAt: new Date(),
						} as Record<string, unknown>);
					}
				}
			}

			await data.upsert(
				"customerAddress",
				id,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		async deleteAddress(id: string): Promise<void> {
			await data.delete("customerAddress", id);
		},

		async setDefaultAddress(
			customerId: string,
			addressId: string,
		): Promise<CustomerAddress | null> {
			const address = (await data.get(
				"customerAddress",
				addressId,
			)) as CustomerAddress | null;
			if (!address || address.customerId !== customerId) return null;

			// Clear existing defaults of the same type
			const siblings = (await data.findMany("customerAddress", {
				where: { customerId, type: address.type },
			})) as CustomerAddress[];
			for (const addr of siblings) {
				if (addr.id !== addressId && addr.isDefault) {
					await data.upsert("customerAddress", addr.id, {
						...addr,
						isDefault: false,
						updatedAt: new Date(),
					} as Record<string, unknown>);
				}
			}

			const updated: CustomerAddress = {
				...address,
				isDefault: true,
				updatedAt: new Date(),
			};
			await data.upsert(
				"customerAddress",
				addressId,
				updated as unknown as Record<string, unknown>,
			);
			return updated;
		},

		async listForExport(params): Promise<Customer[]> {
			const { search, tag, dateFrom, dateTo } = params;
			const all = (await data.findMany("customer", {})) as Customer[];

			let filtered = all;

			if (search) {
				const s = search.toLowerCase();
				filtered = filtered.filter(
					(c) =>
						c.firstName.toLowerCase().includes(s) ||
						c.lastName.toLowerCase().includes(s) ||
						c.email.toLowerCase().includes(s),
				);
			}

			if (tag) {
				const tagLower = tag.toLowerCase();
				filtered = filtered.filter((c) =>
					(c.tags ?? []).some((t) => t.toLowerCase() === tagLower),
				);
			}

			if (dateFrom) {
				const from = new Date(dateFrom).getTime();
				filtered = filtered.filter(
					(c) => new Date(c.createdAt).getTime() >= from,
				);
			}

			if (dateTo) {
				const to = new Date(dateTo).getTime();
				filtered = filtered.filter(
					(c) => new Date(c.createdAt).getTime() <= to,
				);
			}

			filtered.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);

			return filtered;
		},

		async importCustomers(
			rows: ImportCustomerRow[],
		): Promise<ImportCustomerResult> {
			let created = 0;
			let updated = 0;
			const errors: ImportCustomerResult["errors"] = [];

			// Pre-fetch all customers for email matching
			const allCustomers = (await data.findMany("customer", {})) as Customer[];
			const customerByEmail = new Map<string, Customer>();
			for (const c of allCustomers) {
				customerByEmail.set(c.email.toLowerCase(), c);
			}

			for (let i = 0; i < rows.length; i++) {
				const row = rows[i];
				// Validate email
				if (!row.email || row.email.trim() === "") {
					errors.push({
						row: i + 1,
						field: "email",
						message: "Email is required",
					});
					continue;
				}

				const email = row.email.trim().toLowerCase();
				if (!email.includes("@")) {
					errors.push({
						row: i + 1,
						field: "email",
						message: "Invalid email format",
					});
					continue;
				}

				const existing = customerByEmail.get(email);
				if (existing) {
					// Update existing customer
					const updateFields: Partial<Customer> = {
						updatedAt: new Date(),
					};
					if (row.firstName !== undefined)
						updateFields.firstName = row.firstName;
					if (row.lastName !== undefined) updateFields.lastName = row.lastName;
					if (row.phone !== undefined) updateFields.phone = row.phone;
					if (row.tags !== undefined) {
						const currentTags = existing.tags ?? [];
						updateFields.tags = [...new Set([...currentTags, ...row.tags])];
					}

					const updatedCustomer = { ...existing, ...updateFields };
					await data.upsert(
						"customer",
						existing.id,
						updatedCustomer as Record<string, unknown>,
					);
					customerByEmail.set(email, updatedCustomer as Customer);
					updated++;
				} else {
					// Create new customer
					const id = crypto.randomUUID();
					const now = new Date();
					const customer: Customer = {
						id,
						email,
						firstName: row.firstName ?? "",
						lastName: row.lastName ?? "",
						phone: row.phone,
						tags: row.tags ?? [],
						metadata: {},
						createdAt: now,
						updatedAt: now,
					};
					await data.upsert(
						"customer",
						id,
						customer as Record<string, unknown>,
					);
					customerByEmail.set(email, customer);
					created++;
				}
			}

			return { created, updated, errors };
		},

		// --- Loyalty Points (quarantined; Loyalty module owns the ledger) ---

		async getLoyaltyBalance(customerId: string): Promise<LoyaltyBalance> {
			return {
				customerId,
				totalEarned: 0,
				totalRedeemed: 0,
				balance: 0,
				transactionCount: 0,
			};
		},

		async getLoyaltyHistory(
			_customerId: string,
			_params?: {
				limit?: number | undefined;
				offset?: number | undefined;
			},
		): Promise<{ transactions: LoyaltyTransaction[]; total: number }> {
			return { transactions: [], total: 0 };
		},

		async earnPoints(): Promise<LoyaltyTransaction> {
			throw new Error("Loyalty writes belong to the Loyalty module.");
		},

		async redeemPoints(): Promise<LoyaltyTransaction> {
			throw new Error("Loyalty writes belong to the Loyalty module.");
		},

		async adjustPoints(): Promise<LoyaltyTransaction> {
			throw new Error("Loyalty writes belong to the Loyalty module.");
		},

		async getLoyaltyStats(): Promise<LoyaltyStats> {
			return {
				totalCustomersWithPoints: 0,
				totalPointsIssued: 0,
				totalPointsRedeemed: 0,
				totalPointsOutstanding: 0,
				averageBalance: 0,
				topCustomers: [],
			};
		},
	};
}
