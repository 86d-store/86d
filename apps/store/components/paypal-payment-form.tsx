"use client";

import {
	PayPalButtons,
	PayPalScriptProvider,
	usePayPalScriptReducer,
} from "@paypal/react-paypal-js";

// ─── Check if PayPal is configured ──────────────────────────────────

export function isPayPalConfigured(): boolean {
	return !!process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
}

// ─── Inner buttons (must be inside PayPalScriptProvider) ────────────

interface InnerButtonsProps {
	paypalOrderId: string;
	onCapture: () => Promise<void>;
	onError: (message: string) => void;
	setProcessing: (v: boolean) => void;
}

function InnerButtons({
	paypalOrderId,
	onCapture,
	onError,
	setProcessing,
}: InnerButtonsProps) {
	const [{ isPending }] = usePayPalScriptReducer();

	if (isPending) {
		return (
			<div className="flex items-center justify-center py-6">
				<div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-foreground" />
			</div>
		);
	}

	return (
		<PayPalButtons
			style={{
				layout: "vertical",
				shape: "rect",
				label: "pay",
				height: 45,
			}}
			createOrder={async () => {
				return paypalOrderId;
			}}
			onApprove={async () => {
				setProcessing(true);
				try {
					await onCapture();
				} catch {
					onError("Payment capture failed. Please try again.");
					setProcessing(false);
				}
			}}
			onCancel={() => {
				onError("Payment was cancelled. Please try again.");
			}}
			onError={(err) => {
				const message =
					err instanceof Error ? err.message : "PayPal encountered an error.";
				onError(message);
				setProcessing(false);
			}}
		/>
	);
}

// ─── Main wrapper ───────────────────────────────────────────────────

export interface PayPalPaymentFormProps {
	paypalOrderId: string;
	onCapture: () => Promise<void>;
	onError: (message: string) => void;
	isProcessing: boolean;
	setProcessing: (v: boolean) => void;
	onBack: () => void;
}

export function PayPalPaymentForm({
	paypalOrderId,
	onCapture,
	onError,
	isProcessing,
	setProcessing,
	onBack,
}: PayPalPaymentFormProps) {
	const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "";

	return (
		<div className="mb-6 rounded-lg border border-border/40 p-5">
			<div className="mb-4 flex items-center gap-2">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="text-foreground"
					aria-hidden="true"
				>
					<path d="M6.5 21h4.5c3.5 0 7-1.5 7-6 0-3.5-2.5-5-5-5h-4l-1 6" />
					<path d="M9 12l-2 9" />
					<path d="M8.5 3h4.5c3.5 0 6 1.5 6 5 0 3.5-2.5 5-5 5" />
				</svg>
				<span className="font-medium text-foreground text-sm">PayPal</span>
			</div>

			{clientId ? (
				<PayPalScriptProvider
					options={{
						clientId,
						intent: "capture",
						currency: "USD",
					}}
				>
					<InnerButtons
						paypalOrderId={paypalOrderId}
						onCapture={onCapture}
						onError={onError}
						setProcessing={setProcessing}
					/>
				</PayPalScriptProvider>
			) : (
				<div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
					<p className="text-amber-700 text-sm dark:text-amber-400">
						PayPal is not configured. Contact the store owner.
					</p>
				</div>
			)}

			<div className="mt-4 flex items-center gap-1.5">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="text-muted-foreground"
					aria-hidden="true"
				>
					<rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
					<path d="M7 11V7a5 5 0 0 1 10 0v4" />
				</svg>
				<p className="text-muted-foreground text-xs">
					Payment is processed securely via PayPal. Your financial details are
					handled by PayPal and never stored on our servers.
				</p>
			</div>

			<button
				type="button"
				onClick={onBack}
				disabled={isProcessing}
				className="mt-3 w-full rounded-lg border border-border/60 px-5 py-2.5 font-medium text-foreground text-sm transition-colors hover:bg-muted disabled:opacity-50"
			>
				Back to shipping
			</button>
		</div>
	);
}
