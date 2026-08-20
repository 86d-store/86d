export function extractError(error: Error | null, fallback: string): string {
	if (!error) return fallback;
	const body = (
		error as Error & { body?: { error?: string | { message?: string } } }
	).body;
	if (typeof body?.error === "string") return body.error;
	if (typeof body?.error?.message === "string") return body.error.message;
	return fallback;
}

export const GAME_LABELS: Record<string, { cta: string; label: string }> = {
	wheel: { cta: "Spin the wheel!", label: "Spin the Wheel" },
	scratch: { cta: "Scratch your card!", label: "Scratch Card" },
	slot: { cta: "Pull the lever!", label: "Slot Machine" },
};
