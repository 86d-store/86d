export function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(iso));
}

export function isTokenUsable(token: {
	revokedAt?: string | null | undefined;
	expiresAt?: string | null | undefined;
	maxDownloads?: number | null | undefined;
	downloadCount: number;
}): boolean {
	if (token.revokedAt) return false;
	if (token.expiresAt && new Date(token.expiresAt) < new Date()) return false;
	if (token.maxDownloads != null && token.downloadCount >= token.maxDownloads) {
		return false;
	}
	return true;
}

export function tokenStatusLabel(token: {
	revokedAt?: string | null | undefined;
	expiresAt?: string | null | undefined;
	maxDownloads?: number | null | undefined;
	downloadCount: number;
}): { label: string; style: string } {
	if (token.revokedAt) {
		return {
			label: "Revoked",
			style: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
		};
	}
	if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
		return {
			label: "Expired",
			style: "bg-gray-50 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
		};
	}
	if (token.maxDownloads != null && token.downloadCount >= token.maxDownloads) {
		return {
			label: "Limit reached",
			style:
				"bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200",
		};
	}
	return {
		label: "Available",
		style:
			"bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
	};
}
