"use client";

import { useState } from "react";
import { useAffiliatesStoreApi } from "./_hooks";
import { extractError, formatCurrency, formatDate } from "./_utils";
import AffiliateDashboardTemplate from "./affiliate-dashboard.mdx";

// ---------------------------------------------------------------------------
// Types matching the /affiliates/dashboard endpoint response
// ---------------------------------------------------------------------------

interface AffiliateLink {
	id: string;
	affiliateId: string;
	code: string;
	targetUrl: string;
	clickCount: number;
	conversionCount: number;
	createdAt: string;
}

interface AffiliateConversion {
	id: string;
	affiliateId: string;
	orderId?: string | undefined;
	amount: number;
	commission: number;
	status: string;
	createdAt: string;
}

interface AffiliatePayout {
	id: string;
	affiliateId: string;
	amount: number;
	method: string;
	status: string;
	createdAt: string;
}

interface AffiliateBalance {
	pending: number;
	approved: number;
	paid: number;
	currency: string;
}

interface DashboardAffiliate {
	id: string;
	name: string;
	email: string;
	status: string;
	commissionRate: number;
}

interface DashboardData {
	affiliate: DashboardAffiliate;
	balance: AffiliateBalance;
	links: AffiliateLink[];
	conversions: AffiliateConversion[];
	payouts: AffiliatePayout[];
}

// ---------------------------------------------------------------------------
// AffiliateDashboard
// ---------------------------------------------------------------------------

export function AffiliateDashboard() {
	const api = useAffiliatesStoreApi();
	const [newTargetUrl, setNewTargetUrl] = useState("");
	const [copiedId, setCopiedId] = useState<string | null>(null);
	const [createError, setCreateError] = useState("");

	const { data, isLoading, isError, refetch } = api.dashboard.useQuery({}) as {
		data: DashboardData | { error: string; status: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const createLinkMutation = api.createLink.useMutation({
		onSuccess: () => {
			setNewTargetUrl("");
			setCreateError("");
			void refetch();
		},
		onError: (err: Error) => {
			setCreateError(extractError(err, "Failed to create link."));
		},
	});

	const handleCreateLink = (e: React.FormEvent) => {
		e.preventDefault();
		if (!newTargetUrl.trim()) return;
		createLinkMutation.mutate({ targetUrl: newTargetUrl.trim() });
	};

	const handleCopy = (link: AffiliateLink) => {
		const url = new URL(link.targetUrl);
		url.searchParams.set("ref", link.code);
		void navigator.clipboard.writeText(url.toString()).then(() => {
			setCopiedId(link.id);
			setTimeout(() => setCopiedId(null), 2000);
		});
	};

	// Not an affiliate
	const dashboardData = data as DashboardData | undefined;
	const errorData = data as { error: string; status: number } | undefined;
	const isNotAffiliate = !isLoading && errorData?.status === 404;
	const isPending =
		!isLoading && dashboardData?.affiliate?.status === "pending";
	const isSuspended =
		!isLoading && dashboardData?.affiliate?.status === "suspended";

	return (
		<AffiliateDashboardTemplate
			isLoading={isLoading}
			isError={isError}
			isNotAffiliate={isNotAffiliate}
			isPending={isPending}
			isSuspended={isSuspended}
			affiliate={dashboardData?.affiliate}
			balance={dashboardData?.balance}
			links={dashboardData?.links ?? []}
			conversions={dashboardData?.conversions ?? []}
			payouts={dashboardData?.payouts ?? []}
			newTargetUrl={newTargetUrl}
			onNewTargetUrlChange={setNewTargetUrl}
			onCreateLink={handleCreateLink}
			isCreatingLink={createLinkMutation.isPending}
			createError={createError}
			copiedId={copiedId}
			onCopy={handleCopy}
			formatCurrency={formatCurrency}
			formatDate={formatDate}
		/>
	);
}
