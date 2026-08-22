import { BaseEmail } from "./base";
import { button, formatDate, heading, mutedText, paragraph } from "./styles";

interface DeliveryConfirmationProps {
	orderNumber: string;
	customerName: string;
	deliveredAt?: string | undefined;
	storeName?: string | undefined;
	reviewUrl?: string | undefined;
}

export default function DeliveryConfirmationEmail(
	props: DeliveryConfirmationProps,
): React.ReactElement {
	return (
		<BaseEmail
			preview={`Your order #${props.orderNumber} has been delivered`}
			storeName={props.storeName}
		>
			<h1 style={heading}>Your Order Has Been Delivered</h1>
			<p style={paragraph}>
				Hi {props.customerName}, your order{" "}
				<strong>#{props.orderNumber}</strong> has been delivered
				{props.deliveredAt && (
					<>
						{" "}
						on <strong>{formatDate(props.deliveredAt)}</strong>
					</>
				)}
				.
			</p>

			<p style={paragraph}>
				We hope you love your purchase! If anything isn't right, please let us
				know.
			</p>

			{props.reviewUrl && (
				<div style={{ marginBottom: 24 }}>
					<a href={props.reviewUrl} style={button}>
						Leave a Review
					</a>
				</div>
			)}

			<p style={mutedText}>Questions about your order? Reply to this email.</p>
		</BaseEmail>
	);
}
