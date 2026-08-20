import text from "template/llms.txt";

export async function GET() {
	return new Response(text, {
		status: 200,
		headers: {
			"Content-Type": "text/plain",
		},
	});
}
