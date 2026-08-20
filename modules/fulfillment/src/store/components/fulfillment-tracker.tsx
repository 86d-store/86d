"use client";

import { observer } from "@86d-app/core/state";
import type { FulfillmentStatus } from "../../service";
import {
	formatDateTime,
	fulfillmentSteps,
	getStatusColor,
	getStatusLabel,
	getStepIndex,
} from "./_utils";
import FulfillmentTrackerTemplate from "./fulfillment-tracker.mdx";

export interface FulfillmentTrackerProps {
	/** Current fulfillment status. */
	status: FulfillmentStatus;
	/** When the fulfillment was created. */
	createdAt: string | Date;
	/** When it was shipped, if applicable. */
	shippedAt?: string | Date | null;
	/** When it was delivered, if applicable. */
	deliveredAt?: string | Date | null;
}

/** Visual timeline showing fulfillment progress through each stage. */
export const FulfillmentTracker = observer((props: FulfillmentTrackerProps) => {
	const isCancelled = props.status === "cancelled";
	const currentIdx = getStepIndex(props.status);

	const steps = fulfillmentSteps.map((step, i) => {
		let timestamp: string | undefined;
		if (step === "pending" && props.createdAt) {
			timestamp = formatDateTime(props.createdAt);
		} else if (step === "shipped" && props.shippedAt) {
			timestamp = formatDateTime(props.shippedAt);
		} else if (step === "delivered" && props.deliveredAt) {
			timestamp = formatDateTime(props.deliveredAt);
		}

		return {
			key: step,
			label: getStatusLabel(step),
			isCompleted: !isCancelled && i <= currentIdx,
			isCurrent: !isCancelled && i === currentIdx,
			timestamp,
		};
	});

	return (
		<FulfillmentTrackerTemplate
			steps={steps}
			isCancelled={isCancelled}
			cancelledLabel={getStatusLabel("cancelled")}
			cancelledColor={getStatusColor("cancelled")}
		/>
	);
});
