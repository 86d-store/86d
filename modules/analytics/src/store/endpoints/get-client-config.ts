import { createStoreEndpoint } from "@86d-store/core/api";

interface ClientConfigOptions {
	gtmContainerId?: string | undefined;
}

export function createClientConfigEndpoint(options: ClientConfigOptions) {
	return createStoreEndpoint(
		"/analytics/client-config",
		{ method: "GET" },
		async () => {
			return {
				gtm: {
					enabled: Boolean(options.gtmContainerId),
					containerId: options.gtmContainerId ?? null,
				},
			};
		},
	);
}
