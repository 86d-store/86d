import { cn } from "~/lib/utils";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
} from "~/shadcn/breadcrumb";
import { Field, FieldContent, FieldDescription } from "~/shadcn/field";
import { Separator } from "~/shadcn/separator";
import { View } from "~/view";

export interface DestructiveSectionProps
	extends Omit<React.ComponentProps<"div">, "title"> {
	title: React.ReactNode;
	description: React.ReactNode;
}

export function DestructiveSection({
	title,
	description,
	className,
	children,
	...props
}: DestructiveSectionProps) {
	return (
		<View
			data-slot="destructive-section"
			className={cn("flex flex-col gap-3", className)}
			{...props}
		>
			<Separator />
			<header
				data-slot="destructive-section-header"
				className="flex min-h-8 items-center justify-between gap-4"
			>
				<Breadcrumb className="min-w-0">
					<BreadcrumbList>
						<BreadcrumbItem className="min-w-0">
							<BreadcrumbPage className="max-w-64 truncate text-destructive">
								{title}
							</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</header>
			<Field orientation="horizontal">
				<FieldContent>
					<FieldDescription className="text-pretty text-destructive-500">
						{description}
					</FieldDescription>
				</FieldContent>
				{children}
			</Field>
		</View>
	);
}
