"use client";

import { useCallback, useState } from "react";
import { useDownloadsApi } from "./_hooks";
import DownloadButtonTemplate from "./download-button.mdx";

interface UseTokenResponse {
	ok: boolean;
	url?: string;
	reason?: string;
}

export function DownloadButton({
	token,
	label = "Download",
}: {
	token: string;
	label?: string | undefined;
}) {
	const api = useDownloadsApi();
	const [downloading, setDownloading] = useState(false);
	const [error, setError] = useState("");
	const [done, setDone] = useState(false);

	const handleDownload = useCallback(async () => {
		setDownloading(true);
		setError("");

		try {
			const data = (await api.useDownload.fetch({
				params: { token },
			})) as UseTokenResponse;

			if (data.ok && data.url) {
				window.open(data.url, "_blank", "noopener");
				setDone(true);
			} else {
				setError(data.reason ?? "Download failed.");
			}
		} catch {
			setError("Download failed. Please try again.");
		} finally {
			setDownloading(false);
		}
	}, [api.useDownload, token]);

	return (
		<DownloadButtonTemplate
			downloading={downloading}
			done={done}
			label={label}
			error={error}
			onDownload={() => void handleDownload()}
		/>
	);
}
