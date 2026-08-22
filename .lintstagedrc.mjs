export default {
	"*":
		"biome check --write --no-errors-on-unmatched --files-ignore-unknown=true",
	"modules/**/*.{ts,tsx,json,md,mdx}": () =>
		"bun run generate:modules && git add apps/registry/registry.lock.json",
};
