"use client";

import { ModuleClientError } from "@86d-app/core/client/hooks";
import { observer } from "@86d-app/core/state";
import { type FormEvent, useEffect, useState } from "react";
import type { CheckoutAddress } from "../../service";
import { checkoutState } from "../../state";
import { useCheckoutApi } from "./_hooks";
import { formatPrice } from "./_utils";
import CheckoutShippingTemplate from "./checkout-shipping.mdx";

interface ShippingRate {
	id: string;
	name: string;
	zoneName: string;
	price: number;
}

const emptyAddress: CheckoutAddress = {
	firstName: "",
	lastName: "",
	line1: "",
	city: "",
	state: "",
	postalCode: "",
	country: "US",
};

function syncRevisionFromBody(
	body: Record<string, unknown> | undefined,
	setRevision: (value: number) => void,
): void {
	if (!body) return;
	if (typeof body.currentRevision === "number") {
		setRevision(body.currentRevision);
		return;
	}
	const session = body.session;
	if (
		session &&
		typeof session === "object" &&
		typeof (session as { revision?: unknown }).revision === "number"
	) {
		setRevision((session as { revision: number }).revision);
	}
}

/** Step 2: Collect shipping address and select shipping method. */
export const CheckoutShipping = observer(() => {
	const api = useCheckoutApi();
	const sessionId = checkoutState.sessionId;

	const { data } = api.getSession.useQuery(
		sessionId ? { params: { id: sessionId } } : undefined,
		{ enabled: !!sessionId },
	) as {
		data:
			| {
					session: {
						revision: number;
						shippingAddress?: CheckoutAddress | null;
						shippingAmount?: number;
						shippingMethodName?: string | null;
					};
			  }
			| undefined;
	};

	const initial = data?.session?.shippingAddress ?? emptyAddress;
	const [address, setAddress] = useState<CheckoutAddress>(initial);
	const [revision, setRevision] = useState<number | null>(
		data?.session?.revision ?? null,
	);
	const [error, setError] = useState("");
	const [taxReviewRequired, setTaxReviewRequired] = useState(false);

	// Shipping rate selection state
	const [phase, setPhase] = useState<"address" | "rates">("address");
	const [selectedRateId, setSelectedRateId] = useState<string | null>(null);
	const [ratesError, setRatesError] = useState("");

	// If session already has a shipping address, start on rates phase
	useEffect(() => {
		if (data?.session?.shippingAddress) {
			setAddress(data.session.shippingAddress);
			setPhase("rates");
		}
	}, [data?.session?.shippingAddress]);

	useEffect(() => {
		if (data?.session?.revision !== undefined) {
			setRevision(data.session.revision);
		}
	}, [data?.session?.revision]);

	// Fetch shipping rates when in rates phase
	const {
		data: ratesData,
		isLoading: loadingRates,
		isError: ratesFetchError,
		error: ratesQueryError,
	} = api.getShippingRates.useQuery(
		sessionId ? { params: { id: sessionId } } : undefined,
		{ enabled: !!sessionId && phase === "rates" },
	) as {
		data:
			| {
					session?: { revision?: number };
					rates: ShippingRate[];
			  }
			| undefined;
		isLoading: boolean;
		isError: boolean;
		error: unknown;
	};

	const rates = ratesData?.rates ?? [];

	useEffect(() => {
		syncRevisionFromBody(
			ratesData as Record<string, unknown> | undefined,
			setRevision,
		);
	}, [ratesData]);

	useEffect(() => {
		if (ratesFetchError && ratesQueryError instanceof ModuleClientError) {
			syncRevisionFromBody(ratesQueryError.body, setRevision);
			if (ratesQueryError.body?.code === "TAX_REVIEW_REQUIRED") {
				setTaxReviewRequired(true);
				setRatesError(
					"Tax requires merchant review before checkout can continue.",
				);
				return;
			}
			if (ratesQueryError.body?.code === "CHECKOUT_REVISION_CONFLICT") {
				setRatesError(
					"This checkout changed after it was loaded. Please try again.",
				);
				return;
			}
		}
		if (ratesFetchError) {
			setRatesError("Could not load shipping rates. Please try again.");
		}
	}, [ratesFetchError, ratesQueryError]);

	// Pre-select first rate or previously selected rate when rates load
	useEffect(() => {
		if (rates.length > 0 && selectedRateId === null) {
			const previousName = data?.session?.shippingMethodName;
			const match = previousName
				? rates.find((r) => r.name === previousName)
				: null;
			setSelectedRateId(match?.id ?? rates[0].id);
		}
	}, [rates, selectedRateId, data?.session?.shippingMethodName]);

	const updateMutation = api.updateSession.useMutation({
		onError: (err) => {
			setTaxReviewRequired(false);
			if (err instanceof ModuleClientError) {
				syncRevisionFromBody(err.body, setRevision);
				if (err.body?.code === "TAX_REVIEW_REQUIRED") {
					setTaxReviewRequired(true);
					setError(
						"Your address was saved, but tax requires merchant review before payment.",
					);
					return;
				}
				if (err.body?.code === "CHECKOUT_REVISION_CONFLICT") {
					setError(
						"This checkout changed after it was loaded. Please try again.",
					);
					return;
				}
			}
			setError("Failed to save shipping address. Please try again.");
		},
	});

	const updateField = (field: keyof CheckoutAddress, value: string) => {
		setAddress((prev) => ({ ...prev, [field]: value }));
	};

	const handleAddressSubmit = (e: FormEvent) => {
		e.preventDefault();
		setError("");
		setTaxReviewRequired(false);

		if (
			!address.firstName.trim() ||
			!address.lastName.trim() ||
			!address.line1.trim() ||
			!address.city.trim() ||
			!address.state.trim() ||
			!address.postalCode.trim() ||
			!address.country.trim()
		) {
			setError("Please fill in all required fields.");
			return;
		}

		if (!sessionId || revision === null) {
			setError("No checkout session found.");
			return;
		}

		updateMutation.mutate(
			{
				params: { id: sessionId },
				expectedRevision: revision,
				shippingAddress: {
					firstName: address.firstName.trim(),
					lastName: address.lastName.trim(),
					company: address.company?.trim() || undefined,
					line1: address.line1.trim(),
					line2: address.line2?.trim() || undefined,
					city: address.city.trim(),
					state: address.state.trim(),
					postalCode: address.postalCode.trim(),
					country: address.country.trim(),
					phone: address.phone?.trim() || undefined,
				},
			},
			{
				onSuccess: (result) => {
					syncRevisionFromBody(
						result as Record<string, unknown> | undefined,
						setRevision,
					);
					setSelectedRateId(null);
					setPhase("rates");
				},
			},
		);
	};

	const handleRateSelect = (rateId: string) => {
		setSelectedRateId(rateId);
	};

	const handleRateSubmit = (e: FormEvent) => {
		e.preventDefault();
		setRatesError("");

		if (!sessionId || revision === null) return;

		if (taxReviewRequired) {
			setRatesError(
				"Tax requires merchant review before checkout can continue.",
			);
			return;
		}

		if (rates.length === 0) {
			setRatesError("Shipping is unavailable for this address.");
			return;
		}

		checkoutState.setStep("payment");
	};

	const handleBack = () => {
		if (phase === "rates") {
			setPhase("address");
		} else {
			checkoutState.setStep("information");
		}
	};

	return (
		<CheckoutShippingTemplate
			phase={phase}
			address={address}
			error={error}
			loading={updateMutation.isPending}
			rates={rates}
			selectedRateId={selectedRateId}
			loadingRates={loadingRates}
			ratesError={ratesError}
			selectingRate={false}
			formatPrice={formatPrice}
			onFieldChange={updateField}
			onSubmit={phase === "address" ? handleAddressSubmit : handleRateSubmit}
			onRateSelect={handleRateSelect}
			onBack={handleBack}
			onEditAddress={() => setPhase("address")}
		/>
	);
});
