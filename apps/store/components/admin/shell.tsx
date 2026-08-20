"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { IconName } from "~/components/icon/icon";
import { Icon } from "~/components/icon/icon";
import type {
	AdminNavGroup,
	AdminNavItem,
	AdminNavSubGroup,
} from "~/lib/admin-registry";

const DASHBOARD_ITEM: AdminNavItem = {
	label: "Dashboard",
	href: "/admin",
	icon: "SquaresFour",
};

const STORAGE_KEY = "86d-admin-sidebar-collapsed";

function loadCollapsedSections(): Set<string> {
	if (typeof window === "undefined") return new Set();
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) return new Set(JSON.parse(raw) as string[]);
	} catch {
		// ignore
	}
	return new Set();
}

function saveCollapsedSections(collapsed: Set<string>) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify([...collapsed]));
	} catch {
		// ignore
	}
}

function isItemActive(href: string, pathname: string): boolean {
	return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function NavLink({
	item,
	isActive,
	onClose,
	indent,
}: {
	item: AdminNavItem;
	isActive: boolean;
	onClose?: (() => void) | undefined;
	indent?: boolean;
}) {
	return (
		<a
			href={item.href}
			onClick={onClose}
			className={`flex items-center gap-2.5 rounded-md py-1.5 font-medium text-sm transition-colors ${
				indent ? "pr-3 pl-9" : "px-3"
			} ${
				isActive
					? "bg-muted text-foreground"
					: "text-muted-foreground hover:bg-muted hover:text-foreground"
			}`}
		>
			{item.icon ? (
				<Icon name={item.icon as IconName} className="size-4 shrink-0" />
			) : null}
			{item.label}
		</a>
	);
}

function CollapsibleSubGroup({
	subgroup,
	pathname,
	collapsed,
	onToggle,
	onClose,
}: {
	subgroup: AdminNavSubGroup;
	pathname: string;
	collapsed: boolean;
	onToggle: () => void;
	onClose?: () => void;
}) {
	const hasActiveItem = subgroup.items.some((item) =>
		isItemActive(item.href, pathname),
	);

	// Auto-expand if an item in this subgroup is active
	const isOpen = hasActiveItem || !collapsed;

	return (
		<div className="pt-0.5">
			<button
				type="button"
				onClick={onToggle}
				aria-expanded={isOpen}
				className="flex w-full items-center gap-2 rounded-md px-3 py-1 text-left transition-colors hover:bg-muted/50"
			>
				{subgroup.icon ? (
					<Icon
						name={subgroup.icon as IconName}
						className="size-3 shrink-0 text-muted-foreground/70"
					/>
				) : null}
				<span className="flex-1 font-medium text-muted-foreground text-xs">
					{subgroup.label}
				</span>
				<Icon
					name="chevron-right"
					className={`size-2.5 shrink-0 text-muted-foreground/50 transition-transform duration-200 ${
						isOpen ? "rotate-90" : ""
					}`}
				/>
			</button>
			{isOpen ? (
				<div className="mt-0.5">
					{subgroup.items.map((item) => (
						<NavLink
							key={item.href + item.label}
							item={item}
							isActive={isItemActive(item.href, pathname)}
							indent
							{...(onClose !== undefined ? { onClose } : {})}
						/>
					))}
				</div>
			) : null}
		</div>
	);
}

function CollapsibleGroup({
	group,
	pathname,
	collapsed,
	onToggle,
	onToggleSubGroup,
	collapsedSections,
	onClose,
}: {
	group: AdminNavGroup;
	pathname: string;
	collapsed: boolean;
	onToggle: () => void;
	onToggleSubGroup: (key: string) => void;
	collapsedSections: Set<string>;
	onClose?: () => void;
}) {
	const hasActiveDirectItem = group.items.some((item) =>
		isItemActive(item.href, pathname),
	);
	const hasActiveSubGroupItem = group.subgroups.some((sg) =>
		sg.items.some((item) => isItemActive(item.href, pathname)),
	);
	const hasActiveItem = hasActiveDirectItem || hasActiveSubGroupItem;

	// Auto-expand if an item in this group is active
	const isOpen = hasActiveItem || !collapsed;

	const hasSubGroups = group.subgroups.length > 0;

	return (
		<div className="pt-1">
			<button
				type="button"
				onClick={onToggle}
				aria-expanded={isOpen}
				className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left transition-colors hover:bg-muted"
			>
				{group.icon ? (
					<Icon
						name={group.icon as IconName}
						className="size-3.5 shrink-0 text-muted-foreground"
					/>
				) : null}
				<span className="flex-1 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
					{group.label}
				</span>
				<Icon
					name="chevron-right"
					className={`size-3 shrink-0 text-muted-foreground transition-transform duration-200 ${
						isOpen ? "rotate-90" : ""
					}`}
				/>
			</button>
			{isOpen ? (
				<div className="mt-0.5">
					{/* Direct items (not in any subgroup) */}
					{group.items.map((item) => (
						<NavLink
							key={item.href + item.label}
							item={item}
							isActive={isItemActive(item.href, pathname)}
							{...(hasSubGroups ? { indent: false } : {})}
							{...(onClose !== undefined ? { onClose } : {})}
						/>
					))}
					{/* Subgroups */}
					{group.subgroups.map((sg) => {
						const sgKey = `${group.label}:${sg.label}`;
						return (
							<CollapsibleSubGroup
								key={sgKey}
								subgroup={sg}
								pathname={pathname}
								collapsed={collapsedSections.has(sgKey)}
								onToggle={() => onToggleSubGroup(sgKey)}
								{...(onClose !== undefined ? { onClose } : {})}
							/>
						);
					})}
				</div>
			) : null}
		</div>
	);
}

function Sidebar({
	navGroups,
	onClose,
}: {
	navGroups: AdminNavGroup[];
	onClose?: () => void;
}) {
	const pathname = usePathname();
	const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
		() => new Set(),
	);

	// Load persisted state on mount
	useEffect(() => {
		setCollapsedSections(loadCollapsedSections());
	}, []);

	const toggleSection = useCallback((key: string) => {
		setCollapsedSections((prev) => {
			const next = new Set(prev);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			saveCollapsedSections(next);
			return next;
		});
	}, []);

	return (
		<aside
			aria-label="Store administration"
			className="flex h-full w-60 flex-col border-border border-r bg-background"
		>
			{/* Logo */}
			<div className="flex h-14 items-center border-border border-b px-4">
				<a href="/" className="flex items-center gap-2">
					<img
						src="/assets/icon/light.svg"
						alt="Store"
						className="h-6 w-auto dark:hidden"
					/>
					<img
						src="/assets/icon/dark.svg"
						alt="Store"
						className="hidden h-6 w-auto dark:block"
					/>
					<span className="font-semibold text-foreground text-sm">Admin</span>
				</a>
			</div>

			{/* Nav */}
			<nav
				aria-label="Admin navigation"
				className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3"
			>
				{/* Dashboard */}
				<NavLink
					item={DASHBOARD_ITEM}
					isActive={pathname === "/admin"}
					{...(onClose !== undefined ? { onClose } : {})}
				/>
				{/* Module items by group */}
				{navGroups.map((group) =>
					group.label ? (
						<CollapsibleGroup
							key={group.label}
							group={group}
							pathname={pathname}
							collapsed={collapsedSections.has(group.label)}
							onToggle={() => toggleSection(group.label)}
							onToggleSubGroup={toggleSection}
							collapsedSections={collapsedSections}
							{...(onClose !== undefined ? { onClose } : {})}
						/>
					) : (
						// Ungrouped items rendered directly
						group.items.map((item) => (
							<NavLink
								key={item.href + item.label}
								item={item}
								isActive={isItemActive(item.href, pathname)}
								{...(onClose !== undefined ? { onClose } : {})}
							/>
						))
					),
				)}
			</nav>

			{/* Footer */}
			<div className="flex flex-col gap-1 border-border border-t p-3">
				<a
					href="/"
					className="flex items-center gap-2.5 rounded-md px-3 py-2 font-medium text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
				>
					<Icon name="House" className="size-4 shrink-0" />
					View store
				</a>
				<a
					href="/signout"
					className="flex items-center gap-2.5 rounded-md px-3 py-2 font-medium text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
				>
					<Icon name="SignOut" className="size-4 shrink-0" />
					Sign out
				</a>
			</div>
		</aside>
	);
}

export function AdminShell({
	navGroups,
	children,
}: {
	navGroups: AdminNavGroup[];
	children: React.ReactNode;
}) {
	const [sidebarOpen, setSidebarOpen] = useState(false);

	useEffect(() => {
		if (!sidebarOpen) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") setSidebarOpen(false);
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [sidebarOpen]);

	return (
		<div className="flex h-svh overflow-hidden bg-background">
			<a
				href="#admin-main"
				className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:font-medium focus:text-foreground focus:text-sm focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
			>
				Skip to main content
			</a>
			{/* Desktop sidebar */}
			<div className="hidden lg:flex lg:flex-shrink-0">
				<Sidebar navGroups={navGroups} />
			</div>

			{/* Mobile sidebar */}
			{sidebarOpen && (
				<>
					<div
						className="fixed inset-0 z-40 bg-black/50 lg:hidden"
						onClick={() => setSidebarOpen(false)}
						aria-hidden="true"
					/>
					<div className="fixed inset-y-0 left-0 z-50 lg:hidden">
						<Sidebar
							navGroups={navGroups}
							onClose={() => setSidebarOpen(false)}
						/>
					</div>
				</>
			)}

			{/* Main content */}
			<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
				{/* Mobile top bar */}
				<div className="flex h-14 items-center border-border border-b px-4 lg:hidden">
					<button
						type="button"
						onClick={() => setSidebarOpen(true)}
						className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
						aria-label="Open sidebar"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<line x1="4" x2="20" y1="12" y2="12" />
							<line x1="4" x2="20" y1="6" y2="6" />
							<line x1="4" x2="20" y1="18" y2="18" />
						</svg>
					</button>
					<span className="ml-3 font-semibold text-foreground text-sm">
						Admin
					</span>
				</div>

				<main id="admin-main" className="flex-1 overflow-y-auto p-6">
					{children}
				</main>
			</div>
		</div>
	);
}
