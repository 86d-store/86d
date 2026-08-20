"use client";

import type { MDXComponents } from "mdx/types";
import { DownloadButton } from "./download-button";
import { DownloadRow } from "./download-row";
import { MyDownloads } from "./my-downloads";

export default {
	MyDownloads,
	DownloadButton,
	DownloadRow,
} satisfies MDXComponents;
