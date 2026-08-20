"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useBlogApi() {
	const client = useModuleClient();
	return {
		listPosts: client.module("blog").store["/blog"],
		getPost: client.module("blog").store["/blog/:slug"],
	};
}
