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
						Gift Cards
					</span>
				</div>
				<h1 className="font-bold font-display text-4xl text-foreground tracking-tight sm:text-5xl">
					Give the gift of choice
				</h1>
				<p className="mt-4 text-lg text-muted-foreground leading-relaxed">
					The perfect present for any occasion. Let them pick exactly what they
					love from our entire collection.
				</p>
			</header>

			{/* Balance checker */}
			<section className="mx-auto mt-16 max-w-lg sm:mt-20">
				<div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm sm:p-8">
					<h2 className="mb-1 text-center font-display font-semibold text-foreground text-lg tracking-tight">
						Check your balance
					</h2>
					<p className="mb-6 text-center text-muted-foreground text-sm">
						Enter your gift card code to see your remaining balance.
					</p>
					<GiftCardBalance />
				</div>
			</section>

			{/* How it works */}
			<section className="mx-auto mt-20 max-w-3xl sm:mt-28">
				<h2 className="mb-10 text-center font-display font-semibold text-2xl text-foreground tracking-tight sm:mb-12">
					How it works
				</h2>
				<div className="grid gap-8 sm:grid-cols-3 sm:gap-6">
					<div className="text-center">
						<div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-secondary text-foreground">
							<span className="font-display font-semibold text-lg">1</span>
						</div>
						<h3 className="font-display font-semibold text-foreground text-sm">
							Receive a code
						</h3>
						<p className="mt-1.5 text-muted-foreground text-sm leading-relaxed">
							Gift cards come with a unique code in the format
							GIFT-XXXX-XXXX-XXXX.
						</p>
					</div>
					<div className="text-center">
						<div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-secondary text-foreground">
							<span className="font-display font-semibold text-lg">2</span>
						</div>
						<h3 className="font-display font-semibold text-foreground text-sm">
							Shop the store
						</h3>
						<p className="mt-1.5 text-muted-foreground text-sm leading-relaxed">
							Browse our full catalog and add your favorite items to your cart.
						</p>
					</div>
					<div className="text-center">
						<div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-secondary text-foreground">
							<span className="font-display font-semibold text-lg">3</span>
						</div>
						<h3 className="font-display font-semibold text-foreground text-sm">
							Apply at checkout
						</h3>
						<p className="mt-1.5 text-muted-foreground text-sm leading-relaxed">
							Enter your gift card code during checkout to apply the balance to
							your order.
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
							How do I use a gift card?
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
							During checkout, you&apos;ll find a field to enter your gift card
							code. The balance will be applied to your order total. If the
							order exceeds your gift card balance, you can pay the remaining
							amount with another payment method.
						</p>
					</details>
					<details className="group py-4">
						<summary className="flex cursor-pointer items-center justify-between font-medium text-foreground text-sm">
							Can I use a gift card more than once?
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
							Yes. If your gift card has a remaining balance after a purchase,
							you can use the same code on future orders until the balance is
							fully used.
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
							the checker above. Active cards are ready to use, while expired
							cards can no longer be redeemed.
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

			{/* CTA */}
			<section className="mx-auto mt-20 max-w-lg text-center sm:mt-28">
				<h2 className="font-display font-semibold text-2xl text-foreground tracking-tight">
					Ready to shop?
				</h2>
				<p className="mt-2 text-muted-foreground text-sm">
					Browse our collection and find something you love.
				</p>
				<a
					href="/products"
					className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90"
				>
					Browse products
				</a>
			</section>
		</div>
	);
}
