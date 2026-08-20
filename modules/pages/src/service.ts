import type { ModuleController } from "@86d-app/core/types/module";

export type PageStatus = "draft" | "published" | "archived";

export type Page = {
	id: string;
	title: string;
	slug: string;
	content: string;
	excerpt?: string | undefined;
	status: PageStatus;
	template?: string | undefined;
	metaTitle?: string | undefined;
	metaDescription?: string | undefined;
	featuredImage?: string | undefined;
	position: number;
	showInNavigation: boolean;
	parentId?: string | undefined;
	publishedAt?: Date | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type CreatePageParams = {
	title: string;
	slug?: string | undefined;
	content: string;
	excerpt?: string | undefined;
	status?: PageStatus | undefined;
	template?: string | undefined;
	metaTitle?: string | undefined;
	metaDescription?: string | undefined;
	featuredImage?: string | undefined;
	position?: number | undefined;
	showInNavigation?: boolean | undefined;
	parentId?: string | undefined;
};

export type UpdatePageParams = {
	title?: string | undefined;
	slug?: string | undefined;
	content?: string | undefined;
	excerpt?: string | undefined;
	status?: PageStatus | undefined;
	template?: string | undefined;
	metaTitle?: string | undefined;
	metaDescription?: string | undefined;
	featuredImage?: string | undefined;
	position?: number | undefined;
	showInNavigation?: boolean | undefined;
	parentId?: string | undefined;
};

export type PagesController = ModuleController & {
	createPage(params: CreatePageParams): Promise<Page>;

	updatePage(id: string, params: UpdatePageParams): Promise<Page | null>;

	deletePage(id: string): Promise<boolean>;

	getPage(id: string): Promise<Page | null>;

	getPageBySlug(slug: string): Promise<Page | null>;

	publishPage(id: string): Promise<Page | null>;

	unpublishPage(id: string): Promise<Page | null>;

	archivePage(id: string): Promise<Page | null>;

	listPages(params?: {
		status?: PageStatus | undefined;
		showInNavigation?: boolean | undefined;
		parentId?: string | null | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<Page[]>;

	getNavigationPages(): Promise<Page[]>;
};
