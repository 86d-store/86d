import type { ModuleDataService } from "@86d-app/core/types/module";
import type { Address, SavedAddressesController } from "./service";

interface ControllerOptions {
	maxAddresses?: number | undefined;
}

export function createSavedAddressesController(
	data: ModuleDataService,
	options?: ControllerOptions | undefined,
): SavedAddressesController {
	const maxAddresses = options?.maxAddresses ?? 20;

	async function clearDefault(
		customerId: string,
		field: "isDefault" | "isDefaultBilling",
	): Promise<void> {
		const all = await data.findMany("address", {
			where: { customerId, [field]: true },
		});
		const addresses = all as unknown as Address[];
		for (const addr of addresses) {
			await data.upsert("address", addr.id, {
				...addr,
				[field]: false,
				updatedAt: new Date(),
			} as Record<string, unknown>);
		}
	}

	return {
		async create(customerId, input) {
			const count = await this.countByCustomer(customerId);
			if (count >= maxAddresses) {
				throw new Error(
					`Address limit reached (max ${maxAddresses} addresses)`,
				);
			}

			const isDefault = input.isDefault ?? count === 0;
			const isDefaultBilling = input.isDefaultBilling ?? count === 0;

			if (isDefault) {
				await clearDefault(customerId, "isDefault");
			}
			if (isDefaultBilling) {
				await clearDefault(customerId, "isDefaultBilling");
			}

			const id = crypto.randomUUID();
			const now = new Date();
			const address: Address = {
				id,
				customerId,
				label: input.label,
				firstName: input.firstName,
				lastName: input.lastName,
				company: input.company,
				line1: input.line1,
				line2: input.line2,
				city: input.city,
				state: input.state,
				postalCode: input.postalCode,
				country: input.country,
				phone: input.phone,
				isDefault,
				isDefaultBilling,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("address", id, address as Record<string, unknown>);
			return address;
		},

		async update(customerId, addressId, input) {
			const existing = await this.getById(customerId, addressId);
			if (!existing) return null;

			if (input.isDefault === true) {
				await clearDefault(customerId, "isDefault");
			}
			if (input.isDefaultBilling === true) {
				await clearDefault(customerId, "isDefaultBilling");
			}

			const updated: Address = {
				...existing,
				...(input.label !== undefined ? { label: input.label } : {}),
				...(input.firstName !== undefined
					? { firstName: input.firstName }
					: {}),
				...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
				...(input.company !== undefined ? { company: input.company } : {}),
				...(input.line1 !== undefined ? { line1: input.line1 } : {}),
				...(input.line2 !== undefined ? { line2: input.line2 } : {}),
				...(input.city !== undefined ? { city: input.city } : {}),
				...(input.state !== undefined ? { state: input.state } : {}),
				...(input.postalCode !== undefined
					? { postalCode: input.postalCode }
					: {}),
				...(input.country !== undefined ? { country: input.country } : {}),
				...(input.phone !== undefined ? { phone: input.phone } : {}),
				...(input.isDefault !== undefined
					? { isDefault: input.isDefault }
					: {}),
				...(input.isDefaultBilling !== undefined
					? { isDefaultBilling: input.isDefaultBilling }
					: {}),
				updatedAt: new Date(),
			};

			await data.upsert(
				"address",
				addressId,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		async delete(customerId, addressId) {
			const existing = await this.getById(customerId, addressId);
			if (!existing) return false;
			await data.delete("address", addressId);
			return true;
		},

		async getById(customerId, addressId) {
			const results = await data.findMany("address", {
				where: { id: addressId },
				take: 1,
			});
			const matches = results as unknown as Address[];
			const addr = matches[0] ?? null;
			if (!addr || addr.customerId !== customerId) return null;
			return addr;
		},

		async listByCustomer(customerId, params) {
			const results = await data.findMany("address", {
				where: { customerId },
				take: params?.take ?? 50,
				skip: params?.skip ?? 0,
				orderBy: { createdAt: "desc" },
			});
			return results as unknown as Address[];
		},

		async getDefault(customerId) {
			const results = await data.findMany("address", {
				where: { customerId, isDefault: true },
				take: 1,
			});
			const addresses = results as unknown as Address[];
			return addresses[0] ?? null;
		},

		async getDefaultBilling(customerId) {
			const results = await data.findMany("address", {
				where: { customerId, isDefaultBilling: true },
				take: 1,
			});
			const addresses = results as unknown as Address[];
			return addresses[0] ?? null;
		},

		async setDefault(customerId, addressId) {
			const existing = await this.getById(customerId, addressId);
			if (!existing) return false;
			await clearDefault(customerId, "isDefault");
			const updated = {
				...existing,
				isDefault: true,
				updatedAt: new Date(),
			};
			await data.upsert(
				"address",
				addressId,
				updated as Record<string, unknown>,
			);
			return true;
		},

		async setDefaultBilling(customerId, addressId) {
			const existing = await this.getById(customerId, addressId);
			if (!existing) return false;
			await clearDefault(customerId, "isDefaultBilling");
			const updated = {
				...existing,
				isDefaultBilling: true,
				updatedAt: new Date(),
			};
			await data.upsert(
				"address",
				addressId,
				updated as Record<string, unknown>,
			);
			return true;
		},

		async countByCustomer(customerId) {
			const results = await data.findMany("address", {
				where: { customerId },
			});
			return results.length;
		},

		async listAll(params) {
			const where: Record<string, unknown> = {};
			if (params?.customerId) where.customerId = params.customerId;
			if (params?.country) where.country = params.country;

			const results = await data.findMany("address", {
				where,
				take: params?.take ?? 50,
				skip: params?.skip ?? 0,
				orderBy: { createdAt: "desc" },
			});
			const items = results as unknown as Address[];

			const allResults = await data.findMany("address", { where });
			return { items, total: allResults.length };
		},

		async getSummary() {
			const allAddresses = await data.findMany("address", {});
			const addresses = allAddresses as unknown as Address[];

			const countryCounts = new Map<string, number>();
			for (const addr of addresses) {
				const c = addr.country;
				countryCounts.set(c, (countryCounts.get(c) ?? 0) + 1);
			}

			return {
				totalAddresses: addresses.length,
				countryCounts: Array.from(countryCounts.entries())
					.map(([country, count]) => ({ country, count }))
					.sort((a, b) => b.count - a.count),
			};
		},
	};
}
