import { BaseEmail } from "./base";
import * as s from "./styles";

interface OrderConfirmationProps {
	orderNumber: string;
	customerName: string;
	items: Array<{ name: string; quantity: number; price: number }>;
	subtotal: number;
	taxAmount: number;
	shippingAmount: number;
	discountAmount: number;
	total: number;
	currency: string;
	shippingAddress?:
		| {
				firstName: string;
				lastName: string;
				line1: string;
				line2?: string | undefined;
				city: string;
				state: string;
				postalCode: string;
				country: string;
		  }
		| undefined;
	storeName?: string | undefined;
}

export default function OrderConfirmationEmail(
	props: OrderConfirmationProps,
): React.ReactElement {
	const fmt = (amount: number) => s.formatCurrency(amount, props.currency);

	return (
		<BaseEmail
			preview={`Order confirmed — #${props.orderNumber} (${fmt(props.total)})`}
			storeName={props.storeName}
		>
			<h1 style={s.heading}>Order Confirmed</h1>
			<p style={s.paragraph}>
				Hi {props.customerName}, thank you for your order! We've received your
				order <strong>#{props.orderNumber}</strong> and it's being processed.
			</p>

			{/* Items table */}
			<p
				style={{
					...s.tableHeader,
					margin: "0 0 8px",
					padding: 0,
				}}
			>
				Items
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
								<span style={{ color: s.colors.muted }}>x{item.quantity}</span>
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

			{/* Order summary */}
			<div
				style={{
					backgroundColor: s.colors.bgMuted,
					padding: "16px 20px",
					borderRadius: 6,
					marginBottom: 24,
				}}
			>
				<table
					style={{ width: "100%", borderCollapse: "collapse" }}
					cellPadding={0}
					cellSpacing={0}
				>
					<tbody>
						<tr>
							<td style={{ ...s.tableCell, padding: "4px 0" }}>Subtotal</td>
							<td
								style={{
									...s.tableCell,
									padding: "4px 0",
									textAlign: "right",
								}}
							>
								{fmt(props.subtotal)}
							</td>
						</tr>
						{props.shippingAmount > 0 && (
							<tr>
								<td style={{ ...s.tableCell, padding: "4px 0" }}>Shipping</td>
								<td
									style={{
										...s.tableCell,
										padding: "4px 0",
										textAlign: "right",
									}}
								>
									{fmt(props.shippingAmount)}
								</td>
							</tr>
						)}
						{props.taxAmount > 0 && (
							<tr>
								<td style={{ ...s.tableCell, padding: "4px 0" }}>Tax</td>
								<td
									style={{
										...s.tableCell,
										padding: "4px 0",
										textAlign: "right",
									}}
								>
									{fmt(props.taxAmount)}
								</td>
							</tr>
						)}
						{props.discountAmount > 0 && (
							<tr>
								<td
									style={{
										...s.tableCell,
										padding: "4px 0",
										color: s.colors.success,
									}}
								>
									Discount
								</td>
								<td
									style={{
										...s.tableCell,
										padding: "4px 0",
										textAlign: "right",
										color: s.colors.success,
									}}
								>
									-{fmt(props.discountAmount)}
								</td>
							</tr>
						)}
						<tr
							style={{
								borderTop: `1px solid ${s.colors.border}`,
							}}
						>
							<td
								style={{
									...s.tableCell,
									padding: "8px 0 4px",
									fontWeight: 700,
								}}
							>
								Total
							</td>
							<td
								style={{
									...s.tableCell,
									padding: "8px 0 4px",
									textAlign: "right",
									fontWeight: 700,
								}}
							>
								{fmt(props.total)}
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			{/* Shipping address */}
			{props.shippingAddress && (
				<div style={{ marginBottom: 24 }}>
					<p
						style={{
							...s.tableHeader,
							margin: "0 0 8px",
							padding: 0,
						}}
					>
						Shipping To
					</p>
					<p style={{ ...s.paragraph, margin: 0 }}>
						{props.shippingAddress.firstName} {props.shippingAddress.lastName}
						<br />
						{props.shippingAddress.line1}
						{props.shippingAddress.line2 && (
							<>
								<br />
								{props.shippingAddress.line2}
							</>
						)}
						<br />
						{props.shippingAddress.city}, {props.shippingAddress.state}{" "}
						{props.shippingAddress.postalCode}
						<br />
						{props.shippingAddress.country}
					</p>
				</div>
			)}

			<p style={s.mutedText}>
				We'll send you a shipping confirmation when your order is on its way.
			</p>
		</BaseEmail>
	);
}
