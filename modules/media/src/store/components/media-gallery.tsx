"use client";

import { observer } from "@86d-app/core/state";
import { useState } from "react";
import type { Asset } from "../../service";
import { useMediaApi } from "./_hooks";
import {
	assetLabel,
	formatFileSize,
	isImageMimeType,
	isVideoMimeType,
} from "./_utils";
import MediaGalleryTemplate from "./media-gallery.mdx";

export interface MediaGalleryProps {
	/** Filter by folder ID */
	folder?: string;
	/** Filter by MIME type prefix (e.g. "image", "video") */
	type?: string;
	/** Filter by tag */
	tag?: string;
	/** Number of items per page */
	pageSize?: number;
}

/** Filterable grid of media assets — images render as thumbnails, videos show poster frames. */
export const MediaGallery = observer((props: MediaGalleryProps) => {
	const api = useMediaApi();
	const [page, setPage] = useState(1);
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const limit = props.pageSize ?? 12;

	const mimeTypeFilter =
		props.type === "image"
			? "image/"
			: props.type === "video"
				? "video/"
				: props.type;

	const { data, isLoading, error } = api.listAssets.useQuery({
		queryKey: [
			"media",
			"gallery",
			props.folder,
			mimeTypeFilter,
			props.tag,
			page,
		],
		params: {
			query: {
				folder: props.folder,
				mimeType: mimeTypeFilter,
				tag: props.tag,
				page,
				limit,
			},
		},
	});

	const assets = ((data?.assets as Asset[] | undefined) ?? []).map((a) => ({
		id: a.id,
		name: a.name,
		url: a.url,
		altText: a.altText ?? a.name,
		mimeType: a.mimeType,
		isImage: isImageMimeType(a.mimeType),
		isVideo: isVideoMimeType(a.mimeType),
		typeLabel: assetLabel(a.mimeType),
		formattedSize: formatFileSize(a.size),
		width: a.width,
		height: a.height,
	}));

	const handlePrev = () => setPage((p) => Math.max(1, p - 1));
	const handleNext = () => {
		if (assets.length === limit) setPage((p) => p + 1);
	};

	return (
		<MediaGalleryTemplate
			assets={assets}
			loading={isLoading}
			error={error ? "Unable to load media." : ""}
			page={page}
			hasMore={assets.length === limit}
			selectedId={selectedId}
			onSelect={setSelectedId}
			onPrev={handlePrev}
			onNext={handleNext}
		/>
	);
});
