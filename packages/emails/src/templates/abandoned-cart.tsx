import { BaseEmail } from "./base";
import {
	button,
	colors,
	formatCurrency,
	heading,
	mutedText,
	paragraph,
} from "./styles";

interface AbandonedCartProps {
	customerName?: string | undefined;
	cartTotal: number;
	currency: string;
	itemCount: number;
	cartUrl: string;
	storeName?: string | undefined;
}

export default function AbandonedCartEmail(
	props: AbandonedCartProps,
): React.ReactElement {
	const fmt = (amount: number) => formatCurrency(amount, props.currency);
	const greeting = props.customerName ? `Hi ${props.customerName},` : "Hi,";
	const itemLabel = `${props.itemCount} item${props.itemCount !== 1 ? "s" : ""}`;

	return (
		<BaseEmail
			preview={`You left ${itemLabel} in your cart — complete your purchase`}
			storeName={props.storeName}
		>
			<h1 style={heading}>You left something behind</h1>
			<p style={paragraph}>
				{greeting} your cart is waiting. You have {itemLabel} totaling{" "}
				<strong>{fmt(props.cartTotal)}</strong> that you didn't check out.
			</p>

			<div
				style={{
					backgroundColor: colors.bgMuted,
					borderRadius: 8,
					padding: "20px 24px",
					marginBottom: 24,
					textAlign: "center" as const,
				}}
			>
				<p
					style={{
						margin: "0 0 4px",
						color: colors.muted,
						fontSize: 13,
					}}
				>
					Cart total
				</p>
				<p
					style={{
						margin: 0,
						fontSize: 28,
						fontWeight: 700,
						color: colors.text,
					}}
				>
					{fmt(props.cartTotal)}
				</p>
				<p
					style={{
						margin: "4px 0 0",
						color: colors.muted,
						fontSize: 13,
					}}
				>
					{itemLabel}
				</p>
			</div>

			<div style={{ textAlign: "center" as const, marginBottom: 24 }}>
				<a href={props.cartUrl} style={button}>
					Complete your purchase
				</a>
			</div>

			<p style={mutedText}>
				This link will take you directly to your cart. Items may sell out, so we
				recommend checking out soon.
			</p>
		</BaseEmail>
	);
}
