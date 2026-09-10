"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ChangeEvent, ReactNode } from "react";
import {
	accountNavigation,
	getAccountNavigationHref,
} from "./account-navigation";
import AccountShellTemplate from "./account-shell.mdx";

export interface AccountShellProps {
	userName: string;
	userEmail: string;
	children: ReactNode;
}

export function AccountShell(props: AccountShellProps) {
	const pathname = usePathname();
	const router = useRouter();
	const activeHref = getAccountNavigationHref(pathname);
	const groups = accountNavigation.map((group) => ({
		...group,
		items: group.items.map(({ icon: Icon, ...item }) => ({
			...item,
			active: item.href === activeHref,
			icon: (
				<Icon
					aria-hidden="true"
					className="size-4 shrink-0"
					strokeWidth={1.5}
				/>
			),
		})),
	}));

	function handleNavigate(event: ChangeEvent<HTMLSelectElement>) {
		const href = event.target.value;
		if (
			accountNavigation.some((group) =>
				group.items.some((item) => item.href === href),
			)
		) {
			router.push(href);
		}
	}

	return (
		<AccountShellTemplate
			{...props}
			groups={groups}
			activeHref={activeHref ?? ""}
			onNavigate={handleNavigate}
		/>
	);
}
