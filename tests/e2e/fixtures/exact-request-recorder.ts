export function createExactlyOnceRequestRecorder(label: string) {
	const requests: URL[] = [];

	return {
		record(rawUrl: string): void {
			if (requests.length > 0) {
				throw new Error(`${label} request was issued more than once`);
			}
			requests.push(new URL(rawUrl));
		},
		all(): readonly URL[] {
			return [...requests];
		},
		only(): URL {
			const onlyRequest = requests[0];
			if (requests.length !== 1 || !onlyRequest) {
				throw new Error(
					`Expected exactly one ${label} request, received ${requests.length}`,
				);
			}
			return onlyRequest;
		},
	};
}

export function assertCanonicalBasePriceRequest(url: URL): number {
	const entries = [...url.searchParams.entries()];
	const basePrice = entries[0]?.[1];
	if (
		entries.length !== 1 ||
		entries[0]?.[0] !== "basePrice" ||
		basePrice === undefined ||
		!/^(?:0|[1-9]\d*)$/.test(basePrice) ||
		url.search !== `?basePrice=${basePrice}`
	) {
		throw new Error(
			`Bulk Pricing tiers request must contain only one canonical basePrice: ${url.toString()}`,
		);
	}

	const numericBasePrice = Number(basePrice);
	if (!Number.isSafeInteger(numericBasePrice)) {
		throw new Error(
			`Bulk Pricing basePrice must be safe integer cents: ${basePrice}`,
		);
	}
	return numericBasePrice;
}
