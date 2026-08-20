import type { ModuleDataService } from "@86d-app/core/types/module";
import type { SettingGroup, SettingsController, StoreSetting } from "./service";

const PUBLIC_PREFIXES = [
	"general.",
	"contact.",
	"social.",
	"appearance.",
] as const;

function groupFromKey(key: string): SettingGroup {
	const prefix = key.split(".")[0];
	const valid: SettingGroup[] = [
		"general",
		"contact",
		"social",
		"legal",
		"commerce",
		"appearance",
	];
	if (valid.includes(prefix as SettingGroup)) return prefix as SettingGroup;
	return "general";
}

export function createSettingsController(
	data: ModuleDataService,
): SettingsController {
	return {
		async get(key) {
			const matches = await data.findMany("storeSetting", {
				where: { key },
				take: 1,
			});
			const setting = matches[0] as unknown as StoreSetting | undefined;
			return setting ?? null;
		},

		async getValue(key) {
			const setting = await this.get(key);
			return setting?.value ?? null;
		},

		async set(key, value, group) {
			const existing = await data.findMany("storeSetting", {
				where: { key },
				take: 1,
			});

			const id =
				(existing[0] as unknown as StoreSetting | undefined)?.id ??
				crypto.randomUUID();
			const now = new Date();
			const setting: StoreSetting = {
				id,
				key,
				value,
				group: group ?? groupFromKey(key),
				updatedAt: now,
			};
			await data.upsert("storeSetting", id, { ...setting });
			return setting;
		},

		async setBulk(settings) {
			const results: StoreSetting[] = [];
			for (const s of settings) {
				const result = await this.set(s.key, s.value, s.group);
				results.push(result);
			}
			return results;
		},

		async getByGroup(group) {
			const all = await data.findMany("storeSetting", {
				where: { group },
			});
			return all as unknown as StoreSetting[];
		},

		async getAll() {
			const all = await data.findMany("storeSetting", {});
			return all as unknown as StoreSetting[];
		},

		async getPublic() {
			const all = await data.findMany("storeSetting", {});
			const settings = all as unknown as StoreSetting[];
			const result: Record<string, string> = {};
			for (const s of settings) {
				if (PUBLIC_PREFIXES.some((p) => s.key.startsWith(p))) {
					result[s.key] = s.value;
				}
			}
			return result;
		},

		async delete(key) {
			const matches = await data.findMany("storeSetting", {
				where: { key },
				take: 1,
			});
			const existing = matches[0] as unknown as StoreSetting | undefined;
			if (!existing) return false;
			await data.delete("storeSetting", existing.id);
			return true;
		},
	};
}
