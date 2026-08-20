"use client";

import { useCallback, useState } from "react";
import { useDownloadsApi } from "./_hooks";
import { formatDate, isTokenUsable, tokenStatusLabel } from "./_utils";
import DownloadRowTemplate from "./download-row.mdx";

interface DownloadToken {
	id: string;
	token: string;
	fileId: string;
	orderId?: string | undefined;
	email: string;
	maxDownloads?: number | undefined;
	downloadCount: number;
	expiresAt?: string | undefined;
	revokedAt?: string | undefined;
	createdAt: string;
}

interface UseTokenResponse {
	ok: boolean;
	url?: string;
	reason?: string;
}

export function DownloadRow({ token }: { token: DownloadToken }) {
	const api = useDownloadsApi();
	const [downloading, setDownloading] = useState(false);
	const [error, setError] = useState("");
	const usable = isTokenUsable(token);
	const status = tokenStatusLabel(token);

	const handleDownload = useCallback(async () => {
		setDownloading(true);
		setError("");

		try {
			const data = (await api.useDownload.fetch({
				params: { token: token.token },
			})) as UseTokenResponse;
			if (data.ok && data.url) {
				window.open(data.url, "_blank", "noopener");
			} else {
				setError(data.reason ?? "Download failed.");
			}
		} catch {
			setError("Download failed. Please try again.");
		} finally {
			setDownloading(false);
		}
	}, [api.useDownload, token.token]);

	return (
		<DownloadRowTemplate
			fileIdPreview={token.fileId.slice(0, 8)}
			statusLabel={status.label}
			statusStyle={status.style}
			createdAtFormatted={formatDate(token.createdAt)}
			downloadsUsed={token.maxDownloads ?? undefined}
			downloadCount={token.downloadCount}
			expiresAtFormatted={
				token.expiresAt ? formatDate(token.expiresAt) : undefined
			}
			error={error}
			usable={usable}
			downloading={downloading}
			onDownload={() => void handleDownload()}
		/>
	);
}
