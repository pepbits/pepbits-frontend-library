#!/usr/bin/env bash
# Package the public test site runtime (https://frontend.test.pepbits.com, stack frontend-test on pb-srv5).
#
#   scripts/ci/package-test-site.sh <prepared release dir> <pepbits-mocking-app checkout> <output dir>
#
# Run from desktop-clients after the CI gates, `npm run deploy:prepare` (deploy.config.json with "/api") and the
# dummy-api runtime installs. Writes <output>/frontend-test-<release>.tar.gz and .sha256 and prints the release id.
# The archive has one folder named after the release, which the pb-srv5 receiver (bin/ci-receive) requires:
#   src/   dummy-api (without demo data) + desktop-clients/{packages,node_modules,package.json} it imports at runtime
#   web/   the prepared release (Next standalone web shell, desktop SPA, release.json)
#   mock/  the payment/insurance/collection simulators
set -euo pipefail
release_dir=$(cd -- "${1:?prepared release dir}" && pwd)
mock_repo=$(cd -- "${2:?pepbits-mocking-app checkout}" && pwd)
mkdir -p -- "${3:?output dir}"
out=$(cd -- "$3" && pwd)
workspace=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
repository=$(dirname -- "$workspace")

release=$(node -e 'const r=require(process.argv[1]); if(r.webApiUrl!=="/api"||r.desktopApiUrl!=="/api") throw new Error("release must use /api, not "+r.webApiUrl); process.stdout.write(r.id)' "$release_dir/release.json")
[[ $release =~ ^[0-9]{17}-[0-9a-f]{8}$ ]] || { echo "Unexpected release id: $release" >&2; exit 1; }

staging=$(mktemp -d)
trap 'rm -rf -- "$staging"' EXIT
root=$staging/$release
mkdir -p "$root/src/desktop-clients" "$root/mock"
cp -a "$repository/dummy-api" "$root/src/"
rm -rf "$root/src/dummy-api/.data" "$root/src/dummy-api/data"
cp -a "$workspace/packages" "$workspace/package.json" "$root/src/desktop-clients/"
cp -a "$workspace/node_modules" "$root/src/desktop-clients/"
# Workspace links to the two shells point at apps/, which the runtime does not ship.
rm -f "$root/src/desktop-clients/node_modules/web" "$root/src/desktop-clients/node_modules/desktop"
cp -a "$release_dir" "$root/web"
cp -a "$mock_repo/mockpay" "$mock_repo/pyproject.toml" "$root/mock/"
find "$root" -name __pycache__ -prune -exec rm -rf {} +

frontend_commit=$(git -C "$repository" rev-parse HEAD)
mock_commit=$(git -C "$mock_repo" rev-parse HEAD)
cat > "$root/BUILD.json" <<JSON
{"release":"$release","frontendCommit":"$frontend_commit","mockServicesCommit":"$mock_commit","node":"$(node -p 'process.versions.node')","built":"$(date -u +%FT%TZ)"}
JSON

archive=$out/frontend-test-$release.tar.gz
tar -C "$staging" -czf "$archive" "$release"
(cd -- "$out" && sha256sum "frontend-test-$release.tar.gz" > "frontend-test-$release.sha256")
echo "$release"
