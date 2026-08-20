import { BaseEmail } from "./base";
import * as s from "./styles";

interface SubscriptionUpdateProps {
	storeName?: string | undefined;
}

export default function SubscriptionUpdateEmail(
	props: SubscriptionUpdateProps,
): React.ReactElement {
	return (
		<BaseEmail
			preview="Your subscription has been renewed"
			storeName={props.storeName}
		>
			<h1 style={s.heading}>Subscription Renewed</h1>
			<p style={s.paragraph}>
				Your subscription has been successfully renewed. Your access continues
				without interruption.
			</p>
			<p style={s.paragraph}>
				You can view your billing history and manage your subscription from your
				account settings.
			</p>
			<p style={s.mutedText}>Thank you for your continued support.</p>
		</BaseEmail>
	);
}
