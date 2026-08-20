"use client";

import { observer } from "@86d-app/core/state";
import { useMediaApi } from "./_hooks";
import ImageDisplayTemplate from "./image-display.mdx";

export interface ImageDisplayProps {
	/** Asset ID to display */
	id: string;
	/** Optional CSS class for the container */
	className?: string;
	/** Show caption below the image */
	showCaption?: boolean;
}

/** Single image display — fetches an asset by ID, renders with alt text and optional caption. */
export const ImageDisplay = observer((props: ImageDisplayProps) => {
	const api = useMediaApi();

	const { data, isLoading, error } = api.getAsset.useQuery({
		queryKey: ["media", "image", props.id],
		params: { path: { id: props.id } },
	});

	const asset = data?.asset;

	return (
		<ImageDisplayTemplate
			loading={isLoading}
			error={error ? "Image not found." : ""}
			url={asset?.url ?? ""}
			alt={asset?.altText ?? asset?.name ?? ""}
			name={asset?.name ?? ""}
			width={asset?.width}
			height={asset?.height}
			className={props.className}
			showCaption={props.showCaption ?? false}
		/>
	);
});
