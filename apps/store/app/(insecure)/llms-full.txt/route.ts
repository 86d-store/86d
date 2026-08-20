import { generateLlmsFullMarkdown } from "~/lib/llms-content";

export async function GET() {
	try {
		const markdown = await generateLlmsFullMarkdown();

		return new Response(markdown, {
			status: 200,
			headers: {
				"Content-Type": "text/plain; charset=utf-8",
				"Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
			},
		});
	} catch {
		// Gracefully degrade if DB is unavailable
		return new Response("# Content unavailable\n\nPlease try again later.\n", {
			status: 503,
			headers: { "Content-Type": "text/plain; charset=utf-8" },
		});
	}
}
