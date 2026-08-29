import { Badge } from "@86d-app/ui/badge";
import type { ComponentProps } from "react";
import { isGiftCardStatus } from "./gift-card-admin-types";
import { formatLegacyGiftCardValue } from "./gift-card-format";

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

function statusVariant(status: string): BadgeVariant {
	if (!isGiftCardStatus(status)) return "outline";
	if (status === "active") return "constructive";
	if (status === "expired") return "caution";
	if (status === "depleted") return "destructive";
	return "secondary";
}

export function GiftCardStatusBadge({ status }: { status: string }) {
	return (
		<Badge variant={statusVariant(status)} data-testid="gift-card-status">
			{formatLegacyGiftCardValue(status)}
		</Badge>
	);
}
