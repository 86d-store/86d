"use client";

import { observer } from "@86d-app/core/state";
import { useMediaApi } from "./_hooks";
import VideoPlayerTemplate from "./video-player.mdx";

export interface VideoPlayerProps {
	/** Asset ID of the video */
	id: string;
	/** Auto-play (muted) when visible */
	autoPlay?: boolean;
	/** Loop playback */
	loop?: boolean;
	/** Optional CSS class for the container */
	className?: string;
}

/** Embedded video player — fetches a video asset by ID and renders native HTML5 video. */
export const VideoPlayer = observer((props: VideoPlayerProps) => {
	const api = useMediaApi();

	const { data, isLoading, error } = api.getAsset.useQuery({
		queryKey: ["media", "video", props.id],
		params: { path: { id: props.id } },
	});

	const asset = data?.asset;

	return (
		<VideoPlayerTemplate
			loading={isLoading}
			error={error ? "Video not found." : ""}
			url={asset?.url ?? ""}
			name={asset?.name ?? ""}
			mimeType={asset?.mimeType ?? "video/mp4"}
			autoPlay={props.autoPlay ?? false}
			loop={props.loop ?? false}
			className={props.className}
		/>
	);
});
