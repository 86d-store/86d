"use client";

import { useReferralsApi } from "./_hooks";
import ReferralDashboardTemplate from "./referral-dashboard.mdx";

interface ReferralCodeData {
	code: string;
	usageCount: number;
}

interface CustomerStats {
	code: ReferralCodeData | null;
	totalReferrals: number;
	completedReferrals: number;
	pendingReferrals: number;
}

export function ReferralDashboard() {
	const api = useReferralsApi();

	const { data, isLoading: loading } = api.myStats.useQuery({}) as {
		data: CustomerStats | undefined;
		isLoading: boolean;
	};

	return (
		<ReferralDashboardTemplate
			loading={loading}
			code={data?.code?.code ?? ""}
			totalReferrals={data?.totalReferrals ?? 0}
			completedReferrals={data?.completedReferrals ?? 0}
			pendingReferrals={data?.pendingReferrals ?? 0}
		/>
	);
}
