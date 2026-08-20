"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function usePhotoBoothStoreApi() {
	const client = useModuleClient();
	return {
		listPhotos: client.module("photo-booth").store["/photo-booth/photos"],
		streamPhotos: client.module("photo-booth").store["/photo-booth/stream/:id"],
		capture: client.module("photo-booth").store["/photo-booth/capture"],
		send: client.module("photo-booth").store["/photo-booth/send"],
	};
}
