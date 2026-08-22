import { provideCapability } from "@86d-app/core/capabilities";
import { storePresentationResolveCapability } from "@86d-app/core/commerce-capabilities";
import { z } from "zod";

const settingSchema = z
	.object({
		key: z.string().min(1).max(200),
		value: z.string().max(2_000),
	})
	.passthrough();

type PresentationFailure = z.infer<
	typeof storePresentationResolveCapability.failure
>;

function rejected(code: PresentationFailure["code"], message: string) {
	return { ok: false, failure: { code, message } } satisfies {
		ok: false;
		failure: PresentationFailure;
	};
}

function settingValue(
	settings: Array<z.infer<typeof settingSchema>>,
	key: string,
): string | undefined {
	return settings.find((setting) => setting.key === key)?.value;
}

export const storePresentationResolveProvider = provideCapability(
	storePresentationResolveCapability,
	async (ctx) => {
		try {
			const parsed = z
				.array(settingSchema)
				.safeParse(await ctx.data.findMany("storeSetting", {}));
			if (!parsed.success) {
				return rejected(
					"SETTINGS_INVALID",
					"Stored presentation settings are invalid.",
				);
			}

			const configuredName = settingValue(
				parsed.data,
				"general.store_name",
			)?.trim();
			const optionName =
				typeof ctx.options.defaultStoreName === "string"
					? ctx.options.defaultStoreName.trim()
					: undefined;
			const storeName = configuredName || optionName;
			if (!storeName) {
				return rejected(
					"SETTINGS_UNAVAILABLE",
					"The Store name is not configured.",
				);
			}

			const storeDescription = settingValue(
				parsed.data,
				"general.store_description",
			);
			const supportEmail = settingValue(parsed.data, "contact.support_email");
			const currency = settingValue(parsed.data, "commerce.currency");
			const decision = storePresentationResolveCapability.decision.safeParse({
				storeName,
				...(storeDescription ? { storeDescription } : {}),
				...(supportEmail ? { supportEmail } : {}),
				...(currency ? { currency } : {}),
			});
			if (!decision.success) {
				return rejected(
					"SETTINGS_INVALID",
					"Configured presentation settings are invalid.",
				);
			}
			return { ok: true, decision: decision.data };
		} catch {
			return rejected(
				"SETTINGS_UNAVAILABLE",
				"Store presentation settings are unavailable.",
			);
		}
	},
);
