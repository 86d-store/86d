import { BaseEmail } from "./base";
import * as s from "./styles";

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
			<h1 style={s.heading}>
				{hasOutOfStock ? "Stock Alert" : "Low Stock Alert"}
			</h1>
			<p style={s.paragraph}>
				The following product{props.items.length === 1 ? " is" : "s are"}{" "}
				running low on inventory and may need restocking.
			</p>

			<table
				style={{ width: "100%", borderCollapse: "collapse" }}
				cellPadding={0}
				cellSpacing={0}
			>
				<thead>
					<tr style={s.tableRow}>
						<th style={s.tableHeader}>Product</th>
						<th style={{ ...s.tableHeader, textAlign: "center" }}>Available</th>
						<th style={{ ...s.tableHeader, textAlign: "center" }}>Reserved</th>
						<th style={{ ...s.tableHeader, textAlign: "center" }}>Threshold</th>
					</tr>
				</thead>
				<tbody>
					{props.items.map((item) => (
						<tr key={item.productId} style={s.tableRow}>
							<td style={s.tableCell}>{item.productName}</td>
							<td
								style={{
									...s.tableCell,
									textAlign: "center",
									fontWeight: 600,
									color:
										item.available === 0 ? s.colors.error : s.colors.warning,
								}}
							>
								{item.available}
							</td>
							<td
								style={{
									...s.tableCell,
									textAlign: "center",
								}}
							>
								{item.reserved}
							</td>
							<td
								style={{
									...s.tableCell,
									textAlign: "center",
									color: s.colors.muted,
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
					<a href={props.adminUrl} style={s.button}>
						Manage Inventory
					</a>
				</div>
			)}
		</BaseEmail>
	);
}
