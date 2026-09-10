"use client";

import { useSidebar } from "@86d-store/ui/shadcn/sidebar";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
	ADMIN_NAVIGATION_STORAGE_KEY,
	type AdminNavigationSection,
	buildAdminNavigation,
	parseCollapsedNavigation,
} from "~/lib/admin-navigation";
import type { AdminNavGroup } from "~/lib/admin-registry";

export interface AdminNavigationSectionView extends AdminNavigationSection {
	onOpenChange: () => void;
	sections: AdminNavigationSectionView[];
}

export function useAdminNavigation(groups: AdminNavGroup[]) {
	const pathname = usePathname();
	const { isMobile, open, openMobile, setOpenMobile, toggleSidebar } =
		useSidebar();
	const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
	const [storageLoaded, setStorageLoaded] = useState(false);
	const [search, setSearch] = useState("");
	const navigation = buildAdminNavigation(groups, pathname, collapsed, search);

	const handleNavigate = useCallback(() => {
		setOpenMobile(false);
	}, [setOpenMobile]);
	const handleSearch = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			setSearch(event.target.value);
		},
		[],
	);
	const handleToggleSection = useCallback((id: string) => {
		setCollapsed((previous) => {
			const next = new Set(previous);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}, []);
	const connectSection = (
		section: AdminNavigationSection,
	): AdminNavigationSectionView => ({
		...section,
		onOpenChange: () => handleToggleSection(section.id),
		sections: section.sections.map(connectSection),
	});

	useEffect(() => {
		try {
			setCollapsed(
				parseCollapsedNavigation(
					localStorage.getItem(ADMIN_NAVIGATION_STORAGE_KEY),
				),
			);
		} catch {
			// Navigation remains usable when browser storage is unavailable.
		}
		setStorageLoaded(true);
	}, []);

	useEffect(() => {
		if (!storageLoaded) return;
		try {
			localStorage.setItem(
				ADMIN_NAVIGATION_STORAGE_KEY,
				JSON.stringify([...collapsed]),
			);
		} catch {
			// Navigation remains usable when browser storage is unavailable.
		}
	}, [collapsed, storageLoaded]);

	return {
		...navigation,
		sections: navigation.sections.map(connectSection),
		search,
		pageLabel: navigation.activeItem?.label ?? "Store admin",
		showBreadcrumbRoot: navigation.activeItem != null,
		isNavigationOpen: isMobile ? openMobile : open,
		onSearch: handleSearch,
		onNavigate: handleNavigate,
		onToggleNavigation: toggleSidebar,
	};
}
