"use client";

import { usePathname } from "next/navigation";

interface AccountNavItem {
	label: string;
	href: string;
	icon: React.ReactNode;
}

const NAV_ITEMS: AccountNavItem[] = [
	{
		label: "Overview",
		href: "/account",
		icon: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<rect width="7" height="9" x="3" y="3" rx="1" />
				<rect width="7" height="5" x="14" y="3" rx="1" />
				<rect width="7" height="9" x="14" y="12" rx="1" />
				<rect width="7" height="5" x="3" y="16" rx="1" />
			</svg>
		),
	},
	{
		label: "Orders",
		href: "/account/orders",
		icon: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d="M16 16h6" />
				<path d="M16 20h6" />
				<path d="M16 12h6" />
				<path d="M10 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" />
				<path d="M10 4V2" />
				<path d="M10 4a2 2 0 0 1 0 4H4" />
			</svg>
		),
	},
	{
		label: "Appointments",
		href: "/account/appointments",
		icon: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
				<line x1="16" y1="2" x2="16" y2="6" />
				<line x1="8" y1="2" x2="8" y2="6" />
				<line x1="3" y1="10" x2="21" y2="10" />
				<path d="m9 16 2 2 4-4" />
			</svg>
		),
	},
	{
		label: "Returns",
		href: "/account/returns",
		icon: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d="M9 14 4 9l5-5" />
				<path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
			</svg>
		),
	},
	{
		label: "Reviews",
		href: "/account/reviews",
		icon: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
			</svg>
		),
	},
	{
		label: "Profile",
		href: "/account/profile",
		icon: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
				<circle cx="12" cy="7" r="4" />
			</svg>
		),
	},
	{
		label: "Addresses",
		href: "/account/addresses",
		icon: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
				<circle cx="12" cy="10" r="3" />
			</svg>
		),
	},
	{
		label: "Wishlist",
		href: "/account/wishlist",
		icon: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
			</svg>
		),
	},
	{
		label: "Subscriptions",
		href: "/account/subscriptions",
		icon: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
				<path d="m9 12 2 2 4-4" />
			</svg>
		),
	},
	{
		label: "Downloads",
		href: "/account/downloads",
		icon: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<polyline points="7 10 12 15 17 10" />
				<line x1="12" y1="15" x2="12" y2="3" />
			</svg>
		),
	},
	{
		label: "Pre-orders",
		href: "/account/preorders",
		icon: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d="M12 2v4" />
				<path d="M12 18v4" />
				<path d="M4.93 4.93l2.83 2.83" />
				<path d="M16.24 16.24l2.83 2.83" />
				<path d="M2 12h4" />
				<path d="M18 12h4" />
				<path d="M4.93 19.07l2.83-2.83" />
				<path d="M16.24 7.76l2.83-2.83" />
			</svg>
		),
	},
	{
		label: "Backorders",
		href: "/account/backorders",
		icon: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
				<path d="M3 3v5h5" />
				<path d="M12 7v5l4 2" />
			</svg>
		),
	},
	{
		label: "Store Credit",
		href: "/account/store-credits",
		icon: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<rect width="20" height="14" x="2" y="5" rx="2" />
				<line x1="2" y1="10" x2="22" y2="10" />
			</svg>
		),
	},
	{
		label: "Invoices",
		href: "/account/invoices",
		icon: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
				<polyline points="14 2 14 8 20 8" />
				<line x1="16" y1="13" x2="8" y2="13" />
				<line x1="16" y1="17" x2="8" y2="17" />
				<polyline points="10 9 9 9 8 9" />
			</svg>
		),
	},
	{
		label: "Warranties",
		href: "/account/warranties",
		icon: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
				<polyline points="9 12 11 14 15 10" />
			</svg>
		),
	},
	{
		label: "Payment Methods",
		href: "/account/payment-methods",
		icon: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<rect width="20" height="14" x="2" y="5" rx="2" />
				<line x1="2" y1="10" x2="22" y2="10" />
			</svg>
		),
	},
	{
		label: "Transactions",
		href: "/account/transactions",
		icon: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
			</svg>
		),
	},
];

function NavItem({
	item,
	isActive,
}: {
	item: AccountNavItem;
	isActive: boolean;
}) {
	return (
		<a
			href={item.href}
			className={`flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium text-sm transition-colors ${
				isActive
					? "bg-foreground text-background"
					: "text-muted-foreground hover:bg-muted hover:text-foreground"
			}`}
		>
			{item.icon}
			{item.label}
		</a>
	);
}

export function AccountShell({
	userName,
	userEmail,
	children,
}: {
	userName: string;
	userEmail: string;
	children: React.ReactNode;
}) {
	const pathname = usePathname();

	return (
		<div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
			{/* Mobile nav — horizontal scrollable */}
			<div className="mb-6 lg:hidden">
				<div className="mb-4">
					<h1 className="font-bold font-display text-foreground text-xl tracking-tight">
						My Account
					</h1>
					<p className="mt-0.5 text-muted-foreground text-sm">{userEmail}</p>
				</div>
				<nav
					className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 pb-2"
					aria-label="Account navigation"
				>
					{NAV_ITEMS.map((item) => {
						const isActive =
							item.href === "/account"
								? pathname === "/account"
								: pathname.startsWith(item.href);
						return (
							<a
								key={item.href}
								href={item.href}
								className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium text-sm transition-colors ${
									isActive
										? "border-foreground bg-foreground text-background"
										: "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
								}`}
							>
								{item.label}
							</a>
						);
					})}
				</nav>
			</div>

			<div className="flex gap-8 lg:gap-12">
				{/* Desktop sidebar */}
				<aside className="hidden w-52 shrink-0 lg:block">
					<div className="mb-6">
						<h1 className="font-bold font-display text-foreground text-xl tracking-tight">
							My Account
						</h1>
						<p className="mt-0.5 truncate text-muted-foreground text-sm">
							{userName}
						</p>
					</div>
					<nav
						className="flex flex-col gap-0.5"
						aria-label="Account navigation"
					>
						{NAV_ITEMS.map((item) => {
							const isActive =
								item.href === "/account"
									? pathname === "/account"
									: pathname.startsWith(item.href);
							return (
								<NavItem key={item.href} item={item} isActive={isActive} />
							);
						})}
					</nav>
					<div className="mt-6 border-border border-t pt-4">
						<a
							href="/signout"
							className="flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
							>
								<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
								<polyline points="16 17 21 12 16 7" />
								<line x1="21" y1="12" x2="9" y2="12" />
							</svg>
							Sign out
						</a>
					</div>
				</aside>

				{/* Main content */}
				<div className="min-w-0 flex-1">{children}</div>
			</div>
		</div>
	);
}
