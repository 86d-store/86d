import type { AdminNavGroup, AdminNavItem } from "~/lib/admin-registry";

export const ADMIN_NAVIGATION_STORAGE_KEY = "86d-admin-sidebar-collapsed";

export interface AdminNavigationItem extends AdminNavItem {
	isActive: boolean;
}

export interface AdminNavigationSection {
	id: string;
	label: string;
	icon: string;
	isOpen: boolean;
	items: AdminNavigationItem[];
	sections: AdminNavigationSection[];
}

const dashboard: AdminNavItem = {
	label: "Overview",
	href: "/admin",
	icon: "SquaresFour",
};

const footerItems: AdminNavigationItem[] = [
	{ href: "/", label: "View storefront", icon: "House", isActive: false },
	{ href: "/signout", label: "Sign out", icon: "SignOut", isActive: false },
];

export function isAdminPathActive(href: string, pathname: string): boolean {
	const path = pathname.replace(/\/+$/, "") || "/";
	const target = href.replace(/\/+$/, "") || "/";
	return (
		path === target || (target !== "/admin" && path.startsWith(`${target}/`))
	);
}

export function parseCollapsedNavigation(raw: string | null): Set<string> {
	if (!raw) return new Set();
	try {
		const parsed: unknown = JSON.parse(raw);
		return new Set(
			Array.isArray(parsed)
				? parsed.filter((entry): entry is string => typeof entry === "string")
				: [],
		);
	} catch {
		return new Set();
	}
}

export function buildAdminNavigation(
	groups: AdminNavGroup[],
	pathname: string,
	collapsed: ReadonlySet<string>,
	search = "",
) {
	const allItems = [
		dashboard,
		...groups.flatMap((group) => [
			...group.items,
			...group.subgroups.flatMap((subgroup) => subgroup.items),
		]),
	];
	const activeItem = allItems
		.filter((item) => isAdminPathActive(item.href, pathname))
		.sort((left, right) => right.href.length - left.href.length)[0];
	const query = search.trim().toLocaleLowerCase();
	const matches = (label: string) => label.toLocaleLowerCase().includes(query);
	const resolveItems = (items: AdminNavItem[], parentMatches = false) =>
		items
			.filter((item) => parentMatches || matches(item.label))
			.map((item) => ({ ...item, isActive: item.href === activeItem?.href }));
	const sections: AdminNavigationSection[] = groups.flatMap((group) => {
		const groupMatches = matches(group.label);
		const items = resolveItems(group.items, groupMatches);
		const subgroups: AdminNavigationSection[] = group.subgroups.flatMap(
			(subgroup) => {
				const id = `${group.label}:${subgroup.label}`;
				const items = resolveItems(
					subgroup.items,
					groupMatches || matches(subgroup.label),
				);
				return items.length
					? [
							{
								id,
								label: subgroup.label,
								icon: subgroup.icon,
								isOpen:
									Boolean(query) ||
									!collapsed.has(id) ||
									items.some((item) => item.isActive),
								items,
								sections: [],
							},
						]
					: [];
			},
		);
		if (!items.length && !subgroups.length) return [];
		return [
			{
				id: group.label,
				label: group.label,
				icon: group.icon,
				isOpen:
					Boolean(query) ||
					!collapsed.has(group.label) ||
					items.some((item) => item.isActive) ||
					subgroups.some((section) =>
						section.items.some((item) => item.isActive),
					),
				items,
				sections: subgroups,
			},
		];
	});

	return {
		activeItem,
		items: resolveItems([dashboard]),
		sections,
		footerItems,
	};
}
