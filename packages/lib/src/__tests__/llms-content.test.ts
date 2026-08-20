import { describe, expect, it } from "vitest";
import type { LlmsFullContent } from "../llms-content";
import { renderLlmsFullMarkdown } from "../llms-content";

describe("renderLlmsFullMarkdown", () => {
	it("renders store name as heading", () => {
		const content: LlmsFullContent = {
			products: [],
			collections: [],
			blogPosts: [],
		};
		const result = renderLlmsFullMarkdown(
			content,
			"Test Store",
			"https://example.com",
		);
		expect(result).toContain("# Test Store");
	});

	it("renders products section", () => {
		const content: LlmsFullContent = {
			products: [
				{
					name: "Widget",
					slug: "widget",
					shortDescription: "A nice widget",
					price: 19.99,
					images: ["/img/widget.jpg"],
				},
			],
			collections: [],
			blogPosts: [],
		};
		const result = renderLlmsFullMarkdown(
			content,
			"Store",
			"https://example.com",
		);
		expect(result).toContain("## Products");
		expect(result).toContain("### Widget");
		expect(result).toContain("- URL: https://example.com/products/widget");
		expect(result).toContain("- Price: $19.99");
		expect(result).toContain("- A nice widget");
	});

	it("skips product description when null", () => {
		const content: LlmsFullContent = {
			products: [
				{
					name: "Widget",
					slug: "widget",
					shortDescription: null,
					price: 9.99,
					images: [],
				},
			],
			collections: [],
			blogPosts: [],
		};
		const result = renderLlmsFullMarkdown(
			content,
			"Store",
			"https://example.com",
		);
		expect(result).not.toContain("- null");
	});

	it("renders collections section", () => {
		const content: LlmsFullContent = {
			products: [],
			collections: [
				{
					name: "Summer",
					slug: "summer",
					description: "Summer items",
				},
			],
			blogPosts: [],
		};
		const result = renderLlmsFullMarkdown(
			content,
			"Store",
			"https://example.com",
		);
		expect(result).toContain("## Collections");
		expect(result).toContain("### Summer");
		expect(result).toContain("- URL: https://example.com/collections/summer");
		expect(result).toContain("- Summer items");
	});

	it("renders blog section", () => {
		const content: LlmsFullContent = {
			products: [],
			collections: [],
			blogPosts: [
				{
					title: "Hello World",
					slug: "hello-world",
					excerpt: "First post",
					author: "Jane",
					publishedAt: "2026-01-01",
				},
			],
		};
		const result = renderLlmsFullMarkdown(
			content,
			"Store",
			"https://example.com",
		);
		expect(result).toContain("## Blog");
		expect(result).toContain("### Hello World");
		expect(result).toContain("- URL: https://example.com/blog/hello-world");
		expect(result).toContain("- First post");
		expect(result).toContain("- Author: Jane");
	});

	it("skips empty sections", () => {
		const content: LlmsFullContent = {
			products: [],
			collections: [],
			blogPosts: [],
		};
		const result = renderLlmsFullMarkdown(
			content,
			"Store",
			"https://example.com",
		);
		expect(result).not.toContain("## Products");
		expect(result).not.toContain("## Collections");
		expect(result).not.toContain("## Blog");
	});

	it("renders multiple products", () => {
		const content: LlmsFullContent = {
			products: [
				{
					name: "A",
					slug: "a",
					shortDescription: null,
					price: 1,
					images: [],
				},
				{
					name: "B",
					slug: "b",
					shortDescription: null,
					price: 2,
					images: [],
				},
			],
			collections: [],
			blogPosts: [],
		};
		const result = renderLlmsFullMarkdown(
			content,
			"Store",
			"https://example.com",
		);
		expect(result).toContain("### A");
		expect(result).toContain("### B");
	});

	it("formats price with two decimals", () => {
		const content: LlmsFullContent = {
			products: [
				{
					name: "Cheap",
					slug: "cheap",
					shortDescription: null,
					price: 5,
					images: [],
				},
			],
			collections: [],
			blogPosts: [],
		};
		const result = renderLlmsFullMarkdown(
			content,
			"Store",
			"https://example.com",
		);
		expect(result).toContain("- Price: $5.00");
	});
});
