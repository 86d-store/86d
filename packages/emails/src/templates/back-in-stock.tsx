import { BaseEmail } from "./base";
import { heading, mutedText, paragraph } from "./styles";

interface BackInStockProps {
	productName: string;
	storeName?: string | undefined;
}

export default function BackInStockEmail(
	props: BackInStockProps,
): React.ReactElement {
	return (
		<BaseEmail
			preview={`${props.productName} is back in stock!`}
			storeName={props.storeName}
		>
			<h1 style={heading}>Back in Stock</h1>
			<p style={paragraph}>
				Good news! <strong>{props.productName}</strong> is back in stock and
				available for purchase.
			</p>
			<p style={paragraph}>
				Items that were previously out of stock tend to sell quickly, so
				don&apos;t wait too long.
			</p>
			<p style={mutedText}>
				You received this email because you signed up for a back-in-stock
				notification for this product.
			</p>
		</BaseEmail>
	);
}
