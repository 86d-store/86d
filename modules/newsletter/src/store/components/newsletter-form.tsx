"use client";

import { useState } from "react";
import { useNewsletterApi } from "./_hooks";
import { extractError } from "./_utils";
import NewsletterFormTemplate from "./newsletter-form.mdx";

interface Subscriber {
	id: string;
	email: string;
	firstName?: string | undefined;
	lastName?: string | undefined;
	status: string;
}

export interface NewsletterFormProps {
	showName?: boolean | undefined;
	source?: string | undefined;
	title?: string | undefined;
	description?: string | undefined;
	compact?: boolean | undefined;
}

export function NewsletterForm({
	showName = false,
	source,
	title = "Subscribe to our newsletter",
	description = "Get the latest updates, offers, and news delivered to your inbox.",
	compact = false,
}: NewsletterFormProps) {
	const api = useNewsletterApi();
	const [email, setEmail] = useState("");
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");

	const subscribeMutation = api.subscribe.useMutation();

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		subscribeMutation.mutate({
			email,
			...(showName && firstName.trim() ? { firstName: firstName.trim() } : {}),
			...(showName && lastName.trim() ? { lastName: lastName.trim() } : {}),
			...(source ? { source } : {}),
		});
	};

	const success =
		subscribeMutation.isSuccess &&
		(subscribeMutation.data as { subscriber: Subscriber } | undefined)
			?.subscriber?.status === "active";

	const error = subscribeMutation.isError
		? extractError(
				subscribeMutation.error,
				"Failed to subscribe. Please try again.",
			)
		: "";

	return (
		<NewsletterFormTemplate
			success={success}
			email={email}
			onEmailChange={setEmail}
			firstName={firstName}
			onFirstNameChange={setFirstName}
			lastName={lastName}
			onLastNameChange={setLastName}
			onSubmit={handleSubmit}
			showName={showName}
			title={title}
			description={description}
			compact={compact}
			isLoading={subscribeMutation.isPending}
			error={error}
		/>
	);
}
