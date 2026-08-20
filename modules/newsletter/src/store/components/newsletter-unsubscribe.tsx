"use client";

import { useState } from "react";
import { useNewsletterApi } from "./_hooks";
import { extractError } from "./_utils";
import NewsletterUnsubscribeTemplate from "./newsletter-unsubscribe.mdx";

export function NewsletterUnsubscribe() {
	const api = useNewsletterApi();
	const [email, setEmail] = useState("");

	const unsubMutation = api.unsubscribe.useMutation();

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		unsubMutation.mutate({ email });
	};

	const success = unsubMutation.isSuccess;
	const error = unsubMutation.isError
		? extractError(
				unsubMutation.error,
				"Failed to unsubscribe. Please try again.",
			)
		: "";

	return (
		<NewsletterUnsubscribeTemplate
			success={success}
			email={email}
			onEmailChange={setEmail}
			onSubmit={handleSubmit}
			isLoading={unsubMutation.isPending}
			error={error}
		/>
	);
}
