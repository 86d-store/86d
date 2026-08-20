export function isCapabilityUnavailable(result: {
	ok: boolean;
	failure?: { code?: string } | undefined;
}): boolean {
	return !result.ok && result.failure?.code === "CAPABILITY_UNAVAILABLE";
}
