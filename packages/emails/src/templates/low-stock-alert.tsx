import { BaseEmail } from "./base";
import {
	button,
	colors,
	heading,
	paragraph,
	tableCell,
	tableHeader,
	tableRow,
} from "./styles";

interface LowStockAlertProps {
	items: Array<{
		productId: string;
		productName: string;
		quantity: number;
		reserved: number;
		available: number;
		lowStockThreshold: number;
	}>;
	storeName?: string | undefined;
	adminUrl?: string | undefined;
}

export default function LowStockAlertEmail(
	props: LowStockAlertProps,
): React.ReactElement {
	const hasOutOfStock = props.items.some((item) => item.available === 0);

	return (
		<BaseEmail
			preview={`${hasOutOfStock ? "Out of stock" : "Low stock"} alert — ${props.items.length} product${props.items.length === 1 ? "" : "s"}`}
			storeName={props.storeName}
		>
			<h1 style={heading}>
				{hasOutOfStock ? "Stock Alert" : "Low Stock Alert"}
			</h1>
			<p style={paragraph}>
				The following product{props.items.length === 1 ? " is" : "s are"}{" "}
				running low on inventory and may need restocking.
			</p>

			<table
				style={{ width: "100%", borderCollapse: "collapse" }}
				cellPadding={0}
				cellSpacing={0}
			>
				<thead>
					<tr style={tableRow}>
						<th style={tableHeader}>Product</th>
						<th style={{ ...tableHeader, textAlign: "center" }}>Available</th>
						<th style={{ ...tableHeader, textAlign: "center" }}>Reserved</th>
						<th style={{ ...tableHeader, textAlign: "center" }}>Threshold</th>
					</tr>
				</thead>
				<tbody>
					{props.items.map((item) => (
						<tr key={item.productId} style={tableRow}>
							<td style={tableCell}>{item.productName}</td>
							<td
								style={{
									...tableCell,
									textAlign: "center",
									fontWeight: 600,
									color: item.available === 0 ? colors.error : colors.warning,
								}}
							>
								{item.available}
							</td>
							<td
								style={{
									...tableCell,
									textAlign: "center",
								}}
							>
								{item.reserved}
							</td>
							<td
								style={{
									...tableCell,
									textAlign: "center",
									color: colors.muted,
								}}
							>
								{item.lowStockThreshold}
							</td>
						</tr>
					))}
				</tbody>
			</table>

			{props.adminUrl && (
				<div style={{ marginTop: 24 }}>
					<a href={props.adminUrl} style={button}>
						Manage Inventory
					</a>
				</div>
			)}
		</BaseEmail>
	);
}
