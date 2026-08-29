import { Button } from "@86d-app/ui/button";
import type { GiftCardAdminRecord } from "./gift-card-admin-types";

export function GiftCardRowActions({
	card,
	onView,
	context = "table",
}: {
	card: GiftCardAdminRecord;
	onView: (id: string) => void;
	context?: "table" | "mobile";
}) {
	return (
		<Button
			type="button"
			variant="ghost"
			onClick={() => onView(card.id)}
			aria-label={`View details for ${card.code}`}
			data-testid={`gift-card-details-${context}-${card.id}`}
			className={context === "mobile" ? "min-h-11 w-full" : undefined}
		>
			Details
		</Button>
	);
}
