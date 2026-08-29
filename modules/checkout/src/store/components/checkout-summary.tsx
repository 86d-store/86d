"use client";

import { observer } from "mobx-react-lite";
import { type FormEvent, useState } from "react";
import type { CheckoutLineItem } from "../../service";
import { checkoutState } from "../../state";
import { useCheckoutApi } from "./_hooks";
import {
	formatPrice,
	hasRetainedLegacyGiftCard,
	legacyGiftCardAdjustmentPresentation,
	legacyGiftCardRecoveryLabel,
} from "./_utils";
import CheckoutSummaryTemplate from "./checkout-summary.mdx";

interface SummarySession {
	revision: number;
	subtotal: number;
	taxAmount: number;
	shippingAmount: number;
	discountAmount: number;
	giftCardAmount: number;
	storeCreditAmount: number;
	total: number;
	discountCode?: string | null;
	giftCardCode?: string | null;
}

/** Sidebar for totals, promo/store-credit entry, and legacy gift-card removal. */
export const CheckoutSummary = observer(() => {
	const api = useCheckoutApi();
	const sessionId = checkoutState.sessionId;

	const { data: sessionData } = api.getSession.useQuery(
		sessionId ? { params: { id: sessionId } } : undefined,
		{ enabled: !!sessionId },
	) as {
		data:
			| { session: SummarySession; lineItems: CheckoutLineItem[] }
			| undefined;
	};

	const session = sessionData?.session;
	const lineItems = sessionData?.lineItems ?? [];

	const [promoCode, setPromoCode] = useState("");
	const [promoError, setPromoError] = useState("");
	const [storeCreditError, setStoreCreditError] = useState("");

	const applyDiscountMutation = api.applyDiscount.useMutation({
		onSuccess: () => {
			setPromoCode("");
			setPromoError("");
			void api.getSession.invalidate();
		},
		onError: () => {
			setPromoError("Invalid promo code.");
		},
	});

	const removeDiscountMutation = api.removeDiscount.useMutation({
		onSuccess: () => void api.getSession.invalidate(),
	});

	const removeGiftCardMutation = api.removeGiftCard.useMutation({
		onSuccess: () => void api.getSession.invalidate(),
	});

	const applyStoreCreditMutation = api.applyStoreCredit.useMutation({
		onSuccess: () => {
			setStoreCreditError("");
			void api.getSession.invalidate();
		},
		onError: () => {
			setStoreCreditError("No store credit balance available.");
		},
	});

	const removeStoreCreditMutation = api.removeStoreCredit.useMutation({
		onSuccess: () => void api.getSession.invalidate(),
	});

	const handleApplyPromo = (e: FormEvent) => {
		e.preventDefault();
		const code = promoCode.trim();
		if (!code || !sessionId || !session) return;
		setPromoError("");
		applyDiscountMutation.mutate({
			params: { id: sessionId },
			expectedRevision: session.revision,
			code,
		});
	};

	const handleRemovePromo = () => {
		if (!sessionId || !session) return;
		removeDiscountMutation.mutate({
			params: { id: sessionId },
			expectedRevision: session.revision,
		});
	};

	const handleRemoveGiftCard = () => {
		if (!sessionId || !session) return;
		removeGiftCardMutation.mutate({
			params: { id: sessionId },
			expectedRevision: session.revision,
		});
	};

	const handleApplyStoreCredit = () => {
		if (!sessionId || !session) return;
		setStoreCreditError("");
		applyStoreCreditMutation.mutate({
			params: { id: sessionId },
			expectedRevision: session.revision,
		});
	};

	const handleRemoveStoreCredit = () => {
		if (!sessionId || !session) return;
		removeStoreCreditMutation.mutate({
			params: { id: sessionId },
			expectedRevision: session.revision,
		});
	};

	if (!session) return null;

	return (
		<CheckoutSummaryTemplate
			lineItems={lineItems.map((item) => ({
				...item,
				formattedPrice: formatPrice(item.price),
				formattedTotal: formatPrice(item.price * item.quantity),
			}))}
			subtotal={formatPrice(session.subtotal)}
			shipping={
				session.shippingAmount > 0 ? formatPrice(session.shippingAmount) : null
			}
			tax={session.taxAmount > 0 ? formatPrice(session.taxAmount) : null}
			discountAmount={
				session.discountAmount > 0 ? formatPrice(session.discountAmount) : null
			}
			discountCode={session.discountCode ?? null}
			giftCardAmount={
				session.giftCardAmount > 0 ? formatPrice(session.giftCardAmount) : null
			}
			legacyGiftCardAdjustment={legacyGiftCardAdjustmentPresentation(
				session.giftCardAmount,
			)}
			giftCardLabel={legacyGiftCardRecoveryLabel(session.giftCardCode)}
			showGiftCardRecovery={hasRetainedLegacyGiftCard({
				giftCardCode: session.giftCardCode,
				giftCardAmount: session.giftCardAmount,
			})}
			storeCreditAmount={
				session.storeCreditAmount > 0
					? formatPrice(session.storeCreditAmount)
					: null
			}
			total={formatPrice(session.total)}
			promoCode={promoCode}
			promoError={promoError}
			promoLoading={applyDiscountMutation.isPending}
			storeCreditError={storeCreditError}
			storeCreditLoading={
				applyStoreCreditMutation.isPending ||
				removeStoreCreditMutation.isPending
			}
			onPromoCodeChange={setPromoCode}
			onApplyPromo={handleApplyPromo}
			onRemovePromo={handleRemovePromo}
			onRemoveGiftCard={handleRemoveGiftCard}
			onApplyStoreCredit={handleApplyStoreCredit}
			onRemoveStoreCredit={handleRemoveStoreCredit}
		/>
	);
});
