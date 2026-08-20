import { BaseEmail } from "./base";
import * as s from "./styles";

interface RefundProcessedProps {
	orderNumber: string;
	customerName: string;
	refundAmount: number;
	currency: string;
	items?: Array<{ name: string; quantity: number; price: number }> | undefined;
	reason?: string | undefined;
	storeName?: string | undefined;
}

export default function RefundProcessedEmail(
	props: RefundProcessedProps,
): React.ReactElement {
	const fmt = (amount: number) => s.formatCurrency(amount, props.currency);

	return (
		<BaseEmail
			preview={`Refund of ${fmt(props.refundAmount)} processed for order ${props.orderNumber}`}
			storeName={props.storeName}
		>
			<h1 style={s.heading}>Refund Processed</h1>
			<p style={s.paragraph}>
				Hi {props.customerName}, a refund of{" "}
				<strong>{fmt(props.refundAmount)}</strong> has been processed for order{" "}
				<strong>#{props.orderNumber}</strong>.
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

			{props.items && props.items.length > 0 && (
				<>
					<p
						style={{
							...s.tableHeader,
							margin: "0 0 8px",
							padding: 0,
						}}
					>
						Refunded Items
					</p>
					<table
						style={{
							width: "100%",
							borderCollapse: "collapse",
							marginBottom: 24,
						}}
						cellPadding={0}
						cellSpacing={0}
					>
						<tbody>
							{props.items.map((item) => (
								<tr key={item.name} style={s.tableRow}>
									<td style={s.tableCell}>
										{item.name}{" "}
										<span style={{ color: s.colors.muted }}>
											x{item.quantity}
										</span>
									</td>
									<td
										style={{
											...s.tableCell,
											textAlign: "right",
										}}
									>
										{fmt(item.price * item.quantity)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</>
			)}

			<p style={s.paragraph}>
				Please allow 5-10 business days for the refund to appear on your
				original payment method.
			</p>

			<p style={s.mutedText}>
				Questions about your refund? Reply to this email.
			</p>
		</BaseEmail>
	);
}
