"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import CodeListTemplate from "./code-list.mdx";

interface ReferralCodeItem {
	id: string;
	customerId: string;
	code: string;
	active: boolean;
	usageCount: number;
	maxUses: number;
	expiresAt?: string | null;
	createdAt: string;
}

function useCodesAdminApi() {
	const client = useModuleClient();
	return {
		list: client.module("referrals").admin["/admin/referrals/codes"],
		deactivate:
			client.module("referrals").admin["/admin/referrals/codes/:id/deactivate"],
	};
}

export function CodeList() {
	const api = useCodesAdminApi();
	const [page, setPage] = useState(1);
	const [activeFilter, setActiveFilter] = useState("");

	const queryInput = {
		page,
		limit: 25,
		...(activeFilter ? { active: activeFilter } : {}),
	};

	const {
		data,
		isLoading: loading,
		isError: codesError,
		refetch: refetchCodes,
	} = api.list.useQuery(queryInput) as {
		data: { codes: ReferralCodeItem[]; total: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const deactivateMutation = api.deactivate.useMutation({
		onSuccess: () => void api.list.invalidate(),
	});

	if (codesError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load referral codes
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchCodes()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const codes = data?.codes ?? [];

	return (
		<CodeListTemplate
			codes={codes}
			loading={loading}
			page={page}
			onPageChange={setPage}
			activeFilter={activeFilter}
			onActiveFilterChange={setActiveFilter}
			onDeactivate={(id: string) => deactivateMutation.mutate({ id })}
		/>
	);
}
