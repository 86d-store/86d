import { getProcessEnv, setProcessEnv } from "env/process-env";
import { afterEach, describe, expect, it } from "vitest";
import { assertMerchantUiFixturesEnabled } from "../merchant-ui/fixture-access";

const previousFixtureOptIn = getProcessEnv("BROWSER_MERCHANT_UI_FIXTURES");

describe("merchant UI fixture access", () => {
	afterEach(() => {
		setProcessEnv("BROWSER_MERCHANT_UI_FIXTURES", previousFixtureOptIn);
	});

	it.each([undefined, "", "1", "TRUE", "false"])(
		"returns 404 when the explicit browser opt-in is %s",
		(value) => {
			setProcessEnv("BROWSER_MERCHANT_UI_FIXTURES", value);

			expect(() => assertMerchantUiFixturesEnabled()).toThrow(
				"NEXT_HTTP_ERROR_FALLBACK;404",
			);
		},
	);

	it('permits the fixture route only for the literal "true" opt-in', () => {
		setProcessEnv("BROWSER_MERCHANT_UI_FIXTURES", "true");

		expect(() => assertMerchantUiFixturesEnabled()).not.toThrow();
	});
});
