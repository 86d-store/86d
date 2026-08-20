import { BaseEmail } from "./base";
import * as s from "./styles";

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
			<h1 style={s.heading}>Message Received</h1>
			<p style={s.paragraph}>
				Hi {props.name}, thank you for reaching out. We&apos;ve received your
				message and will get back to you as soon as possible.
			</p>

			<div
				style={{
					backgroundColor: s.colors.bgMuted,
					padding: "20px 24px",
					borderRadius: 6,
					marginBottom: 24,
				}}
			>
				<p
					style={{
						...s.tableHeader,
						margin: "0 0 8px",
						padding: 0,
					}}
				>
					Your Message
				</p>
				<p
					style={{
						...s.paragraph,
						margin: "0 0 12px",
						fontWeight: 600,
					}}
				>
					{props.subject}
				</p>
				<p
					style={{
						...s.paragraph,
						margin: 0,
						fontSize: 14,
						whiteSpace: "pre-wrap",
					}}
				>
					{props.message}
				</p>
			</div>

			<p style={s.mutedText}>
				This is an automated confirmation. Please do not reply to this email — a
				team member will follow up shortly.
			</p>
		</BaseEmail>
	);
}
