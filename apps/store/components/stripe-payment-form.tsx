"use client";

import {
	Elements,
	PaymentElement,
	useElements,
	useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { getProcessEnv } from "env/process-env";
import { useTheme } from "next-themes";
import { useCallback, useRef, useState } from "react";

// ─── Singleton Stripe instance ─────────────────────────────────────

let stripePromise: Promise<Stripe | null> | null = null;

function getStripe(): Promise<Stripe | null> {
	if (!stripePromise) {
		const key = getProcessEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
		if (!key) return Promise.resolve(null);
		stripePromise = loadStripe(key);
	}
	return stripePromise;
}

/**
 * Check if Stripe is configured (publishable key is set).
 * Use this to decide whether to render StripePaymentForm or the demo fallback.
 */
export function isStripeConfigured(): boolean {
	return !!getProcessEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
}

// ─── Inner form (must be inside <Elements>) ─────────────────────────

interface InnerFormProps {
	onSuccess: () => void;
	onError: (message: string) => void;
	isProcessing: boolean;
	setProcessing: (v: boolean) => void;
}

function InnerForm({
	onSuccess,
	onError,
	isProcessing,
	setProcessing,
}: InnerFormProps) {
	const stripe = useStripe();
	const elements = useElements();
	const [ready, setReady] = useState(false);

	const handleSubmit = useCallback(async () => {
		if (!stripe || !elements) {
			onError("Payment system is not ready. Please wait.");
			return;
		}

		setProcessing(true);

		const { error } = await stripe.confirmPayment({
			elements,
			confirmParams: {
				return_url: window.location.href,
			},
			redirect: "if_required",
		});

		if (error) {
			onError(error.message ?? "Payment failed. Please try again.");
			setProcessing(false);
		} else {
			onSuccess();
		}
	}, [stripe, elements, onSuccess, onError, setProcessing]);

	return (
		<div>
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
					<rect width="20" height="14" x="2" y="5" rx="2" />
					<line x1="2" x2="22" y1="10" y2="10" />
				</svg>
				<span className="font-medium text-foreground text-sm">Credit card</span>
			</div>

			<PaymentElement
				onReady={() => setReady(true)}
				options={{
					layout: "tabs",
				}}
			/>

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
					Payment is processed securely via Stripe. Your card details are never
					stored on our servers.
				</p>
			</div>

			<StripeSubmitButton
				onClick={handleSubmit}
				disabled={!ready || isProcessing || !stripe}
				isProcessing={isProcessing}
			/>
		</div>
	);
}

// ─── Submit button (exported for use in checkout page) ──────────────

function StripeSubmitButton({
	onClick,
	disabled,
	isProcessing,
}: {
	onClick: () => void;
	disabled: boolean;
	isProcessing: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className="mt-4 w-full rounded-lg bg-foreground px-5 py-3 text-center font-semibold text-background text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
		>
			{isProcessing ? (
				<span className="flex items-center justify-center gap-2">
					<svg
						className="size-4 animate-spin"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<circle
							className="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							strokeWidth="4"
						/>
						<path
							className="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
						/>
					</svg>
					Processing payment...
				</span>
			) : (
				"Confirm & review order"
			)}
		</button>
	);
}

// ─── Main wrapper ───────────────────────────────────────────────────

export interface StripePaymentFormProps {
	clientSecret: string;
	onSuccess: () => void;
	onError: (message: string) => void;
	isProcessing: boolean;
	setProcessing: (v: boolean) => void;
	onBack: () => void;
}

/**
 * Stripe Elements payment form.
 * Renders <PaymentElement> inside an <Elements> provider.
 * Call this only when `clientSecret` is available from the create-payment endpoint.
 */
export function StripePaymentForm({
	clientSecret,
	onSuccess,
	onError,
	isProcessing,
	setProcessing,
	onBack,
}: StripePaymentFormProps) {
	const stripeRef = useRef(getStripe());
	const { resolvedTheme } = useTheme();
	const isDark = resolvedTheme === "dark";

	const appearance = {
		theme: "flat" as const,
		variables: isDark
			? {
					colorPrimary: "oklch(0.985 0 0)",
					colorBackground: "oklch(0.145 0 0)",
					colorText: "oklch(0.985 0 0)",
					colorDanger: "hsl(0 72% 51%)",
					fontFamily: "inherit",
					borderRadius: "8px",
					spacingUnit: "4px",
				}
			: {
					colorPrimary: "oklch(0.145 0 0)",
					colorBackground: "oklch(1 0 0)",
					colorText: "oklch(0.145 0 0)",
					colorDanger: "hsl(0 84% 60%)",
					fontFamily: "inherit",
					borderRadius: "8px",
					spacingUnit: "4px",
				},
	};

	return (
		<div className="mb-6 rounded-lg border border-border/40 p-5">
			<Elements
				stripe={stripeRef.current}
				options={{
					clientSecret,
					appearance,
				}}
			>
				<InnerForm
					onSuccess={onSuccess}
					onError={onError}
					isProcessing={isProcessing}
					setProcessing={setProcessing}
				/>
			</Elements>

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
