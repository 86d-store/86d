"use client";

import type { MDXComponents } from "mdx/types";
import { ImageDisplay } from "./image-display";
import { MediaGallery } from "./media-gallery";
import { VideoPlayer } from "./video-player";

export default {
	MediaGallery,
	ImageDisplay,
	VideoPlayer,
} satisfies MDXComponents;
