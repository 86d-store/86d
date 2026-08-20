"use client";

import { useState } from "react";
import { useAffiliatesStoreApi } from "./_hooks";
import { extractError } from "./_utils";
import AffiliateApplyTemplate from "./affiliate-apply.mdx";

export function AffiliateApply({
	userEmail,
	userName,
}: {
	userEmail?: string | undefined;
	userName?: string | undefined;
}) {
	const api = useAffiliatesStoreApi();

	const [name, setName] = useState(userName ?? "");
	const [email, setEmail] = useState(userEmail ?? "");
	const [website, setWebsite] = useState("");
	const [notes, setNotes] = useState("");

	const applyMutation = api.apply.useMutation();

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		applyMutation.mutate({
			name,
			email,
			website: website || undefined,
			notes: notes || undefined,
		});
	};

	const error = applyMutation.isError
		? extractError(
				applyMutation.error as Error,
				"Failed to submit application.",
			)
		: "";

	return (
		<AffiliateApplyTemplate
			success={applyMutation.isSuccess}
			isLoading={applyMutation.isPending}
			name={name}
			onNameChange={setName}
			email={email}
			onEmailChange={setEmail}
			website={website}
			onWebsiteChange={setWebsite}
			notes={notes}
			onNotesChange={setNotes}
			onSubmit={handleSubmit}
			error={error}
			isAuthenticated={!!userEmail}
		/>
	);
}
