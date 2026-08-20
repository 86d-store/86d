"use client";

import { observer } from "@86d-app/core/state";
import { formatPrice } from "./_utils";
import ShippingRateSummaryTemplate from "./shipping-rate-summary.mdx";

export interface ShippingRateSummaryProps {
	/** Name of the selected shipping rate. */
	rateName: string;
	/** Name of the shipping zone. */
	zoneName?: string;
	/** Price in cents. */
	price: number;
}

/** Displays the selected shipping method and cost in an order summary. */
export const ShippingRateSummary = observer(
	(props: ShippingRateSummaryProps) => {
		return (
			<ShippingRateSummaryTemplate
				rateName={props.rateName}
				zoneName={props.zoneName}
				formattedPrice={props.price === 0 ? "Free" : formatPrice(props.price)}
				isFree={props.price === 0}
			/>
		);
	},
);
