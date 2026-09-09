import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

type StatusVariant =
	| "constructive"
	| "caution"
	| "destructive"
	| "primary"
	| "neutral";

const variantStyles: Record<StatusVariant, string> = {
	constructive: "bg-constructive-50 text-constructive-600",
	caution: "bg-caution-50 text-caution-600",
	destructive: "bg-destructive-50 text-destructive-600",
	primary: "bg-primary-50 text-primary-600",
	neutral: "bg-secondary text-secondary-foreground",
};

const defaultStatusMap: Record<string, StatusVariant> = {
	completed: "constructive",
	paid: "constructive",
	approved: "constructive",
	active: "constructive",
	delivered: "constructive",
	succeeded: "constructive",
	fulfilled: "constructive",
	confirmed: "constructive",
	ready: "constructive",
	verified: "constructive",
	resolved: "constructive",
	pending: "caution",
	past_due: "caution",
	partially_paid: "caution",
	partially_fulfilled: "caution",
	unfulfilled: "caution",
	on_hold: "caution",
	limit_reached: "caution",
	requested: "caution",
	paused: "caution",
	expired: "caution",
	overdue: "caution",
	requires_action: "caution",
	"no-show": "caution",
	cancelled: "destructive",
	rejected: "destructive",
	revoked: "destructive",
	unpaid: "destructive",
	voided: "destructive",
	void: "destructive",
	failed: "destructive",
	error: "destructive",
	processing: "primary",
	trialing: "primary",
	shipped: "primary",
	in_transit: "primary",
	shipped_back: "primary",
	received: "primary",
	refunded: "primary",
	sent: "primary",
	viewed: "primary",
	accepted: "primary",
	assigned: "primary",
	picked_up: "primary",
};

function StatusBadge({
	status,
	label,
	variant: overrideVariant,
	className,
}: {
	status: string;
	label?: string;
	variant?: StatusVariant;
	className?: string;
}) {
	const variant = overrideVariant ?? defaultStatusMap[status] ?? "neutral";
	return (
		<Badge
			variant="secondary"
			className={cn(variantStyles[variant], className)}
		>
			{label ?? status.replace(/_/g, " ")}
		</Badge>
	);
}

export { StatusBadge, type StatusVariant };
