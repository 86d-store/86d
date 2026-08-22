import { BaseEmail } from "./base";
import { colors, heading, mutedText, paragraph, tableHeader } from "./styles";

interface OrderCancelledProps {
	orderNumber: string;
	customerName: string;
	reason?: string | undefined;
	storeName?: string | undefined;
}

export default function OrderCancelledEmail(
	props: OrderCancelledProps,
): React.ReactElement {
	return (
		<BaseEmail
			preview={`Order #${props.orderNumber} has been cancelled`}
			storeName={props.storeName}
		>
			<h1 style={heading}>Order Cancelled</h1>
			<p style={paragraph}>
				Hi {props.customerName}, your order{" "}
				<strong>#{props.orderNumber}</strong> has been cancelled.
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
				If a payment was captured, a refund will be issued to your original
				payment method within 5-10 business days.
			</p>

			<p style={mutedText}>
				Questions about this cancellation? Reply to this email.
			</p>
		</BaseEmail>
	);
}
