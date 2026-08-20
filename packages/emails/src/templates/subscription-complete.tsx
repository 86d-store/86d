import { BaseEmail } from "./base";
import * as s from "./styles";

interface SubscriptionCompleteProps {
	storeName?: string | undefined;
}

export default function SubscriptionCompleteEmail(
	props: SubscriptionCompleteProps,
): React.ReactElement {
	return (
		<BaseEmail
			preview="Your subscription is confirmed"
			storeName={props.storeName}
		>
			<h1 style={s.heading}>Subscription Confirmed</h1>
			<p style={s.paragraph}>
				Your subscription has been set up successfully. You now have full access
				to your plan benefits.
			</p>
			<p style={s.paragraph}>
				You&apos;ll receive a notification before each renewal. You can manage
				your subscription at any time from your account settings.
			</p>
			<p style={s.mutedText}>
				Thank you for subscribing with {props.storeName ?? "us"}.
			</p>
		</BaseEmail>
	);
}
