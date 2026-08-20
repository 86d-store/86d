import { BaseEmail } from "./base";
import * as s from "./styles";

interface ReturnApprovedProps {
	orderNumber: string;
	customerName: string;
	returnId: string;
	items?: string[] | undefined;
	instructions?: string | undefined;
	storeName?: string | undefined;
}

export default function ReturnApprovedEmail(
	props: ReturnApprovedProps,
): React.ReactElement {
	return (
		<BaseEmail
			preview={`Return approved for order ${props.orderNumber}`}
			storeName={props.storeName}
		>
			<h1 style={s.heading}>Return Approved</h1>
			<p style={s.paragraph}>
				Hi {props.customerName}, your return request for order{" "}
				<strong>#{props.orderNumber}</strong> has been approved.
			</p>

			<div
				style={{
					backgroundColor: s.colors.bgMuted,
					padding: "16px 20px",
					borderRadius: 6,
					marginBottom: 24,
				}}
			>
				<p style={{ ...s.mutedText, margin: "0 0 4px" }}>
					Return ID:{" "}
					<strong style={{ color: s.colors.text }}>{props.returnId}</strong>
				</p>
			</div>

			{props.items && props.items.length > 0 && (
				<>
					<p
						style={{
							...s.tableHeader,
							margin: "0 0 8px",
							padding: 0,
						}}
					>
						Items to Return
					</p>
					<ul
						style={{
							margin: "0 0 24px",
							paddingLeft: 20,
							fontSize: 14,
							lineHeight: "1.8",
						}}
					>
						{props.items.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</>
			)}

			{props.instructions && (
				<>
					<p
						style={{
							...s.tableHeader,
							margin: "0 0 8px",
							padding: 0,
						}}
					>
						Return Instructions
					</p>
					<p
						style={{
							...s.paragraph,
							fontSize: 14,
							whiteSpace: "pre-wrap",
						}}
					>
						{props.instructions}
					</p>
				</>
			)}

			<p style={s.mutedText}>
				Once we receive your return, we&apos;ll process your refund within 5-10
				business days.
			</p>
		</BaseEmail>
	);
}
