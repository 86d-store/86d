import { BaseEmail } from "./base";
import { heading, mutedText, paragraph } from "./styles";

interface OrderCompletedProps {
	orderNumber: string;
	customerName: string;
	storeName?: string | undefined;
}

export default function OrderCompletedEmail(
	props: OrderCompletedProps,
): React.ReactElement {
	return (
		<BaseEmail
			preview={`Order #${props.orderNumber} is complete`}
			storeName={props.storeName}
		>
			<h1 style={heading}>Order Complete</h1>
			<p style={paragraph}>
				Hi {props.customerName}, your order{" "}
				<strong>#{props.orderNumber}</strong> has been fulfilled and is
				complete.
			</p>

			<p style={paragraph}>
				Thank you for shopping with us. We hope you enjoy your purchase!
			</p>

			<p style={mutedText}>
				Have a question about your order? Reply to this email.
			</p>
		</BaseEmail>
	);
}
