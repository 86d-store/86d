"use client";

import { useFormsApi } from "./_hooks";
import FormListTemplate from "./form-list.mdx";

interface FormSummary {
	id: string;
	name: string;
	slug: string;
	description?: string | undefined;
}

export function FormList({ title }: { title?: string | undefined }) {
	const api = useFormsApi();
	const { data, isLoading } = api.listForms.useQuery({}) as {
		data: { forms: FormSummary[] } | undefined;
		isLoading: boolean;
	};

	if (isLoading) {
		return (
			<div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
				<div className="mb-6 h-7 w-32 animate-pulse rounded-lg bg-muted" />
				<div className="flex flex-col gap-4">
					{Array.from({ length: 3 }, (_, i) => `skel-${i}`).map((key) => (
						<div
							key={key}
							className="flex flex-col gap-2 rounded-xl border border-border p-5"
						>
							<div className="h-5 w-1/3 animate-pulse rounded bg-muted" />
							<div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
						</div>
					))}
				</div>
			</div>
		);
	}

	const forms = data?.forms ?? [];
	if (forms.length === 0) return null;

	return <FormListTemplate title={title ?? "Forms"} forms={forms} />;
}
