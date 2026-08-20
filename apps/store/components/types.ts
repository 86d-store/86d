import type React from "react";
import type { IconName } from "~/components/icon/icon";

export interface NavLogo {
	url: string;
	src: string;
	alt: string;
	title?: string;
	className?: string;
}

export interface NavAuth {
	login?: {
		title: string;
		url: string;
	};
	signup?: {
		title: string;
		url: string;
	};
}

export interface NavItem {
	title: string;
	url: string;
	description?: string;
	icon?: React.ReactNode | IconName;
	items?: NavItem[];
}

export interface NavLink {
	label: string;
	description?: string;
	url: string;
	icon?: React.ReactNode | IconName;
}

export interface NavGroup {
	title: string;
	links: NavLink[];
}

export interface NavMenuItemWithGroups {
	title: string;
	url?: string;
	groups?: NavGroup[];
}

export interface BaseNavbarProps {
	className?: string;
	logo?: NavLogo;
	auth?: NavAuth;
}

export interface NavbarWithItemsProps extends BaseNavbarProps {
	menu?: NavItem[];
}

export interface NavbarWithGroupsProps extends BaseNavbarProps {
	navigation?: NavMenuItemWithGroups[];
}
