"use client";

import { observer } from "@86d-app/core/state";
import type { FulfillmentStatus } from "../../service";
import { getStatusColor, getStatusLabel } from "./_utils";
import TrackingInfoTemplate from "./tracking-info.mdx";

export interface TrackingInfoProps {
	/** Current fulfillment status. */
	status: FulfillmentStatus;
	/** Carrier name (e.g. UPS, FedEx). */
	carrier?: string | null;
	/** Tracking number. */
	trackingNumber?: string | null;
	/** Full tracking URL. */
	trackingUrl?: string | null;
}

/** Compact tracking card showing carrier, tracking number, and status. */
export const TrackingInfo = observer((props: TrackingInfoProps) => {
	const hasTracking = Boolean(props.carrier || props.trackingNumber);

	return (
		<TrackingInfoTemplate
			statusLabel={getStatusLabel(props.status)}
			statusColor={getStatusColor(props.status)}
			carrier={props.carrier ?? null}
			trackingNumber={props.trackingNumber ?? null}
			trackingUrl={props.trackingUrl ?? null}
			hasTracking={hasTracking}
		/>
	);
});
