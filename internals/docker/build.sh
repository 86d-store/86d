#!/bin/sh
set -eu

module_source=${MODULE_SOURCE:-workspace}
store_image=${STORE_IMAGE:-86d-store:local}

case "$module_source" in
	workspace | registry) ;;
	*)
		echo "MODULE_SOURCE must be either workspace or registry" >&2
		exit 2
		;;
esac

set -- docker buildx build \
	--load \
	--pull \
	--build-arg "MODULE_SOURCE=${module_source}" \
	--tag "$store_image"

if [ "$module_source" = "workspace" ]; then
	set -- "$@" --build-context "workspace-modules=./modules"
else
	set -- "$@" --build-context \
		"workspace-modules=./internals/docker/empty-context"
	checkout_revision=$(git rev-parse --verify HEAD)
	source_revision=${SOURCE_REVISION:-}
	if [ -z "$source_revision" ]; then
		echo "SOURCE_REVISION is required when MODULE_SOURCE=registry" >&2
		exit 2
	fi
	if [ "$source_revision" != "$checkout_revision" ]; then
		echo "SOURCE_REVISION must match the checked-out commit ${checkout_revision}" >&2
		exit 2
	fi
	if [ -z "${GITHUB_TOKEN:-}" ]; then
		echo "GITHUB_TOKEN is required when MODULE_SOURCE=registry" >&2
		exit 2
	fi
	set -- "$@" \
		--build-arg "SOURCE_REVISION=${source_revision}" \
		--secret "id=github_token,env=GITHUB_TOKEN"
fi

if [ -n "${TURBO_TOKEN:-}" ]; then
	set -- "$@" --secret "id=turbo_token,env=TURBO_TOKEN"
fi
if [ -n "${TURBO_TEAM:-}" ]; then
	set -- "$@" --build-arg "TURBO_TEAM=${TURBO_TEAM}"
fi

set -- "$@" .
exec "$@"
