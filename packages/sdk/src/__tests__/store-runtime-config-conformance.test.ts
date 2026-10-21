import { describe, expect, it } from "vitest";
import { fetchFromApi } from "../fetch-from-api";
import fixtures from "./fixtures/store-runtime-config.json";

describe("Store runtime config producer conformance", () => {
	it.each(fixtures.cases.filter(({ sdkAccepts }) => sdkAccepts))(
		"accepts $name",
		async ({ output }) => {
			await expect(
				fetchFromApi(
					"a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
					"https://console.86d.app",
					async () => Response.json(output),
				),
			).resolves.toMatchObject(output);
		},
	);

	it.each(fixtures.cases.filter(({ sdkAccepts }) => !sdkAccepts))(
		"rejects $name",
		async ({ output }) => {
			await expect(
				fetchFromApi(
					"a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
					"https://console.86d.app",
					async () => Response.json(output),
				),
			).rejects.toThrow("Invalid store config from 86d API");
		},
	);

	it.each(
		fixtures.cases.filter(
			({ name }) => name === "v1-active" || name === "v2-active",
		),
	)("rejects forbidden template fields in $name", async ({ output }) => {
		await expect(
			fetchFromApi(
				"a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
				"https://console.86d.app",
				async () =>
					Response.json({
						...output,
						template: {
							...output.template,
							providerSecret: "must-not-cross-the-boundary",
						},
					}),
			),
		).rejects.toThrow("Invalid store config from 86d API");
	});
});
