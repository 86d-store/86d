const CARRIER_URLS: Record<string, string> = {
	ups: "https://www.ups.com/track?tracknum=",
	fedex: "https://www.fedex.com/fedextrack/?trknbr=",
	usps: "https://tools.usps.com/go/TrackConfirmAction?tLabels=",
	dhl: "https://www.dhl.com/en/express/tracking.html?AWB=",
};

export function getTrackingUrl(
	carrier: string,
	trackingNumber: string,
): string | null {
	const baseUrl = CARRIER_URLS[carrier.toLowerCase()];
	if (!baseUrl) return null;
	return `${baseUrl}${encodeURIComponent(trackingNumber)}`;
}
