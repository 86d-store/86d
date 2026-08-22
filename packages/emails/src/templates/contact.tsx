import { BaseEmail } from "./base";
import { colors, heading, mutedText, paragraph, tableHeader } from "./styles";

interface ContactProps {
	name: string;
	email: string;
	subject: string;
	message: string;
	storeName?: string | undefined;
}

export default function ContactEmail(props: ContactProps): React.ReactElement {
	return (
		<BaseEmail
			preview={`We received your message: ${props.subject}`}
			storeName={props.storeName}
		>
			<h1 style={heading}>Message Received</h1>
			<p style={paragraph}>
				Hi {props.name}, thank you for reaching out. We&apos;ve received your
				message and will get back to you as soon as possible.
			</p>

			<div
				style={{
					backgroundColor: colors.bgMuted,
					padding: "20px 24px",
					borderRadius: 6,
					marginBottom: 24,
				}}
			>
				<p
					style={{
						...tableHeader,
						margin: "0 0 8px",
						padding: 0,
					}}
				>
					Your Message
				</p>
				<p
					style={{
						...paragraph,
						margin: "0 0 12px",
						fontWeight: 600,
					}}
				>
					{props.subject}
				</p>
				<p
					style={{
						...paragraph,
						margin: 0,
						fontSize: 14,
						whiteSpace: "pre-wrap",
					}}
				>
					{props.message}
				</p>
			</div>

			<p style={mutedText}>
				This is an automated confirmation. Please do not reply to this email — a
				team member will follow up shortly.
			</p>
		</BaseEmail>
	);
}
