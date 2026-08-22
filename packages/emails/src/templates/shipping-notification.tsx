import { BaseEmail } from "./base";
import {
	button,
	colors,
	heading,
	mutedText,
	paragraph,
	tableHeader,
} from "./styles";

interface ShippingNotificationProps {
	orderNumber: string;
	customerName: string;
	trackingNumber?: string | undefined;
	trackingUrl?: string | undefined;
	carrier?: string | undefined;
	storeName?: string | undefined;
}

export default function ShippingNotificationEmail(
	props: ShippingNotificationProps,
): React.ReactElement {
	return (
		<BaseEmail
			preview={`Your order #${props.orderNumber} has shipped`}
			storeName={props.storeName}
		>
			<h1 style={heading}>Your Order Has Shipped</h1>
			<p style={paragraph}>
				Hi {props.customerName}, great news! Your order{" "}
				<strong>#{props.orderNumber}</strong> is on its way.
			</p>

			{(props.trackingNumber || props.carrier) && (
				<div
					style={{
						backgroundColor: colors.bgMuted,
						padding: "16px 20px",
						borderRadius: 6,
						marginBottom: 24,
					}}
				>
					{props.carrier && (
						<>
							<p
								style={{
									...tableHeader,
									margin: "0 0 4px",
									padding: 0,
								}}
							>
								Carrier
							</p>
							<p style={{ ...paragraph, margin: "0 0 12px" }}>
								{props.carrier}
							</p>
						</>
					)}
					{props.trackingNumber && (
						<>
							<p
								style={{
									...tableHeader,
									margin: "0 0 4px",
									padding: 0,
								}}
							>
								Tracking Number
							</p>
							<p style={{ ...paragraph, margin: 0 }}>{props.trackingNumber}</p>
						</>
					)}
				</div>
			)}

			{props.trackingUrl && (
				<div style={{ marginBottom: 24 }}>
					<a href={props.trackingUrl} style={button}>
						Track Your Package
					</a>
				</div>
			)}

			<p style={mutedText}>
				Delivery times vary by carrier and destination. If you have questions,
				reply to this email.
			</p>
		</BaseEmail>
	);
}
