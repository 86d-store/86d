"use client";

import { useState } from "react";
import { useProductQaApi } from "./_hooks";
import { extractError } from "./_utils";
import QuestionFormTemplate from "./question-form.mdx";

export function QuestionForm({
	productId,
	onSuccess,
}: {
	productId: string;
	onSuccess: () => void;
}) {
	const api = useProductQaApi();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [body, setBody] = useState("");

	const submitMutation = api.submitQuestion.useMutation({
		onSuccess: () => {
			setName("");
			setEmail("");
			setBody("");
			onSuccess();
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		submitMutation.mutate({
			productId,
			authorName: name,
			authorEmail: email,
			body,
		});
	};

	const error = submitMutation.isError
		? extractError(submitMutation.error, "Failed to submit question.")
		: "";

	return (
		<QuestionFormTemplate
			success={submitMutation.isSuccess}
			name={name}
			onNameChange={setName}
			email={email}
			onEmailChange={setEmail}
			body={body}
			onBodyChange={setBody}
			onSubmit={handleSubmit}
			error={error}
			isLoading={submitMutation.isPending}
		/>
	);
}
