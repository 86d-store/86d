import type { ModuleController } from "@86d-app/core/types/module";

export type Redirect = {
	id: string;
	sourcePath: string;
	targetPath: string;
	statusCode: number;
	isActive: boolean;
	isRegex: boolean;
	preserveQueryString: boolean;
	note?: string;
	hitCount: number;
	lastHitAt?: Date;
	createdAt: Date;
	updatedAt: Date;
};

export type RedirectStats = {
	totalRedirects: number;
	activeRedirects: number;
	totalHits: number;
	topRedirects: Array<{
		id: string;
		sourcePath: string;
		targetPath: string;
		hitCount: number;
	}>;
};

export type RedirectController = ModuleController & {
	createRedirect(params: {
		sourcePath: string;
		targetPath: string;
		statusCode?: number;
		isActive?: boolean;
		isRegex?: boolean;
		preserveQueryString?: boolean;
		note?: string;
	}): Promise<Redirect>;

	getRedirect(id: string): Promise<Redirect | null>;

	updateRedirect(
		id: string,
		params: {
			sourcePath?: string;
			targetPath?: string;
			statusCode?: number;
			isActive?: boolean;
			isRegex?: boolean;
			preserveQueryString?: boolean;
			note?: string | null;
		},
	): Promise<Redirect | null>;

	deleteRedirect(id: string): Promise<boolean>;

	listRedirects(params?: {
		isActive?: boolean;
		statusCode?: number;
		search?: string;
		take?: number;
		skip?: number;
	}): Promise<Redirect[]>;

	countRedirects(params?: {
		isActive?: boolean;
		statusCode?: number;
		search?: string;
	}): Promise<number>;

	/**
	 * Resolve a request path to its redirect target.
	 * Checks exact matches first, then regex patterns.
	 * Returns null if no matching redirect is found.
	 */
	resolve(path: string): Promise<{
		targetPath: string;
		statusCode: number;
		preserveQueryString: boolean;
	} | null>;

	/**
	 * Record a hit on a redirect (increment hitCount, update lastHitAt).
	 */
	recordHit(id: string): Promise<void>;

	/**
	 * Delete multiple redirects at once.
	 */
	bulkDelete(ids: string[]): Promise<number>;

	/**
	 * Test whether a path would match any redirect rule.
	 */
	testPath(path: string): Promise<{
		matched: boolean;
		redirect?: Redirect;
	}>;

	getStats(): Promise<RedirectStats>;
};
