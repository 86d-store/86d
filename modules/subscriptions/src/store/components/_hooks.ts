"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useSubscriptionsApi() {
	const client = useModuleClient();
	return {
		listPlans: client.module("subscriptions").store["/subscriptions/plans"],
		subscribe: client.module("subscriptions").store["/subscriptions/subscribe"],
		getMySubscriptions:
			client.module("subscriptions").store["/subscriptions/me"],
		cancelSubscription:
			client.module("subscriptions").store["/subscriptions/me/cancel"],
	};
}
