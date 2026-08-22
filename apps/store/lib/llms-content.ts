/**
 * Fetches store data and renders comprehensive markdown for llms-full.txt.
 * Delegates pure rendering to lib/llms-content for testability.
 */

import { getBaseUrl } from "utils/url";
import type { LlmsFullContent } from "../../../packages/lib/src/llms-content";
import { renderLlmsFullMarkdown } from "../../../packages/lib/src/llms-content";
import {
	fetchBlogPostsForLlms,
	fetchCollectionsForLlms,
	fetchProductsForLlms,
	getStoreName,
} from "./seo";
/**
 * Fetch all public store content for llms-full.txt.
 * Queries run in parallel for minimal latency.
 */
export async function fetchLlmsFullContent(): Promise<LlmsFullContent> {
	const [products, collections, blogPosts] = await Promise.all([
		fetchProductsForLlms(),
		fetchCollectionsForLlms(),
		fetchBlogPostsForLlms(),
	]);

	return { products, collections, blogPosts };
}

/**
 * Fetch content and render the full llms-full.txt markdown document.
 */
export async function generateLlmsFullMarkdown(): Promise<string> {
	const [content, storeName] = await Promise.all([
		fetchLlmsFullContent(),
		getStoreName(),
	]);
	return renderLlmsFullMarkdown(content, storeName, getBaseUrl());
}

export type { LlmsFullContent } from "../../../packages/lib/src/llms-content";
