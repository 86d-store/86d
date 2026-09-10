"use client";

import { useAccountOverview } from "../_hooks/use-account-overview";
import AccountOverviewTemplate from "./account-overview.mdx";

export function AccountOverview() {
	const overview = useAccountOverview();
	return <AccountOverviewTemplate {...overview} />;
}
