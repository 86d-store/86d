import { TriangleAlertIcon } from "lucide-react";
import { buttonVariants } from "~/components/ui/button-variants";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "~/components/ui/empty";

export default function AdminNotFound() {
	return (
		<Empty className="min-h-[60vh]">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<TriangleAlertIcon />
				</EmptyMedia>
				<EmptyTitle>Page not found</EmptyTitle>
				<EmptyDescription>
					This admin page doesn&apos;t exist or has been removed.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<a href="/admin" className={buttonVariants()}>
					Back to dashboard
				</a>
			</EmptyContent>
		</Empty>
	);
}
