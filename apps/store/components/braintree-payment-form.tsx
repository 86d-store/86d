"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Braintree Drop-in type declarations ─────────────────────────────

interface BraintreeDropin {
	requestPaymentMethod(): Promise<{
		nonce: string;
		type: string;
		details: Record<string, unknown>;
	}>;
	teardown(): Promise<void>;
}

interface BraintreeDropinCreateOptions {
	authorization: string;
	container: string | HTMLElement;
}

interface BraintreeDropinModule {
	create(options: BraintreeDropinCreateOptions): Promise<BraintreeDropin>;
}

declare global {
	interface Window {
		braintree?: {
			dropin?: BraintreeDropinModule;
		};
	}
}

const DROPIN_SCRIPT_URL =
	"https://js.braintreegateway.com/web/dropin/1.43.0/js/dropin.min.js";

// ─── Script loader ───────────────────────────────────────────────────

let scriptLoadPromise: Promise<void> | null = null;

function loadDropinScript(): Promise<void> {
	if (scriptLoadPromise) return scriptLoadPromise;
	if (window.braintree?.dropin) return Promise.resolve();

	scriptLoadPromise = new Promise<void>((resolve, reject) => {
		const script = document.createElement("script");
		script.src = DROPIN_SCRIPT_URL;
		script.async = true;
		script.onload = () => resolve();
		script.onerror = () => {
			scriptLoadPromise = null;
			reject(new Error("Failed to load Braintree payment SDK"));
		};
		document.head.appendChild(script);
	});

	return scriptLoadPromise;
}

// ─── Main component ──────────────────────────────────────────────────

export interface BraintreePaymentFormProps {
	clientToken: string;
	onNonce: (nonce: string) => void;
	onError: (message: string) => void;
	isProcessing: boolean;
	setProcessing: (v: boolean) => void;
	onBack: () => void;
}

export function BraintreePaymentForm({
	clientToken,
	onNonce,
	onError,
	isProcessing,
	setProcessing,
	onBack,
}: BraintreePaymentFormProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const dropinRef = useRef<BraintreeDropin | null>(null);
	const [ready, setReady] = useState(false);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;

		async function init() {
			try {
				await loadDropinScript();
				if (cancelled || !containerRef.current || !window.braintree?.dropin) {
					return;
				}
				const instance = await window.braintree.dropin.create({
					authorization: clientToken,
					container: containerRef.current,
				});
				if (cancelled) {
					void instance.teardown();
					return;
				}
				dropinRef.current = instance;
				setReady(true);
			} catch (err) {
				if (!cancelled) {
					onError(
						err instanceof Error
							? err.message
							: "Failed to initialize payment form",
					);
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		void init();

		return () => {
			cancelled = true;
			if (dropinRef.current) {
				void dropinRef.current.teardown();
				dropinRef.current = null;
			}
		};
	}, [clientToken, onError]);

	const handleSubmit = useCallback(async () => {
		if (!dropinRef.current) {
			onError("Payment form is not ready. Please wait.");
			return;
		}

		setProcessing(true);

		try {
			const { nonce } = await dropinRef.current.requestPaymentMethod();
			onNonce(nonce);
		} catch (err) {
			const message =
				err instanceof Error
					? err.message
					: "Failed to process payment. Please try again.";
			onError(message);
			setProcessing(false);
		}
	}, [onNonce, onError, setProcessing]);

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
					<rect width="20" height="14" x="2" y="5" rx="2" />
					<line x1="2" x2="22" y1="10" y2="10" />
				</svg>
				<span className="font-medium text-foreground text-sm">
					Credit or debit card
				</span>
			</div>

			{loading && (
				<div className="flex items-center justify-center py-6">
					<div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-foreground" />
				</div>
			)}

			<div ref={containerRef} data-testid="braintree-dropin-container" />

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
					Payment is processed securely via Braintree. Your card details are
					never stored on our servers.
				</p>
			</div>

			<button
				type="button"
				onClick={handleSubmit}
				disabled={!ready || isProcessing}
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
