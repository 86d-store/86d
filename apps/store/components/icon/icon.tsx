import { icons } from "lucide-react";

export type IconName =
	| "home"
	| "settings"
	| "user"
	| "search"
	| "menu"
	| "x"
	| "chevron-down"
	| "chevron-right"
	| "plus"
	| "minus"
	| "check"
	| "alert-circle"
	| "info"
	| "trash"
	| "edit"
	| "eye"
	| "eye-off"
	| "copy"
	| "download"
	| "upload"
	| "external-link"
	| "arrow-left"
	| "arrow-right"
	| "shopping-cart"
	| "package"
	| "tag"
	| "heart"
	| "star"
	| "mail"
	| "bell"
	| "calendar"
	| "clock"
	| "map-pin"
	| "credit-card"
	| "truck"
	| "bar-chart"
	| "pie-chart"
	| "layers"
	| "grid"
	| "list"
	| "filter"
	| "sort"
	| (string & {});

/** Maps Phosphor icon names (used by modules) to Lucide equivalents */
const ALIASES: Record<string, string> = {
	SquaresFour: "LayoutGrid",
	SignOut: "LogOut",
	Envelope: "Mail",
	PaperPlaneTilt: "Send",
	CurrencyDollar: "DollarSign",
	ShoppingCartSimple: "ShoppingCart",
	Lightning: "Zap",
	BellRinging: "BellRing",
	ArrowUUpLeft: "Undo2",
	Article: "FileText",
	ChartBar: "BarChart3",
	Stack: "Layers",
	Warehouse: "Warehouse",
};

function toPascalCase(name: string): string {
	return name
		.split("-")
		.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
		.join("");
}

function resolveIcon(name: string) {
	const aliased = ALIASES[name];
	if (aliased) return icons[aliased as keyof typeof icons];

	const direct = icons[name as keyof typeof icons];
	if (direct) return direct;

	const pascal = toPascalCase(name);
	return icons[pascal as keyof typeof icons];
}

interface IconProps {
	name: IconName;
	className?: string;
	size?: number;
}

export function Icon({ name, className, size = 16 }: IconProps) {
	const LucideIcon = resolveIcon(name);
	if (!LucideIcon) {
		return (
			<span
				className={className}
				style={{ width: size, height: size, display: "inline-block" }}
				role="img"
				aria-label={name}
			/>
		);
	}
	return <LucideIcon className={className} size={size} />;
}
