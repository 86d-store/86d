"use client";

import type { MDXComponents } from "mdx/types";
import { CheckoutForm } from "./checkout-form";
import { CheckoutInformation } from "./checkout-information";
import { CheckoutPayment } from "./checkout-payment";
import { CheckoutReview } from "./checkout-review";
import { CheckoutShipping } from "./checkout-shipping";
import { CheckoutSummary } from "./checkout-summary";
import { OrderConfirmation } from "./order-confirmation";

export default {
	CheckoutForm,
	CheckoutInformation,
	CheckoutShipping,
	CheckoutPayment,
	CheckoutReview,
	CheckoutSummary,
	OrderConfirmation,
} satisfies MDXComponents;
