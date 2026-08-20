"use client";

import { useEffect, useRef } from "react";
import { useQrCodeStoreApi } from "./_hooks";
import QrRedirectTemplate from "./qr-redirect.mdx";

interface QrCodeData {
	id: string;
	label: string;
	targetUrl: string;
	targetType: string;
	isActive: boolean;
}

export function QrRedirect(props: {
	qrCodeId?: string | undefined;
	params?: Record<string, string> | undefined;
}) {
	const qrCodeId = props.qrCodeId ?? props.params?.id ?? "";
	const api = useQrCodeStoreApi();
	const scannedRef = useRef(false);

	const { data, isLoading } = api.getQrCode.useQuery({
		params: { id: qrCodeId },
	}) as {
		data: { qrCode: QrCodeData | null } | undefined;
		isLoading: boolean;
	};

	const scanMutation = api.recordScan.useMutation();
	const qrCode = data?.qrCode;

	useEffect(() => {
		if (qrCode?.isActive && !scannedRef.current) {
			scannedRef.current = true;
			scanMutation.mutate({
				params: { id: qrCodeId },
				body: {
					userAgent: navigator.userAgent,
					referrer: document.referrer || undefined,
				},
			});
		}
	}, [qrCode, qrCodeId, scanMutation.mutate]);

	useEffect(() => {
		if (!qrCode?.isActive || !qrCode.targetUrl) return;
		const timer = setTimeout(() => {
			window.location.href = qrCode.targetUrl;
		}, 2000);
		return () => clearTimeout(timer);
	}, [qrCode]);

	return (
		<QrRedirectTemplate
			isLoading={isLoading}
			isActive={qrCode?.isActive ?? false}
			label={qrCode?.label}
			targetUrl={qrCode?.targetUrl}
			onGoNow={() => {
				if (qrCode?.targetUrl) window.location.href = qrCode.targetUrl;
			}}
		/>
	);
}
