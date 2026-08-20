"use client";

import { usePhotoBoothStoreApi } from "./_hooks";
import PhotoStreamTemplate from "./photo-stream.mdx";

interface Photo {
	id: string;
	imageUrl: string;
	thumbnailUrl?: string | undefined;
	caption?: string | undefined;
	tags: string[];
	createdAt: string;
}

export interface PhotoStreamProps {
	/** Stream ID to display */
	streamId: string;
	/** Auto-refresh interval in milliseconds (0 = no auto-refresh, default: 10000) */
	refreshInterval?: number;
}

export function PhotoStream({
	streamId,
	refreshInterval = 10000,
}: PhotoStreamProps) {
	const api = usePhotoBoothStoreApi();

	const streamQuery = api.streamPhotos.useQuery(
		{ params: { id: streamId }, limit: "50" },
		{
			refetchInterval: refreshInterval > 0 ? refreshInterval : false,
		},
	) as {
		data: { photos?: Photo[] } | undefined;
		isLoading: boolean;
		error: Error | null;
	};

	const photos = streamQuery.data?.photos ?? [];

	return (
		<PhotoStreamTemplate
			isLoading={streamQuery.isLoading}
			photos={photos}
			hasError={Boolean(streamQuery.error)}
		/>
	);
}
