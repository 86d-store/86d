import type { ModuleController } from "@86d-app/core/types/module";

export type PostStatus = "draft" | "published" | "scheduled" | "archived";

export type BlogPost = {
	id: string;
	title: string;
	slug: string;
	content: string;
	excerpt?: string | undefined;
	coverImage?: string | undefined;
	author?: string | undefined;
	status: PostStatus;
	tags: string[];
	category?: string | undefined;
	featured: boolean;
	readingTime: number;
	metaTitle?: string | undefined;
	metaDescription?: string | undefined;
	scheduledAt?: Date | undefined;
	publishedAt?: Date | undefined;
	views: number;
	createdAt: Date;
	updatedAt: Date;
};

export type PostStats = {
	total: number;
	draft: number;
	published: number;
	scheduled: number;
	archived: number;
	totalViews: number;
	categories: Array<{ category: string; count: number }>;
	tags: Array<{ tag: string; count: number }>;
};

export type BlogController = ModuleController & {
	createPost(params: {
		title: string;
		slug: string;
		content: string;
		excerpt?: string | undefined;
		coverImage?: string | undefined;
		author?: string | undefined;
		status?: PostStatus | undefined;
		tags?: string[] | undefined;
		category?: string | undefined;
		featured?: boolean | undefined;
		metaTitle?: string | undefined;
		metaDescription?: string | undefined;
		scheduledAt?: Date | undefined;
	}): Promise<BlogPost>;

	updatePost(
		id: string,
		params: {
			title?: string | undefined;
			slug?: string | undefined;
			content?: string | undefined;
			excerpt?: string | undefined;
			coverImage?: string | undefined;
			author?: string | undefined;
			status?: PostStatus | undefined;
			tags?: string[] | undefined;
			category?: string | undefined;
			featured?: boolean | undefined;
			metaTitle?: string | undefined;
			metaDescription?: string | undefined;
			scheduledAt?: Date | undefined;
		},
	): Promise<BlogPost | null>;

	deletePost(id: string): Promise<boolean>;

	getPost(id: string): Promise<BlogPost | null>;

	getPostBySlug(slug: string): Promise<BlogPost | null>;

	publishPost(id: string): Promise<BlogPost | null>;

	unpublishPost(id: string): Promise<BlogPost | null>;

	archivePost(id: string): Promise<BlogPost | null>;

	duplicatePost(id: string): Promise<BlogPost | null>;

	incrementViews(id: string): Promise<BlogPost | null>;

	listPosts(params?: {
		status?: PostStatus | undefined;
		category?: string | undefined;
		tag?: string | undefined;
		featured?: boolean | undefined;
		search?: string | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<BlogPost[]>;

	getRelatedPosts(id: string, limit?: number): Promise<BlogPost[]>;

	getStats(): Promise<PostStats>;

	checkScheduledPosts(): Promise<BlogPost[]>;

	bulkUpdateStatus(
		ids: string[],
		status: PostStatus,
	): Promise<{ updated: number; failed: string[] }>;

	bulkDelete(ids: string[]): Promise<{ deleted: number; failed: string[] }>;
};
