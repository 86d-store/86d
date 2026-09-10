import {
	CalendarCheckIcon,
	ClockIcon,
	CreditCardIcon,
	DownloadIcon,
	HeartIcon,
	HistoryIcon,
	LayoutDashboardIcon,
	MapPinIcon,
	ReceiptIcon,
	RepeatIcon,
	ShieldCheckIcon,
	ShoppingBagIcon,
	StarIcon,
	Undo2Icon,
	UserRoundIcon,
	WalletIcon,
} from "lucide-react";

export const accountNavigation = [
	{
		label: "Shopping",
		items: [
			{ label: "Overview", href: "/account", icon: LayoutDashboardIcon },
			{ label: "Orders", href: "/account/orders", icon: ShoppingBagIcon },
			{ label: "Wishlist", href: "/account/wishlist", icon: HeartIcon },
			{ label: "Reviews", href: "/account/reviews", icon: StarIcon },
			{ label: "Returns", href: "/account/returns", icon: Undo2Icon },
			{
				label: "Appointments",
				href: "/account/appointments",
				icon: CalendarCheckIcon,
			},
			{
				label: "Subscriptions",
				href: "/account/subscriptions",
				icon: RepeatIcon,
			},
			{ label: "Downloads", href: "/account/downloads", icon: DownloadIcon },
			{ label: "Pre-orders", href: "/account/preorders", icon: ClockIcon },
			{ label: "Backorders", href: "/account/backorders", icon: HistoryIcon },
			{
				label: "Warranties",
				href: "/account/warranties",
				icon: ShieldCheckIcon,
			},
		],
	},
	{
		label: "Account",
		items: [
			{ label: "Profile", href: "/account/profile", icon: UserRoundIcon },
			{ label: "Addresses", href: "/account/addresses", icon: MapPinIcon },
			{
				label: "Store credit",
				href: "/account/store-credits",
				icon: WalletIcon,
			},
			{
				label: "Payment methods",
				href: "/account/payment-methods",
				icon: CreditCardIcon,
			},
			{ label: "Invoices", href: "/account/invoices", icon: ReceiptIcon },
			{
				label: "Transactions",
				href: "/account/transactions",
				icon: ReceiptIcon,
			},
		],
	},
];

export function getAccountNavigationHref(pathname: string): string | undefined {
	return accountNavigation
		.flatMap((group) => group.items)
		.find(
			(item) =>
				item.href === pathname ||
				(item.href !== "/account" && pathname.startsWith(`${item.href}/`)),
		)?.href;
}
