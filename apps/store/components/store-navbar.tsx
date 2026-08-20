"use client";

import { useTheme } from "next-themes";
import type React from "react";
import { useCallback, useState } from "react";
import {
	useKeyPressEvent,
	useLockBodyScroll,
	useWindowScroll,
} from "react-use";
import NavbarTemplate from "template/navbar.mdx";

interface NavItem {
	label: string;
	href: string;
}

interface StoreNavbarProps {
	config: {
		name: string;
		logo: { light: string; dark: string };
	};
	navItems: NavItem[];
	actions?: React.ReactNode;
}

export function StoreNavbar({ config, navItems, actions }: StoreNavbarProps) {
	const [isOpen, setIsOpen] = useState(false);
	const { y } = useWindowScroll();
	const { setTheme } = useTheme();

	useLockBodyScroll(isOpen);

	useKeyPressEvent("Escape", () => setIsOpen(false));

	const scrolled = y > 8;

	const handleNavClick = useCallback(() => setIsOpen(false), []);

	const toggleMenu = useCallback(() => setIsOpen((prev) => !prev), []);

	return (
		<NavbarTemplate
			logoLight={config.logo.light}
			logoDark={config.logo.dark}
			storeName={config.name}
			navItems={navItems}
			actions={actions}
			scrolled={scrolled}
			isOpen={isOpen}
			handleNavClick={handleNavClick}
			toggleMenu={toggleMenu}
			setTheme={setTheme}
		/>
	);
}
