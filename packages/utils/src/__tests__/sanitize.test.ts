import { describe, expect, it } from "vitest";
import { normalizeWhitespace, sanitizeText, stripTags } from "../sanitize";

describe("stripTags", () => {
	it("removes simple HTML tags", () => {
		expect(stripTags("<p>hello</p>")).toBe("hello");
	});

	it("removes nested tags", () => {
		expect(stripTags("<div><p>hello</p></div>")).toBe("hello");
	});

	it("removes script tags and their content", () => {
		expect(stripTags('before<script>alert("xss")</script>after')).toBe(
			"beforeafter",
		);
	});

	it("removes script tags case-insensitively", () => {
		expect(stripTags('<SCRIPT>alert("xss")</SCRIPT>safe')).toBe("safe");
	});

	it("removes multiline script tags", () => {
		const input = 'before<script>\nconsole.log("x");\n</script>after';
		expect(stripTags(input)).toBe("beforeafter");
	});

	it("removes style tags and their content", () => {
		expect(stripTags("before<style>body{color:red}</style>after")).toBe(
			"beforeafter",
		);
	});

	it("removes style tags case-insensitively", () => {
		expect(stripTags("<STYLE>.x{}</STYLE>safe")).toBe("safe");
	});

	it("removes self-closing tags", () => {
		expect(stripTags("hello<br/>world")).toBe("helloworld");
	});

	it("removes tags with attributes", () => {
		expect(stripTags('<a href="http://example.com">link</a>')).toBe("link");
	});

	it("handles empty string", () => {
		expect(stripTags("")).toBe("");
	});

	it("handles string with no tags", () => {
		expect(stripTags("plain text")).toBe("plain text");
	});

	it("removes multiple script tags", () => {
		expect(
			stripTags(
				'<script>a</script>between<script type="text/javascript">b</script>end',
			),
		).toBe("betweenend");
	});
});

describe("normalizeWhitespace", () => {
	it("collapses multiple spaces", () => {
		expect(normalizeWhitespace("hello   world")).toBe("hello world");
	});

	it("trims leading and trailing whitespace", () => {
		expect(normalizeWhitespace("  hello  ")).toBe("hello");
	});

	it("collapses tabs and newlines", () => {
		expect(normalizeWhitespace("hello\t\nworld")).toBe("hello world");
	});

	it("handles empty string", () => {
		expect(normalizeWhitespace("")).toBe("");
	});

	it("handles whitespace-only string", () => {
		expect(normalizeWhitespace("   \t\n  ")).toBe("");
	});

	it("preserves single spaces", () => {
		expect(normalizeWhitespace("hello world")).toBe("hello world");
	});
});

describe("sanitizeText", () => {
	it("strips tags and normalizes whitespace", () => {
		expect(sanitizeText("<p>hello</p>  <p>world</p>")).toBe("hello world");
	});

	it("handles script injection with extra whitespace", () => {
		expect(
			sanitizeText('  <script>alert("xss")</script>  safe content  '),
		).toBe("safe content");
	});

	it("handles empty string", () => {
		expect(sanitizeText("")).toBe("");
	});

	it("cleans complex HTML with styles and scripts", () => {
		const input =
			'<style>.x{}</style><div class="foo">  <script>x</script>  text  </div>';
		expect(sanitizeText(input)).toBe("text");
	});
});
