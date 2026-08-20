import { BaseEmail } from "./base";
import * as s from "./styles";

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
			<h1 style={s.heading}>Order Cancelled</h1>
			<p style={s.paragraph}>
				Hi {props.customerName}, your order{" "}
				<strong>#{props.orderNumber}</strong> has been cancelled.
			</p>

			{props.reason && (
				<div
					style={{
						backgroundColor: s.colors.bgMuted,
						padding: "16px 20px",
						borderRadius: 6,
						marginBottom: 24,
					}}
				>
					<p
						style={{
							...s.tableHeader,
							margin: "0 0 4px",
							padding: 0,
						}}
					>
						Reason
					</p>
					<p style={{ ...s.paragraph, margin: 0 }}>{props.reason}</p>
				</div>
			)}

			<p style={s.paragraph}>
				If a payment was captured, a refund will be issued to your original
				payment method within 5-10 business days.
			</p>

			<p style={s.mutedText}>
				Questions about this cancellation? Reply to this email.
			</p>
		</BaseEmail>
	);
}
