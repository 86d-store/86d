"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import NavbarTemplate from "template/navbar.mdx";

export interface StoreNavItem {
	label: string;
	href: string;
}

export interface StoreNavbarProps {
	config: {
		name: string;
		logo: { light: string; dark: string };
	};
	navItems: StoreNavItem[];
	actions?: React.ReactNode;
}

export function StoreNavbar({ config, navItems, actions }: StoreNavbarProps) {
	const [isOpen, setIsOpen] = useState(false);
	const pathname = usePathname();
	const { setTheme } = useTheme();
	const items = navItems.map((item) => ({
		...item,
		active:
			!item.href.includes("?") &&
			(pathname === item.href || pathname.startsWith(`${item.href}/`)),
	}));

	const handleNavClick = useCallback(() => setIsOpen(false), []);
	const handleLightTheme = useCallback(() => setTheme("light"), [setTheme]);
	const handleDarkTheme = useCallback(() => setTheme("dark"), [setTheme]);

	useEffect(() => {
		const desktop = window.matchMedia("(min-width: 1024px)");
		const handleDesktopChange = () => {
			if (desktop.matches) setIsOpen(false);
		};
		desktop.addEventListener("change", handleDesktopChange);
		return () => desktop.removeEventListener("change", handleDesktopChange);
	}, []);

	return (
		<NavbarTemplate
			logoLight={config.logo.light}
			logoDark={config.logo.dark}
			storeName={config.name}
			navItems={items}
			actions={actions}
			isOpen={isOpen}
			onOpenChange={setIsOpen}
			handleNavClick={handleNavClick}
			handleLightTheme={handleLightTheme}
			handleDarkTheme={handleDarkTheme}
		/>
	);
}
