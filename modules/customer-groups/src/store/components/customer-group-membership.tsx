"use client";

import { useCustomerGroupApi } from "./_hooks";
import CustomerGroupMembershipTemplate from "./customer-group-membership.mdx";

interface CustomerGroup {
	id: string;
	name: string;
	slug: string;
	description?: string | undefined;
	type: "manual" | "automatic";
	isActive: boolean;
	priority: number;
}

export function CustomerGroupMembership() {
	const api = useCustomerGroupApi();

	const { data, isLoading, isError } = api.myGroups.useQuery({}) as {
		data: { groups: CustomerGroup[] } | undefined;
		isLoading: boolean;
		isError: boolean;
	};

	if (isLoading) {
		return (
			<div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800">
				<div className="animate-pulse space-y-3">
					<div className="h-4 w-36 rounded bg-muted dark:bg-muted" />
					<div className="h-10 w-full rounded-lg bg-muted dark:bg-muted" />
					<div className="h-10 w-full rounded-lg bg-muted dark:bg-muted" />
				</div>
			</div>
		);
	}

	if (isError) {
		return (
			<div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900/30 dark:bg-red-900/10">
				<p className="text-red-600 text-sm dark:text-red-400">
					Unable to load your group memberships. Please try again later.
				</p>
			</div>
		);
	}

	const groups = data?.groups ?? [];

	if (groups.length === 0) {
		return (
			<div className="rounded-xl border border-gray-200 bg-white p-6 text-center dark:border-gray-800">
				<p className="text-muted-foreground text-sm">
					You are not a member of any customer groups.
				</p>
			</div>
		);
	}

	const groupItems = groups.map((group) => ({
		id: group.id,
		name: group.name,
		slug: group.slug,
		description: group.description ?? null,
		type: group.type,
	}));

	return (
		<CustomerGroupMembershipTemplate
			groups={groupItems}
			count={groups.length}
		/>
	);
}
