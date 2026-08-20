"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useFormsApi() {
	const client = useModuleClient();
	return {
		listForms: client.module("forms").store["/forms"],
		getForm: client.module("forms").store["/forms/:slug"],
		submitForm: client.module("forms").store["/forms/:slug/submit"],
	};
}
