import { BaseEmail } from "./base";
import * as s from "./styles";

interface WelcomeProps {
	storeName?: string | undefined;
}

export default function WelcomeEmail(props: WelcomeProps): React.ReactElement {
	const name = props.storeName ?? "our store";
	return (
		<BaseEmail preview={`Welcome to ${name}`} storeName={props.storeName}>
			<h1 style={s.heading}>Welcome!</h1>
			<p style={s.paragraph}>
				Thanks for creating an account with {name}. We&apos;re excited to have
				you on board.
			</p>
			<p style={s.paragraph}>
				With your account you can track orders, save your favorite products, and
				check out faster.
			</p>
			<p style={s.mutedText}>
				If you didn&apos;t create this account, you can safely ignore this
				email.
			</p>
		</BaseEmail>
	);
}
