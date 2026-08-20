"use client";

import { useReferralsApi } from "./_hooks";
import ReferralShareTemplate from "./referral-share.mdx";

interface ReferralCodeData {
	code: string;
	usageCount: number;
	maxUses: number;
	active: boolean;
}

export function ReferralShare() {
	const api = useReferralsApi();

	const { data, isLoading: loading } = api.myCode.useQuery({}) as {
		data: { code: ReferralCodeData } | undefined;
		isLoading: boolean;
	};

	const code = data?.code;
	const shareUrl = code
		? `${typeof window !== "undefined" ? window.location.origin : ""}?ref=${code.code}`
		: "";

	const handleCopy = () => {
		if (code) {
			void navigator.clipboard.writeText(code.code);
		}
	};

	const handleCopyLink = () => {
		if (shareUrl) {
			void navigator.clipboard.writeText(shareUrl);
		}
	};

	return (
		<ReferralShareTemplate
			code={code?.code ?? ""}
			usageCount={code?.usageCount ?? 0}
			loading={loading}
			onCopyCode={handleCopy}
			onCopyLink={handleCopyLink}
			shareUrl={shareUrl}
		/>
	);
}
