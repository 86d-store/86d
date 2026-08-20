"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useDownloadsApi() {
	const client = useModuleClient();
	return {
		listMyDownloads: client.module("digital-downloads").store["/downloads/me"],
		useDownload: client.module("digital-downloads").store["/downloads/:token"],
	};
}
