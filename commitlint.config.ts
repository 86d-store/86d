const scopes = [
	"store",
	"cli",
	"core",
	"runtime",
	"sdk",
	"registry",
	"db",
	"emails",
	"env",
	"lib",
	"storage",
	"utils",
	"modules",
	"ci",
	"deps",
	"config",
	"docs",
	"repo",
] as const;

export default {
	extends: ["@commitlint/config-conventional"],
	rules: {
		"scope-empty": [2, "never"],
		"scope-enum": [2, "always", [...scopes]],
		"subject-case": [2, "always", "lower-case"],
		"header-max-length": [2, "always", 100],
	},
};
