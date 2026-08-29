"use client";

import GiftCardComponents from "@86d-app/giftcards/components";

const { GiftCardBalance } = GiftCardComponents;

export default function GiftCardsPage() {
	return (
		<div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
			{/* Hero */}
			<header className="mx-auto max-w-2xl text-center">
				<div className="mb-6 inline-flex items-center justify-center rounded-full border border-border/60 bg-secondary/50 px-4 py-1.5">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="mr-2 text-muted-foreground"
						aria-hidden="true"
					>
						<rect x="3" y="8" width="18" height="4" rx="1" />
						<path d="M12 8v13" />
						<path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
						<path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
					</svg>
					<span className="font-medium text-muted-foreground text-xs tracking-wide">
						Gift card lookup
					</span>
				</div>
				<h1 className="font-bold font-display text-4xl text-foreground tracking-tight sm:text-5xl">
					Check a gift card
				</h1>
				<p className="mt-4 text-lg text-muted-foreground leading-relaxed">
					View the recorded balance and status of an issued gift card. Gift card
					redemption is unavailable.
				</p>
			</header>

			{/* Balance checker */}
			<section className="mx-auto mt-16 max-w-lg sm:mt-20">
				<div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm sm:p-8">
					<h2 className="mb-1 text-center font-display font-semibold text-foreground text-lg tracking-tight">
						Balance and status
					</h2>
					<p className="mb-6 text-center text-muted-foreground text-sm">
						Enter the code printed on the gift card.
					</p>
					<GiftCardBalance />
				</div>
			</section>

			{/* How it works */}
			<section className="mx-auto mt-20 max-w-3xl sm:mt-28">
				<h2 className="mb-10 text-center font-display font-semibold text-2xl text-foreground tracking-tight sm:mb-12">
					Check your card
				</h2>
				<div className="grid gap-8 sm:grid-cols-3 sm:gap-6">
					<div className="text-center">
						<div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-secondary text-foreground">
							<span className="font-display font-semibold text-lg">1</span>
						</div>
						<h3 className="font-display font-semibold text-foreground text-sm">
							Enter the code
						</h3>
						<p className="mt-1.5 text-muted-foreground text-sm leading-relaxed">
							Use the issued code in the format GIFT-XXXX-XXXX-XXXX.
						</p>
					</div>
					<div className="text-center">
						<div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-secondary text-foreground">
							<span className="font-display font-semibold text-lg">2</span>
						</div>
						<h3 className="font-display font-semibold text-foreground text-sm">
							Review the status
						</h3>
						<p className="mt-1.5 text-muted-foreground text-sm leading-relaxed">
							See whether the card is active, disabled, depleted, or expired.
						</p>
					</div>
					<div className="text-center">
						<div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-secondary text-foreground">
							<span className="font-display font-semibold text-lg">3</span>
						</div>
						<h3 className="font-display font-semibold text-foreground text-sm">
							See the balance
						</h3>
						<p className="mt-1.5 text-muted-foreground text-sm leading-relaxed">
							View the card&apos;s recorded balance without reserving or
							spending it.
						</p>
					</div>
				</div>
			</section>

			{/* FAQ */}
			<section className="mx-auto mt-20 max-w-2xl sm:mt-28">
				<h2 className="mb-8 text-center font-display font-semibold text-2xl text-foreground tracking-tight sm:mb-10">
					Frequently asked questions
				</h2>
				<div className="divide-y divide-border/60">
					<details className="group py-4">
						<summary className="flex cursor-pointer items-center justify-between font-medium text-foreground text-sm">
							Can I redeem a gift card?
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
								aria-hidden="true"
							>
								<path d="m6 9 6 6 6-6" />
							</svg>
						</summary>
						<p className="mt-3 pr-8 text-muted-foreground text-sm leading-relaxed">
							Gift card redemption is unavailable. Checking a card does not
							reserve or spend its balance.
						</p>
					</details>
					<details className="group py-4">
						<summary className="flex cursor-pointer items-center justify-between font-medium text-foreground text-sm">
							What does an active status mean?
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
								aria-hidden="true"
							>
								<path d="m6 9 6 6 6-6" />
							</svg>
						</summary>
						<p className="mt-3 pr-8 text-muted-foreground text-sm leading-relaxed">
							The issued card is not disabled, depleted, or expired. An active
							status does not mean checkout redemption is available.
						</p>
					</details>
					<details className="group py-4">
						<summary className="flex cursor-pointer items-center justify-between font-medium text-foreground text-sm">
							Do gift cards expire?
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
								aria-hidden="true"
							>
								<path d="m6 9 6 6 6-6" />
							</svg>
						</summary>
						<p className="mt-3 pr-8 text-muted-foreground text-sm leading-relaxed">
							Gift cards may have an expiration date set at the time of
							purchase. You can check your card&apos;s status and balance using
							the checker above. Expired cards report a zero balance.
						</p>
					</details>
					<details className="group py-4">
						<summary className="flex cursor-pointer items-center justify-between font-medium text-foreground text-sm">
							Can I check my balance without making a purchase?
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
								aria-hidden="true"
							>
								<path d="m6 9 6 6 6-6" />
							</svg>
						</summary>
						<p className="mt-3 pr-8 text-muted-foreground text-sm leading-relaxed">
							Absolutely. Use the balance checker at the top of this page to
							view your current balance and card status at any time.
						</p>
					</details>
				</div>
			</section>

			{/* Availability */}
			<section className="mx-auto mt-20 max-w-lg text-center sm:mt-28">
				<h2 className="font-display font-semibold text-2xl text-foreground tracking-tight">
					Balance lookup only
				</h2>
				<p className="mt-2 text-muted-foreground text-sm">
					This page does not apply a gift card to a cart or order.
				</p>
			</section>
		</div>
	);
}
