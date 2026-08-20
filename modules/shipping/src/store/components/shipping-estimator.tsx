"use client";

import { observer } from "@86d-app/core/state";
import { type FormEvent, useState } from "react";
import type { CalculatedRate } from "../../service";
import { useShippingApi } from "./_hooks";
import { formatPrice } from "./_utils";
import ShippingEstimatorTemplate from "./shipping-estimator.mdx";

/** Shipping cost estimator — customers enter country to preview rates. */
export const ShippingEstimator = observer(() => {
	const api = useShippingApi();
	const [country, setCountry] = useState("US");
	const [orderAmount, setOrderAmount] = useState("");
	const [rates, setRates] = useState<CalculatedRate[]>([]);
	const [hasSearched, setHasSearched] = useState(false);
	const [error, setError] = useState("");

	const calculateMutation = api.calculateRates.useMutation({
		onSuccess: (data: { rates: CalculatedRate[] }) => {
			setRates(data.rates);
			setHasSearched(true);
			setError("");
		},
		onError: () => {
			setError("Unable to estimate shipping. Please try again.");
			setRates([]);
		},
	});

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		setError("");

		const amountCents = Math.round(Number.parseFloat(orderAmount || "0") * 100);

		calculateMutation.mutate({
			country,
			orderAmount: amountCents,
		});
	};

	const formattedRates = rates.map((r) => ({
		rateId: r.id,
		zoneName: r.zoneName,
		rateName: r.name,
		formattedPrice: r.price === 0 ? "Free" : formatPrice(r.price),
	}));

	return (
		<ShippingEstimatorTemplate
			country={country}
			orderAmount={orderAmount}
			rates={formattedRates}
			hasSearched={hasSearched}
			error={error}
			loading={calculateMutation.isPending}
			onCountryChange={setCountry}
			onOrderAmountChange={setOrderAmount}
			onSubmit={handleSubmit}
		/>
	);
});
