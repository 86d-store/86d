"use client";

import { useState } from "react";
import { useVendorsStoreApi } from "./_hooks";
import { extractError } from "./_utils";
import VendorApplyTemplate from "./vendor-apply.mdx";

export function VendorApply({
	userEmail,
	userName,
}: {
	userEmail?: string | undefined;
	userName?: string | undefined;
}) {
	const api = useVendorsStoreApi();

	const [name, setName] = useState(userName ?? "");
	const [email, setEmail] = useState(userEmail ?? "");
	const [description, setDescription] = useState("");
	const [website, setWebsite] = useState("");

	const applyMutation = api.apply.useMutation();

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		applyMutation.mutate({
			name,
			email,
			description: description || undefined,
			website: website || undefined,
		});
	};

	const error = applyMutation.isError
		? extractError(
				applyMutation.error as Error,
				"Failed to submit application.",
			)
		: "";

	return (
		<VendorApplyTemplate
			success={applyMutation.isSuccess}
			isLoading={applyMutation.isPending}
			name={name}
			onNameChange={setName}
			email={email}
			onEmailChange={setEmail}
			description={description}
			onDescriptionChange={setDescription}
			website={website}
			onWebsiteChange={setWebsite}
			onSubmit={handleSubmit}
			error={error}
			isAuthenticated={!!userEmail}
		/>
	);
}
