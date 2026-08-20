import type { ModuleController } from "@86d-app/core/types/module";

export type MetaTag = {
	id: string;
	path: string;
	title?: string | undefined;
	description?: string | undefined;
	canonicalUrl?: string | undefined;
	ogTitle?: string | undefined;
	ogDescription?: string | undefined;
	ogImage?: string | undefined;
	ogType?: string | undefined;
	twitterCard?: string | undefined;
	twitterTitle?: string | undefined;
	twitterDescription?: string | undefined;
	twitterImage?: string | undefined;
	noIndex: boolean;
	noFollow: boolean;
	jsonLd?: Record<string, unknown> | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type RedirectStatusCode = 301 | 302 | 307 | 308;

export type Redirect = {
	id: string;
	fromPath: string;
	toPath: string;
	statusCode: RedirectStatusCode;
	active: boolean;
	createdAt: Date;
	updatedAt: Date;
};

export type SeoController = ModuleController & {
	// Meta tags
	upsertMetaTag(params: {
		path: string;
		title?: string | undefined;
		description?: string | undefined;
		canonicalUrl?: string | undefined;
		ogTitle?: string | undefined;
		ogDescription?: string | undefined;
		ogImage?: string | undefined;
		ogType?: string | undefined;
		twitterCard?: string | undefined;
		twitterTitle?: string | undefined;
		twitterDescription?: string | undefined;
		twitterImage?: string | undefined;
		noIndex?: boolean | undefined;
		noFollow?: boolean | undefined;
		jsonLd?: Record<string, unknown> | undefined;
	}): Promise<MetaTag>;

	getMetaTagByPath(path: string): Promise<MetaTag | null>;

	getMetaTag(id: string): Promise<MetaTag | null>;

	deleteMetaTag(id: string): Promise<boolean>;

	listMetaTags(params?: {
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<MetaTag[]>;

	// Redirects
	createRedirect(params: {
		fromPath: string;
		toPath: string;
		statusCode?: RedirectStatusCode | undefined;
	}): Promise<Redirect>;

	updateRedirect(
		id: string,
		params: {
			fromPath?: string | undefined;
			toPath?: string | undefined;
			statusCode?: RedirectStatusCode | undefined;
			active?: boolean | undefined;
		},
	): Promise<Redirect | null>;

	deleteRedirect(id: string): Promise<boolean>;

	getRedirect(id: string): Promise<Redirect | null>;

	getRedirectByPath(fromPath: string): Promise<Redirect | null>;

	listRedirects(params?: {
		active?: boolean | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<Redirect[]>;

	// Sitemap
	getSitemapEntries(): Promise<
		Array<{ path: string; lastModified?: Date | undefined }>
	>;
};
