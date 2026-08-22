import { type ReactNode, Suspense } from "react";

export default function StoreMerchantUiFixturesLayout({
	children,
}: {
	children: ReactNode;
}) {
	return <Suspense fallback={null}>{children}</Suspense>;
}
