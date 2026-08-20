import { BaseEmail } from "./base";
import * as s from "./styles";

interface SubscriptionCancelProps {
	storeName?: string | undefined;
}

export default function SubscriptionCancelEmail(
	props: SubscriptionCancelProps,
): React.ReactElement {
	return (
		<BaseEmail
			preview="Your subscription has been cancelled"
			storeName={props.storeName}
		>
			<h1 style={s.heading}>Subscription Cancelled</h1>
			<p style={s.paragraph}>
				Your subscription has been cancelled. You will continue to have access
				until the end of your current billing period.
			</p>
			<p style={s.paragraph}>
				If you change your mind, you can resubscribe at any time from your
				account settings.
			</p>
			<p style={s.mutedText}>
				We&apos;re sorry to see you go. If there&apos;s anything we could have
				done better, we&apos;d love to hear your feedback.
			</p>
		</BaseEmail>
	);
}
