import { fetchFromApi } from "./fetch-from-api";
import { loadFromTemplate } from "./load-from-template";
import type { Config, RemoteStoreConfig } from "./types";
import {
	createWorkloadTokenClient,
	type ManagedWorkloadConfig,
	readManagedWorkloadConfig,
	type WorkloadTokenClient,
} from "./workload-token-client";

export interface GetStoreConfigOptions {
	/** Path to template config.json when no managed workload is configured */
	templatePath?: string;
}

const STORE_CONFIG_RESOURCE = {
	audience: "https://86d.app/api/store-runtime",
	scopes: ["runtime.config:read"],
} as const;

let managedClient:
	| {
			config: ManagedWorkloadConfig;
			client: WorkloadTokenClient;
	  }
	| undefined;

function workloadClient(config: ManagedWorkloadConfig): WorkloadTokenClient {
	if (
		managedClient?.config.storeId === config.storeId &&
		managedClient.config.apiBaseUrl === config.apiBaseUrl &&
		managedClient.config.credential === config.credential
	) {
		return managedClient.client;
	}
	const client = createWorkloadTokenClient({ config });
	managedClient = { config: { ...config }, client };
	return client;
}

/**
 * Resolve store configuration from the Control Plane (managed workload) or from
 * the local template config.json (standalone).
 */
export async function getStoreConfig(
	options?: GetStoreConfigOptions,
): Promise<Config | RemoteStoreConfig> {
	const templatePath = options?.templatePath;
	const managedWorkload = readManagedWorkloadConfig();

	if (managedWorkload) {
		// Once the exact managed identity trio is present, the Control Plane is
		// authoritative for this Runtime. Falling back to a local template after
		// revocation or an auth/network failure would silently turn a managed Store
		// into a different standalone configuration.
		const client = workloadClient(managedWorkload);
		return fetchFromApi(
			managedWorkload.storeId,
			managedWorkload.apiBaseUrl,
			(url, init) => client.request(STORE_CONFIG_RESOURCE, url, init),
		);
	}

	if (templatePath) {
		return loadFromTemplate(templatePath);
	}

	throw new Error(
		"Store config requires a managed workload credential trio or templatePath to load from template/config.json",
	);
}
