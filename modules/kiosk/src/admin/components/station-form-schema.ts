import { z } from "zod";
import type { AdminKioskStation } from "./kiosk-admin-types";

export const stationFormSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Station name is required")
		.max(200, "Station name must be 200 characters or fewer"),
	location: z
		.string()
		.trim()
		.max(500, "Location must be 500 characters or fewer"),
	isActive: z.boolean(),
});

export type StationFormValues = z.infer<typeof stationFormSchema>;

export function createStationFormDefaults(
	station?: AdminKioskStation,
): StationFormValues {
	return {
		name: station?.name ?? "",
		location: station?.location ?? "",
		isActive: station?.isActive ?? true,
	};
}

export function stationFormErrorMessage(error: unknown) {
	if (typeof error === "string") return error;
	if (error && typeof error === "object" && "message" in error) {
		const message = error.message;
		return typeof message === "string" ? message : undefined;
	}
	return undefined;
}
