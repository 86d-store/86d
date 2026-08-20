"use client";

import { useState } from "react";
import { useReviewsApi } from "./_hooks";
import { extractError } from "./_utils";
import ReviewFormTemplate from "./review-form.mdx";
import { StarPicker } from "./star-picker";

export function ReviewForm({
	productId,
	onSuccess,
}: {
	productId: string;
	onSuccess: () => void;
}) {
	const api = useReviewsApi();
	const [rating, setRating] = useState(0);
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [ratingError, setRatingError] = useState("");

	const submitMutation = api.submitReview.useMutation({
		onSuccess: () => onSuccess(),
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (rating === 0) {
			setRatingError("Please select a rating.");
			return;
		}
		setRatingError("");
		submitMutation.mutate({
			productId,
			authorName: name,
			authorEmail: email,
			rating,
			title: title.trim() || undefined,
			body,
		});
	};

	const error =
		ratingError ||
		(submitMutation.isError
			? extractError(submitMutation.error, "Failed to submit review.")
			: "");

	return (
		<ReviewFormTemplate
			success={submitMutation.isSuccess}
			name={name}
			onNameChange={setName}
			email={email}
			onEmailChange={setEmail}
			title={title}
			onTitleChange={setTitle}
			body={body}
			onBodyChange={setBody}
			onSubmit={handleSubmit}
			error={error}
			isLoading={submitMutation.isPending}
			starPicker={<StarPicker value={rating} onChange={setRating} />}
		/>
	);
}
