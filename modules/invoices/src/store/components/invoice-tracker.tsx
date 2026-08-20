"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useCallback, useState } from "react";
import InvoiceTrackerTemplate from "./invoice-tracker.mdx";

interface TrackedInvoice {
	id: string;
	invoiceNumber: string;
	status: string;
	total: number;
	amountPaid: number;
	amountDue: number;
	currency: string;
	dueDate?: string;
	lineItems: Array<{
		id: string;
		description: string;
		quantity: number;
		unitPrice: number;
		amount: number;
	}>;
}

function useInvoiceTrackerApi() {
	const client = useModuleClient();
	return {
		track: client.module("invoices").store["/invoices/track"],
	};
}

export function InvoiceTracker() {
	const api = useInvoiceTrackerApi();
	const [invoiceNumber, setInvoiceNumber] = useState("");
	const [email, setEmail] = useState("");
	const [invoice, setInvoice] = useState<TrackedInvoice | null>(null);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleTrack = useCallback(async () => {
		if (!invoiceNumber.trim() || !email.trim()) return;
		setLoading(true);
		setError("");
		setInvoice(null);

		const result = (await (
			api.track as {
				useMutation: () => {
					mutateAsync: (p: {
						invoiceNumber: string;
						email: string;
					}) => Promise<{
						invoice?: TrackedInvoice;
						error?: string;
					}>;
				};
			}
		)
			.useMutation()
			.mutateAsync({
				invoiceNumber: invoiceNumber.trim(),
				email: email.trim(),
			})) as { invoice?: TrackedInvoice; error?: string };

		if (result.error) {
			setError(
				typeof result.error === "string" ? result.error : "Invoice not found",
			);
		} else if (result.invoice) {
			setInvoice(result.invoice);
		}
		setLoading(false);
	}, [invoiceNumber, email, api.track]);

	return (
		<InvoiceTrackerTemplate
			invoiceNumber={invoiceNumber}
			email={email}
			invoice={invoice}
			error={error}
			loading={loading}
			onInvoiceNumberChange={setInvoiceNumber}
			onEmailChange={setEmail}
			onTrack={handleTrack}
		/>
	);
}
