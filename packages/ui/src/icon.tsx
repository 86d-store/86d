import { Apple, Google } from "@lobehub/icons";
import type { IconProps as PhosphorIconProps } from "@phosphor-icons/react/dist/lib/types";
import type * as icons from "@phosphor-icons/react/dist/ssr";
import dynamic from "next/dynamic";

const otherIcons = {
	GoogleIcon: Google,
	AppleIcon: Apple,
};

type DynamicIcon = React.ComponentType<PhosphorIconProps>;

export type IconName = keyof typeof icons | keyof typeof otherIcons;

export interface IconProps extends PhosphorIconProps {
	name: IconName;
}

export function Icon({ name, ...props }: IconProps) {
	if (name in otherIcons) {
		const Icon = otherIcons[name as keyof typeof otherIcons];

		return <Icon {...props} />;
	}

	const DynamicIcon = dynamic(async () => {
		const mod = await import("@phosphor-icons/react/dist/ssr");
		const component = mod[name as keyof typeof mod];
		if (!component) {
			console.error(`Icon ${name} not found`);
			return () => null;
		}
		return component;
	}, {}) as DynamicIcon;

	return <DynamicIcon {...props} />;
}
