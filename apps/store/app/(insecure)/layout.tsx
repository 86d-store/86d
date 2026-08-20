import { getStoreConfig } from "@86d-app/sdk/get-store-config";
import { logger } from "utils/logger";
import { AppLayout } from "~/components/app-layout";
import {
	evaluateManagedCommerceConfig,
	isManagedStoreRuntime,
} from "~/lib/store-commerce-availability";
import { resolveTemplatePath } from "~/lib/template-path";

function StoreUnavailable() {
	return (
		<main className="flex min-h-[70vh] items-center justify-center px-6 py-20">
			<section
				aria-labelledby="store-unavailable-title"
				className="mx-auto max-w-lg text-center"
			>
				<p className="mb-3 font-medium text-muted-foreground text-sm uppercase tracking-wide">
					Store unavailable
				</p>
				<h1
					id="store-unavailable-title"
					className="font-semibold text-3xl tracking-tight sm:text-4xl"
				>
					We’ll be back soon.
				</h1>
				<p className="mt-4 text-base text-muted-foreground leading-7">
					This store is temporarily unable to accept purchases. Please check
					back shortly.
				</p>
			</section>
		</main>
	);
}

export default async function InsecureLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const managed = isManagedStoreRuntime();

	try {
		const config = await getStoreConfig({
			templatePath: resolveTemplatePath(),
		});
		if (managed && !evaluateManagedCommerceConfig(config).available) {
			return <StoreUnavailable />;
		}
		return <AppLayout config={config}>{children}</AppLayout>;
	} catch (error) {
		if (!managed) throw error;
		logger.warn("Managed Storefront configuration is unavailable", {
			error: error instanceof Error ? error.message : "Unknown error",
		});
		return <StoreUnavailable />;
	}
}
