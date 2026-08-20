"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import ClaimFormTemplate from "./claim-form.mdx";

function useClaimApi() {
	const client = useModuleClient();
	return {
		submit: client.module("warranties").store["/warranties/claims/submit"],
	};
}

export function ClaimForm({
	warrantyRegistrationId,
}: {
	warrantyRegistrationId: string;
}) {
	const api = useClaimApi();

	return (
		<ClaimFormTemplate
			warrantyRegistrationId={warrantyRegistrationId}
			api={api}
		/>
	);
}
