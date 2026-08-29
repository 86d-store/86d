import { Badge } from "@86d-app/ui/badge";
import type { LegacySessionStatus } from "./kiosk-admin-types";

const kioskDateFormatter = new Intl.DateTimeFormat("en-US", {
	year: "numeric",
	month: "short",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
	timeZone: "UTC",
});

export function formatKioskDate(dateValue: string) {
	const date = new Date(dateValue);
	return Number.isNaN(date.getTime())
		? "Unknown date"
		: kioskDateFormatter.format(date);
}

export function StationRegistrationBadge({ enabled }: { enabled: boolean }) {
	return (
		<Badge variant={enabled ? "constructive" : "secondary"}>
			{enabled ? "Enabled" : "Disabled"}
		</Badge>
	);
}

const SESSION_STATUS_LABELS: Record<LegacySessionStatus, string> = {
	"legacy-active": "Legacy active",
	"legacy-completed": "Legacy completed",
	"legacy-abandoned": "Legacy abandoned",
	"legacy-timed-out": "Legacy timed out",
};

export function SessionStatusBadge({
	status,
}: {
	status: LegacySessionStatus;
}) {
	const variant =
		status === "legacy-active"
			? "constructive"
			: status === "legacy-abandoned" || status === "legacy-timed-out"
				? "caution"
				: "secondary";
	return <Badge variant={variant}>{SESSION_STATUS_LABELS[status]}</Badge>;
}
