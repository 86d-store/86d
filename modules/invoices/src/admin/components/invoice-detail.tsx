"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";
import InvoiceDetailTemplate from "./invoice-detail.mdx";

interface InvoiceDetail {
	id: string;
	invoiceNumber: string;
	customerName?: string;
	guestEmail?: string;
	status: string;
	paymentTerms: string;
	issuedAt?: string;
	dueDate?: string;
	subtotal: number;
	taxAmount: number;
	shippingAmount: number;
	discountAmount: number;
	total: number;
	amountPaid: number;
	amountDue: number;
	currency: string;
	notes?: string;
	internalNotes?: string;
	lineItems: Array<{
		id: string;
		description: string;
		quantity: number;
		unitPrice: number;
		amount: number;
		sku?: string;
	}>;
	payments: Array<{
		id: string;
		amount: number;
		method: string;
		reference?: string;
		paidAt: string;
	}>;
	creditNotes: Array<{
		id: string;
		creditNoteNumber: string;
		status: string;
		amount: number;
	}>;
	createdAt: string;
}

const PAYMENT_TERMS = [
	{ value: "due_on_receipt", label: "Due on receipt" },
	{ value: "net_7", label: "Net 7" },
	{ value: "net_15", label: "Net 15" },
	{ value: "net_30", label: "Net 30" },
	{ value: "net_45", label: "Net 45" },
	{ value: "net_60", label: "Net 60" },
	{ value: "net_90", label: "Net 90" },
] as const;

const inputCls =
	"w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:opacity-50";
const labelCls = "mb-1 block font-medium text-foreground text-sm";

function extractError(err: unknown): string {
	if (err && typeof err === "object" && "message" in err) {
		return String((err as { message: string }).message);
	}
	return "An unexpected error occurred";
}

function useInvoiceDetailApi() {
	const client = useModuleClient();
	return {
		getInvoice: client.module("invoices").admin["/admin/invoices/:id"],
		updateInvoice:
			client.module("invoices").admin["/admin/invoices/:id/update"],
	};
}

// ---------------------------------------------------------------------------
// EditInvoiceSheet
// ---------------------------------------------------------------------------

interface EditSheetProps {
	invoice: InvoiceDetail;
	onSaved: () => void;
	onCancel: () => void;
}

function EditInvoiceSheet({ invoice, onSaved, onCancel }: EditSheetProps) {
	useEffect(() => {
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") onCancel();
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [onCancel]);
	const firstInputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		firstInputRef.current?.focus();
	}, []);
	const api = useInvoiceDetailApi();
	const [customerName, setCustomerName] = useState(invoice.customerName ?? "");
	const [guestEmail, setGuestEmail] = useState(invoice.guestEmail ?? "");
	const [paymentTerms, setPaymentTerms] = useState(invoice.paymentTerms);
	const [notes, setNotes] = useState(invoice.notes ?? "");
	const [internalNotes, setInternalNotes] = useState(
		invoice.internalNotes ?? "",
	);
	const [error, setError] = useState("");

	const updateMutation = api.updateInvoice.useMutation({
		onSuccess: () => {
			void api.getInvoice.invalidate({ id: invoice.id });
			onSaved();
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		const body: Record<string, unknown> = {
			paymentTerms,
		};
		if (customerName.trim()) body.customerName = customerName.trim();
		if (guestEmail.trim()) body.guestEmail = guestEmail.trim();
		if (notes.trim() !== (invoice.notes ?? "")) body.notes = notes.trim();
		if (internalNotes.trim() !== (invoice.internalNotes ?? ""))
			body.internalNotes = internalNotes.trim();
		(
			updateMutation as unknown as {
				mutate: (o: {
					params: { id: string };
					body: Record<string, unknown>;
				}) => void;
			}
		).mutate({ params: { id: invoice.id }, body });
	}

	const isPending = (updateMutation as unknown as { isPending: boolean })
		.isPending;

	return (
		<div className="fixed inset-0 z-50 flex justify-end">
			<button
				type="button"
				className="absolute inset-0 cursor-default bg-black/40"
				aria-label="Close panel"
				onClick={onCancel}
			/>
			<div
				role="dialog"
				aria-modal="true"
				className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-border border-l bg-background shadow-2xl"
			>
				<div className="flex shrink-0 items-center justify-between border-border border-b px-6 py-4">
					<h2 className="font-semibold text-foreground text-lg">
						Edit Invoice
					</h2>
					<button
						type="button"
						onClick={onCancel}
						className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
						aria-label="Close"
					>
						✕
					</button>
				</div>

				<form
					onSubmit={handleSubmit}
					className="flex flex-1 flex-col gap-5 px-6 py-6"
				>
					{error ? (
						<div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 text-sm dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
							{error}
						</div>
					) : null}

					<div>
						<label htmlFor="ei-name" className={labelCls}>
							Customer name
						</label>
						<input
							id="ei-name"
							type="text"
							ref={firstInputRef}
							value={customerName}
							onChange={(e) => setCustomerName(e.target.value)}
							className={inputCls}
							placeholder="Jane Smith"
						/>
					</div>

					<div>
						<label htmlFor="ei-email" className={labelCls}>
							Guest email
						</label>
						<input
							id="ei-email"
							type="email"
							value={guestEmail}
							onChange={(e) => setGuestEmail(e.target.value)}
							className={inputCls}
							placeholder="customer@example.com"
						/>
					</div>

					<div>
						<label htmlFor="ei-terms" className={labelCls}>
							Payment terms
						</label>
						<select
							id="ei-terms"
							value={paymentTerms}
							onChange={(e) => setPaymentTerms(e.target.value)}
							className={inputCls}
						>
							{PAYMENT_TERMS.map((t) => (
								<option key={t.value} value={t.value}>
									{t.label}
								</option>
							))}
						</select>
					</div>

					<div>
						<label htmlFor="ei-notes" className={labelCls}>
							Customer notes
						</label>
						<textarea
							id="ei-notes"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							className={inputCls}
							rows={3}
							placeholder="Notes visible to the customer…"
						/>
					</div>

					<div>
						<label htmlFor="ei-internal" className={labelCls}>
							Internal notes
						</label>
						<textarea
							id="ei-internal"
							value={internalNotes}
							onChange={(e) => setInternalNotes(e.target.value)}
							className={inputCls}
							rows={3}
							placeholder="Notes for your team only…"
						/>
					</div>

					<div className="mt-auto flex gap-3 pt-4">
						<button
							type="submit"
							disabled={isPending}
							className="flex-1 rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
						>
							{isPending ? "Saving…" : "Save Changes"}
						</button>
						<button
							type="button"
							onClick={onCancel}
							className="rounded-lg border border-border px-4 py-2 font-medium text-foreground text-sm hover:bg-muted"
						>
							Cancel
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// InvoiceDetail
// ---------------------------------------------------------------------------

export function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
	const api = useInvoiceDetailApi();
	const [showEdit, setShowEdit] = useState(false);

	const { data, isLoading: loading } = api.getInvoice.useQuery({
		id: invoiceId,
	}) as {
		data: { invoice: InvoiceDetail } | undefined;
		isLoading: boolean;
	};

	const invoice = data?.invoice;
	const isDraft = invoice?.status === "draft";

	return (
		<>
			{isDraft && invoice ? (
				<div className="mb-4 flex justify-end">
					<button
						type="button"
						onClick={() => setShowEdit(true)}
						className="rounded-lg border border-border bg-background px-3 py-1.5 font-medium text-foreground text-sm hover:bg-muted"
					>
						Edit Invoice
					</button>
				</div>
			) : null}

			<InvoiceDetailTemplate invoice={invoice} loading={loading} />

			{showEdit && invoice ? (
				<EditInvoiceSheet
					invoice={invoice}
					onSaved={() => setShowEdit(false)}
					onCancel={() => setShowEdit(false)}
				/>
			) : null}
		</>
	);
}
