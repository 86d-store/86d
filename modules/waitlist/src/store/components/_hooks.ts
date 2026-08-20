"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useWaitlistApi() {
	const client = useModuleClient();
	return {
		joinWaitlist: client.module("waitlist").store["/waitlist/join"],
		leaveWaitlist: client.module("waitlist").store["/waitlist/leave"],
		checkWaitlist:
			client.module("waitlist").store["/waitlist/check/:productId"],
		myWaitlist: client.module("waitlist").store["/waitlist/mine"],
	};
}
