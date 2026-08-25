import { getProcessEnv } from "env/process-env";
import { notFound } from "next/navigation";

export function assertMerchantUiFixturesEnabled(): void {
	if (getProcessEnv("E2E_MERCHANT_UI_FIXTURES") !== "true") {
		notFound();
	}
}
