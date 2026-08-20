import { BaseEmail } from "./base";
import * as s from "./styles";

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
			<h1 style={s.heading}>Order Complete</h1>
			<p style={s.paragraph}>
				Hi {props.customerName}, your order{" "}
				<strong>#{props.orderNumber}</strong> has been fulfilled and is
				complete.
			</p>

			<p style={s.paragraph}>
				Thank you for shopping with us. We hope you enjoy your purchase!
			</p>

			<p style={s.mutedText}>
				Have a question about your order? Reply to this email.
			</p>
		</BaseEmail>
	);
}
