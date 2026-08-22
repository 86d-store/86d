import { BaseEmail } from "./base";
import {
	button,
	colors,
	formatCurrency,
	heading,
	mutedText,
	paragraph,
	tableHeader,
} from "./styles";

interface PaymentFailedProps {
	orderNumber?: string | undefined;
	customerName: string;
	amount?: number | undefined;
	currency?: string | undefined;
	reason?: string | undefined;
	retryUrl?: string | undefined;
	storeName?: string | undefined;
}

export default function PaymentFailedEmail(
	props: PaymentFailedProps,
): React.ReactElement {
	const fmt =
		props.amount != null
			? formatCurrency(props.amount, props.currency ?? "USD")
			: null;

	return (
		<BaseEmail
			preview={`Payment failed${props.orderNumber ? ` for order #${props.orderNumber}` : ""}`}
			storeName={props.storeName}
		>
			<h1 style={heading}>Payment Failed</h1>
			<p style={paragraph}>
				Hi {props.customerName}, we were unable to process your payment
				{fmt && (
					<>
						{" "}
						of <strong>{fmt}</strong>
					</>
				)}
				{props.orderNumber && (
					<>
						{" "}
						for order <strong>#{props.orderNumber}</strong>
					</>
				)}
				.
			</p>

			{props.reason && (
				<div
					style={{
						backgroundColor: colors.bgMuted,
						padding: "16px 20px",
						borderRadius: 6,
						marginBottom: 24,
					}}
				>
					<p
						style={{
							...tableHeader,
							margin: "0 0 4px",
							padding: 0,
						}}
					>
						Reason
					</p>
					<p style={{ ...paragraph, margin: 0 }}>{props.reason}</p>
				</div>
			)}

			<p style={paragraph}>
				Please update your payment method and try again. If the problem
				persists, contact your bank or card issuer.
			</p>

			{props.retryUrl && (
				<div style={{ marginBottom: 24 }}>
					<a href={props.retryUrl} style={button}>
						Retry Payment
					</a>
				</div>
			)}

			<p style={mutedText}>
				Need help? Reply to this email and we'll assist you.
			</p>
		</BaseEmail>
	);
}
