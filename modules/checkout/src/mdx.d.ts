declare module "*.mdx" {
	import type { ComponentType } from "react";

	const Component: ComponentType<Record<string, unknown>>;
	export default Component;
}
