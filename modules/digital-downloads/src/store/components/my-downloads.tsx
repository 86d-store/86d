"use client";

import { useDownloadsApi } from "./_hooks";
import { DownloadRow } from "./download-row";
import MyDownloadsTemplate from "./my-downloads.mdx";

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

export function MyDownloads({
	title = "My Downloads",
}: {
	title?: string | undefined;
}) {
	const api = useDownloadsApi();

	const { data, isLoading, isError } = api.listMyDownloads.useQuery({}) as {
		data: { tokens: DownloadToken[] } | undefined;
		isLoading: boolean;
		isError: boolean;
	};

	const tokens = data?.tokens ?? [];

	return (
		<MyDownloadsTemplate
			isLoading={isLoading}
			isError={isError}
			title={title}
			tokens={tokens}
			tokenRows={tokens.map((token) => (
				<DownloadRow key={token.id} token={token} />
			))}
		/>
	);
}
