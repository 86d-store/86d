"use client";

import { useState } from "react";
import { useQuotesApi } from "./_hooks";
import { extractError } from "./_utils";
import QuoteRequestTemplate from "./quote-request.mdx";

export function QuoteRequest({
	onSuccess,
}: {
	onSuccess?: ((quoteId: string) => void) | undefined;
}) {
	const api = useQuotesApi();
	const [customerName, setCustomerName] = useState("");
	const [customerEmail, setCustomerEmail] = useState("");
	const [companyName, setCompanyName] = useState("");
	const [notes, setNotes] = useState("");
	const [createdId, setCreatedId] = useState<string | null>(null);

	const createMutation = api.createQuote.useMutation({
		onSuccess: (data: { quote: { id: string } }) => {
			setCreatedId(data.quote.id);
			if (onSuccess) {
				onSuccess(data.quote.id);
			}
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		createMutation.mutate({
			customerName,
			customerEmail,
			companyName: companyName.trim() || undefined,
			notes: notes.trim() || undefined,
		});
	};

	const error = createMutation.isError
		? extractError(createMutation.error, "Failed to create quote.")
		: "";

	return (
		<QuoteRequestTemplate
			success={createdId !== null}
			createdId={createdId}
			customerName={customerName}
			onCustomerNameChange={setCustomerName}
			customerEmail={customerEmail}
			onCustomerEmailChange={setCustomerEmail}
			companyName={companyName}
			onCompanyNameChange={setCompanyName}
			notes={notes}
			onNotesChange={setNotes}
			onSubmit={handleSubmit}
			error={error}
			isLoading={createMutation.isPending}
		/>
	);
}
