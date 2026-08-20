"use client";

import { useEffect, useRef, useState } from "react";

type FinixSafeConfiguration = Readonly<{
	tokenization?: string;
	tokenizationOrigin?: string;
	applicationId?: string;
	environment?: string;
}>;

export interface FinixTokenizationProps {
	readonly providerReference: string;
	readonly safeConfiguration: FinixSafeConfiguration;
	readonly onInstrumentReady?: (instrumentReference: string) => void;
	readonly onError?: (message: string) => void;
}

declare global {
	interface Window {
		Finix?: {
			Auth: (
				environment: string,
				applicationId: string,
				callback: (sessionKey: string) => void,
			) => {
				submit: (
					environment: string,
					applicationId: string,
					formId: string,
					callback: (
						error: unknown,
						response: { data?: { id?: string } },
					) => void,
				) => void;
			};
		};
	}
}

/**
 * Finix.js tokenization surface. Accepts only opaque provider references and
 * safe browser configuration from the Control Plane — never PAN or secrets.
 */
export function FinixTokenization({
	providerReference,
	safeConfiguration,
	onInstrumentReady,
	onError,
}: FinixTokenizationProps) {
	const formId = useRef(`finix-form-${providerReference}`).current;
	const [ready, setReady] = useState(false);

	useEffect(() => {
		if (safeConfiguration.tokenization !== "finix_hosted") {
			onError?.("Managed Payment tokenization is unavailable for this option.");
			return;
		}
		const applicationId = safeConfiguration.applicationId;
		if (!applicationId) {
			onError?.("Managed Payment tokenization configuration is incomplete.");
			return;
		}

		const script = document.createElement("script");
		script.src = "https://js.finix.com/v1/finix.js";
		script.async = true;
		script.onload = () => setReady(true);
		script.onerror = () =>
			onError?.("Managed Payment tokenization could not be initialized.");
		document.head.appendChild(script);
		return () => {
			script.remove();
		};
	}, [onError, providerReference, safeConfiguration]);

	const handleSubmit = () => {
		const finix = window.Finix;
		const applicationId = safeConfiguration.applicationId;
		const environment = safeConfiguration.environment ?? "sandbox";
		if (!finix || !applicationId) {
			onError?.("Managed Payment tokenization is not ready.");
			return;
		}
		finix.Auth(environment, applicationId, () => {
			finix
				.Auth(environment, applicationId, () => {})
				.submit(environment, applicationId, formId, (error, response) => {
					if (error) {
						onError?.("Managed Payment tokenization failed.");
						return;
					}
					const instrumentReference = response.data?.id;
					if (!instrumentReference) {
						onError?.("Managed Payment tokenization returned no instrument.");
						return;
					}
					onInstrumentReady?.(instrumentReference);
				});
		});
	};

	return (
		<div data-provider-reference={providerReference}>
			<form id={formId} />
			<button type="button" disabled={!ready} onClick={handleSubmit}>
				Tokenize payment instrument
			</button>
		</div>
	);
}
