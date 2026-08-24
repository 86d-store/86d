#!/bin/sh
set -eu

compose_file=${COMPOSE_FILE:-docker-compose.yml}
project_name="86d-verify-$$"
wait_timeout=${DOCKER_VERIFY_TIMEOUT_SECONDS:-300}

case "$wait_timeout" in
	'' | *[!0-9]*)
		echo "DOCKER_VERIFY_TIMEOUT_SECONDS must be a positive integer" >&2
		exit 2
		;;
esac
if [ "$wait_timeout" -eq 0 ]; then
	echo "DOCKER_VERIFY_TIMEOUT_SECONDS must be greater than zero" >&2
	exit 2
fi

bunx vitest run internals/docker/__tests__

runtime_contract_tmp=$(mktemp -d "${TMPDIR:-/tmp}/86d-runtime-contract.XXXXXX")

export STORE_IMAGE=${STORE_IMAGE:-86d-store:local}
BETTER_AUTH_SECRET=$(bun -e 'console.log(Buffer.from(crypto.getRandomValues(new Uint8Array(48))).toString("base64"))')
export BETTER_AUTH_SECRET
# Publish on ephemeral host ports so parallel smoke runs cannot collide with
# developer services. Health is asserted through the published Store port.
export POSTGRES_PUBLISH_PORT=0
export STORE_PUBLISH_PORT=0
export MINIO_API_PUBLISH_PORT=0
export MINIO_CONSOLE_PUBLISH_PORT=0

compose() {
	docker compose --file "$compose_file" --project-name "$project_name" "$@"
}

assert_external_health() {
	bun -e '
		const response = await fetch(Bun.argv[1]);
		const body = await response.json();
		if (!response.ok || body.status !== "healthy" || body.checks?.app !== "ok" || body.checks?.database !== "ok" || body.checks?.storage !== "ok") {
			throw new Error(`Store health check failed: ${response.status} ${JSON.stringify(body)}`);
		}
	' "$1"
}

external_health_url() {
	published_address=$(compose port store 3000 | sed -n '1p')
	published_port=${published_address##*:}
	case "$published_port" in
		'' | *[!0-9]*)
			echo "Could not resolve the Store's ephemeral published port" >&2
			return 1
			;;
	esac
	echo "http://127.0.0.1:${published_port}/api/health"
}

cleanup() {
	status=$?
	trap - EXIT HUP INT TERM
	if [ "$status" -ne 0 ]; then
		compose ps --all >&2 || true
		compose logs --no-color --tail 200 >&2 || true
	fi
	compose down --volumes --remove-orphans >/dev/null 2>&1 || true
	rm -rf "$runtime_contract_tmp"
	exit "$status"
}
trap cleanup EXIT HUP INT TERM

bun internals/docker/verify-runtime-contract.ts \
	selected-module-manifest modules \
	"$runtime_contract_tmp/module-package-names.json"

compose up \
	--detach \
	--no-build \
	--wait \
	--wait-timeout "$wait_timeout" \
	store

health_url=$(external_health_url)
assert_external_health "$health_url"

container_uid=$(compose exec --no-TTY store id -u)
if [ "$container_uid" != "1001" ]; then
	echo "Store container runs as unexpected uid ${container_uid}" >&2
	exit 1
fi

compose exec --no-TTY store sh -c '
	test ! -e /app/internals/docker/verify-runtime-contract.ts
	test ! -e /app/internals/docker/module-package-names.json
'
compose cp \
	internals/docker/verify-runtime-contract.ts \
	store:/app/internals/docker/verify-runtime-contract.ts
compose cp \
	"$runtime_contract_tmp/module-package-names.json" \
	store:/app/internals/docker/module-package-names.json
compose exec --no-TTY store bun \
	/app/internals/docker/verify-runtime-contract.ts \
	runner /app /app/internals/docker/module-package-names.json
compose exec --no-TTY store rm -f \
	/app/internals/docker/verify-runtime-contract.ts \
	/app/internals/docker/module-package-names.json

# Restart exercises idempotent migration/seed startup. Poll within the same
# bound, then repeat the exact external health JSON assertion.
compose restart store
compose up \
	--detach \
	--no-build \
	--wait \
	--wait-timeout "$wait_timeout" \
	store
health_url=$(external_health_url)
assert_external_health "$health_url"

echo "Docker smoke passed for ${STORE_IMAGE}"
