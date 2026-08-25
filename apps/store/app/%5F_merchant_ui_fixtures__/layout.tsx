import { type ReactNode, Suspense } from "react";
import { assertMerchantUiFixturesEnabled } from "~/lib/merchant-ui/fixture-access";

export const dynamic = "force-dynamic";

export default function StoreMerchantUiFixturesLayout({
	children,
}: {
	children: ReactNode;
}) {
	assertMerchantUiFixturesEnabled();
	return <Suspense fallback={null}>{children}</Suspense>;
}
