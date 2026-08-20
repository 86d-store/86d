"use client";

import { useCallback, useState } from "react";
import { useNavigationApi } from "./_hooks";
import NavMobileMenuTemplate from "./nav-mobile-menu.mdx";

interface MenuItemNode {
	id: string;
	label: string;
	type: string;
	url?: string | null;
	resourceId?: string | null;
	openInNewTab: boolean;
	cssClass?: string | null;
	children: MenuItemNode[];
}

interface MenuWithItemsResponse {
	id: string;
	name: string;
	slug: string;
	location: string;
	items: MenuItemNode[];
}

function resolveUrl(item: MenuItemNode): string {
	if (item.url) return item.url;
	if (!item.resourceId) return "#";
	switch (item.type) {
		case "category":
			return `/products?category=${item.resourceId}`;
		case "collection":
			return `/collections/${item.resourceId}`;
		case "page":
			return `/p/${item.resourceId}`;
		case "product":
			return `/products/${item.resourceId}`;
		default:
			return "#";
	}
}

export function NavMobileMenu({
	location = "mobile",
}: {
	location?: string | undefined;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const api = useNavigationApi();

	const { data, isLoading } = api.getByLocation.useQuery({
		params: { location },
	}) as {
		data: { menu: MenuWithItemsResponse | null } | undefined;
		isLoading: boolean;
	};

	const menu = data?.menu ?? null;
	const items = menu?.items ?? [];

	const resolvedItems = items.map((item) => ({
		...item,
		href: resolveUrl(item),
		children: item.children.map((child) => ({
			...child,
			href: resolveUrl(child),
		})),
	}));

	const toggleOpen = useCallback(() => setIsOpen((v) => !v), []);
	const close = useCallback(() => {
		setIsOpen(false);
		setExpandedId(null);
	}, []);
	const toggleExpand = useCallback(
		(id: string) => setExpandedId((v) => (v === id ? null : id)),
		[],
	);

	return (
		<NavMobileMenuTemplate
			isOpen={isOpen}
			isLoading={isLoading}
			items={resolvedItems}
			expandedId={expandedId}
			onToggle={toggleOpen}
			onClose={close}
			onToggleExpand={toggleExpand}
		/>
	);
}
