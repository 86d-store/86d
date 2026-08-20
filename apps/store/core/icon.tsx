interface IconProps {
	name: string;
	className?: string;
}

export function Icon({ className }: IconProps) {
	return <span className={className} aria-hidden="true" />;
}
