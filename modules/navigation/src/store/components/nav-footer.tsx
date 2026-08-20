"use client";

import { useNavigationApi } from "./_hooks";
import NavFooterTemplate from "./nav-footer.mdx";

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

export function NavFooter({
	location = "footer",
}: {
	location?: string | undefined;
}) {
	const api = useNavigationApi();

	const { data, isLoading } = api.getByLocation.useQuery({
		params: { location },
	}) as {
		data: { menu: MenuWithItemsResponse | null } | undefined;
		isLoading: boolean;
	};

	const menu = data?.menu ?? null;
	const items = menu?.items ?? [];

	const columns = items.map((item) => ({
		...item,
		href: resolveUrl(item),
		children: item.children.map((child) => ({
			...child,
			href: resolveUrl(child),
		})),
	}));

	return (
		<NavFooterTemplate
			isLoading={isLoading}
			columns={columns}
			menuName={menu?.name ?? ""}
		/>
	);
}
