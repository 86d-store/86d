import { BaseEmail } from "./base";
import * as s from "./styles";

interface ReviewRequestProps {
	orderNumber: string;
	customerName: string;
	items: Array<{
		name: string;
		reviewUrl?: string | undefined;
	}>;
	storeName?: string | undefined;
	storeUrl?: string | undefined;
}

export default function ReviewRequestEmail(
	props: ReviewRequestProps,
): React.ReactElement {
	return (
		<BaseEmail
			preview={`How was your order ${props.orderNumber}?`}
			storeName={props.storeName}
		>
			<h1 style={s.heading}>How Was Your Order?</h1>
			<p style={s.paragraph}>
				Hi {props.customerName}, we hope you&apos;re enjoying your recent
				purchase from order <strong>#{props.orderNumber}</strong>. We&apos;d
				love to hear what you think!
			</p>

			{props.items.length > 0 && (
				<div style={{ marginBottom: 24 }}>
					{props.items.map((item) => (
						<div
							key={item.name}
							style={{
								padding: "12px 0",
								borderBottom: `1px solid ${s.colors.border}`,
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
							}}
						>
							<span style={{ fontSize: 14 }}>{item.name}</span>
							{item.reviewUrl && (
								<a
									href={item.reviewUrl}
									style={{
										...s.button,
										fontSize: 12,
										padding: "6px 14px",
									}}
								>
									Write Review
								</a>
							)}
						</div>
					))}
				</div>
			)}

			<p style={s.paragraph}>
				Your honest feedback helps other shoppers make better decisions and
				helps us improve our products.
			</p>

			<p style={s.mutedText}>
				Thank you for shopping with {props.storeName ?? "us"}.
			</p>
		</BaseEmail>
	);
}
