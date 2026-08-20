import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { toMarkdownBlogListing, toMarkdownBlogPost } from "./markdown";
import { blogSchema } from "./schema";
import { createBlogController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	BlogController,
	BlogPost,
	PostStats,
	PostStatus,
} from "./service";

export interface BlogOptions extends ModuleConfig {
	/** Default number of posts per page (default: "20") */
	postsPerPage?: string;
}

export default function blog(options?: BlogOptions): Module {
	return {
		id: "blog",
		version: "0.1.0",
		schema: blogSchema,
		exports: {
			read: [
				"postTitle",
				"postSlug",
				"postExcerpt",
				"postCategory",
				"postTags",
				"postFeatured",
			],
		},
		events: {
			emits: [
				"blog.published",
				"blog.unpublished",
				"blog.deleted",
				"blog.scheduled",
				"blog.featured",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createBlogController(ctx.data);
			return { controllers: { blog: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/blog",
					component: "BlogAdmin",
					label: "Blog",
					icon: "Article",
					group: "Content",
				},
			],
		},
		store: {
			pages: [
				{
					path: "/blog",
					component: "BlogList",
					toMarkdown: toMarkdownBlogListing,
				},
				{
					path: "/blog/:slug",
					component: "BlogPostDetail",
					toMarkdown: toMarkdownBlogPost,
				},
			],
		},
		options,
	};
}
