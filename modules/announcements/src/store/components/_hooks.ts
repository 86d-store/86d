import { useModuleClient } from "@86d-app/core/client/provider";

export function useAnnouncementsApi() {
	const client = useModuleClient();
	const api = client.module("announcements").store;

	return {
		getActive: api["/announcements/active"],
		recordImpression: api["/announcements/:id/impression"],
		recordClick: api["/announcements/:id/click"],
		recordDismissal: api["/announcements/:id/dismiss"],
	};
}
