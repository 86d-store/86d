"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useSeoApi() {
	const client = useModuleClient();
	return {
		getMeta: client.module("seo").store["/seo/meta"],
		getSitemap: client.module("seo").store["/seo/sitemap"],
	};
}
