"use client";

import { useSearchParams } from "next/navigation";
import { type ComponentType, useEffect, useState } from "react";
import { checkoutState } from "../../../../modules/checkout/src/state";
import { PRODUCT_LIST_ROWS } from "../../../../modules/products/src/admin/components/_fixtures/product-list.fixtures";
import { ProductDataTable } from "../../../../modules/products/src/admin/components/product-data-table";
import { components as moduleComponents } from "../../generated/components";
import { MerchantScreenStateView } from "../../lib/merchant-ui/merchant-screen-state-view";
import {
	MERCHANT_SCREEN_STATES,
	type MerchantScreenState,
} from "../../lib/merchant-ui/screen-states";

function parseState(value: string | null): MerchantScreenState | null {
	if (value && MERCHANT_SCREEN_STATES.includes(value as MerchantScreenState)) {
		return value as MerchantScreenState;
	}
	return null;
}

const CHECKOUT_SUMMARY_FIXTURE_SESSION_ID = "merchant-ui-checkout-summary";
// Resolve the same component map as the Store runtime. Importing this component
// directly would initialize its MDX template before the generated map is ready.
const CheckoutSummary = moduleComponents.CheckoutSummary as
	| ComponentType
	| undefined;

function CheckoutSummaryFixture() {
	const [isReady, setIsReady] = useState(false);

	useEffect(() => {
		const previousSessionId = checkoutState.sessionId;
		checkoutState.setSessionId(CHECKOUT_SUMMARY_FIXTURE_SESSION_ID);
		setIsReady(true);

		return () => checkoutState.setSessionId(previousSessionId);
	}, []);

	return (
		<main className="mx-auto max-w-xl p-6">
			<h1 className="mb-4 font-semibold text-lg">Checkout summary</h1>
			{isReady && CheckoutSummary ? <CheckoutSummary /> : null}
		</main>
	);
}

export default function StoreMerchantUiFixturesPage() {
	const params = useSearchParams();
	const surface = params.get("surface") ?? "products";
	const state = parseState(params.get("state"));

	if (state) {
		return (
			<main className="mx-auto max-w-3xl p-6">
				<MerchantScreenStateView
					state={state}
					noun={{ singular: "product", plural: "products" }}
					createLabel="New product"
				/>
			</main>
		);
	}

	if (surface === "create") {
		return (
			<main className="mx-auto max-w-3xl p-6">
				<h1 className="mb-4 font-semibold text-lg">New product</h1>
				<p className="text-muted-foreground text-sm">
					Fixture shell. The live form is at /admin/products/new.
				</p>
			</main>
		);
	}

	if (surface === "checkout-summary") {
		return <CheckoutSummaryFixture />;
	}

	return (
		<main className="mx-auto max-w-5xl p-6">
			<h1 className="mb-4 font-semibold text-lg">Products</h1>
			<ProductDataTable
				data={PRODUCT_LIST_ROWS}
				onDelete={() => undefined}
				statusFilter=""
				onStatusFilterChange={() => undefined}
			/>
		</main>
	);
}
