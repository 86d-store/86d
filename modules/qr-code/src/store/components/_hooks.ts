"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useQrCodeStoreApi() {
	const client = useModuleClient();
	return {
		getQrCode: client.module("qr-code").store["/qr-codes/:id"],
		recordScan: client.module("qr-code").store["/qr-codes/:id/scan"],
	};
}
