// Frontend library CI/CD on jenkins.pepbits.com (pb-srv2): the same gates as the GitHub Actions "check" job
// (.github/workflows/ci.yml), each stage in a throwaway node:24-bookworm container. On main the public test site
// runtime is packaged (desktop-clients/scripts/ci/package-test-site.sh) and handed to the pb-srv5 receiver, which
// verifies, activates and health-checks it or restores the previous release:
// https://frontend.test.pepbits.com (stack frontend-test, pepbits-shared-document common/deployment/config/stacks/pb-srv5).
// Jenkins holds only the frontend-test-deploy SSH key; its forced command on pb-srv5 is bin/ci-receive.
pipeline {
  agent any
  options {
    timestamps()
    disableConcurrentBuilds()                // pb-srv2 has two CPUs; two builds of this size do not fit at once
    timeout(time: 180, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20'))
    skipDefaultCheckout(true)
  }
  environment {
    CI = 'true'
    NEXT_TELEMETRY_DISABLED = '1'
    npm_config_cache = '/var/jenkins_home/.npm/frontend-library'
    // Keep in step with the pinned checkout in .github/workflows/ci.yml.
    MOCK_SERVICES_COMMIT = '5ced4f8b021aa317859e6999d7c96ef14af63ee1'
  }
  stages {
    stage('Checkout') {
      steps {
        dir('frontend') { checkout scm }
      }
    }
    stage('Pinned simulators') {
      agent { docker { image 'node:24-bookworm'; reuseNode true } }
      steps {
        withCredentials([usernamePassword(credentialsId: 'github-app', usernameVariable: 'GH_USER', passwordVariable: 'GH_TOKEN')]) {
          sh '''
            rm -rf mock-services && git init -q mock-services
            auth=$(printf 'x-access-token:%s' "$GH_TOKEN" | base64 -w0)
            git -C mock-services -c http.extraHeader="Authorization: Basic $auth" \
              fetch -q --depth 1 https://github.com/pepbits/pepbits-mocking-app.git "$MOCK_SERVICES_COMMIT"
            git -C mock-services checkout -q FETCH_HEAD
            test "$(git -C mock-services rev-parse HEAD)" = "$MOCK_SERVICES_COMMIT"
          '''
        }
      }
    }
    stage('Install') {
      agent { docker { image 'node:24-bookworm'; reuseNode true } }
      steps {
        dir('frontend/desktop-clients') {
          sh '''
            npm ci --no-audit --no-fund
            for runtime in ../dummy-api ../dummy-api/access-runtime ../dummy-api/diagnostics-runtime ../dummy-api/quality-source \
                           ../dummy-api/quality-runtime ../dummy-api/pharmacy-runtime; do
              npm ci --no-audit --no-fund --prefix "$runtime"
            done
            npm ci --no-audit --no-fund --prefix scripts/diagnostics/style-tools --ignore-scripts
          '''
        }
      }
    }
    stage('Gates') {
      agent { docker { image 'node:24-bookworm'; reuseNode true } }
      environment { HC_RCM_MOCK_REPO = "${WORKSPACE}/mock-services" }
      steps {
        dir('frontend/desktop-clients') {
          sh '''
            node ../docs/tools/check-docs.mjs
            node --test ../docs/tools/check-docs.test.mjs ../docs/tools/documentation-contracts.test.mjs
            node ../docs/tools/documentation-lifecycle.mjs check
            npm run typecheck
            # pb-srv2 has two CPUs: the configured four workers oversubscribe it and the heaviest render tests
            # (MedBand long forms, page templates) exceed the 5 s default. Same tests, sized for this builder.
            npm test -- --maxWorkers=2 --testTimeout=30000
            npm run test:api && npm run test:e2e-registry
            npm run test:deployment
            npm run build
            npm run verify
          '''
        }
      }
    }
    stage('Package test site') {
      when { branch 'main' }
      agent { docker { image 'node:24-bookworm'; reuseNode true } }
      environment { NEXORA_DEPLOY_ROOT = "${WORKSPACE}/deploy-root" }
      steps {
        dir('frontend/desktop-clients') {
          sh '''
            rm -rf "$NEXORA_DEPLOY_ROOT" ../../release && mkdir -p ../../release
            printf '{\n  "webApiUrl": "/api",\n  "desktopApiUrl": "/api"\n}\n' > deploy.config.json
            npm run deploy:prepare
            prepared=$(ls -d "$NEXORA_DEPLOY_ROOT"/releases/*/ | tail -1)
            bash scripts/ci/package-test-site.sh "$prepared" ../../mock-services ../../release > ../../release/id
            cat ../../release/frontend-test-*.sha256
          '''
        }
      }
    }
    stage('Deploy test site') {
      when { branch 'main' }
      agent { docker { image 'node:24-bookworm'; reuseNode true } }
      steps {
        withCredentials([sshUserPrivateKey(credentialsId: 'frontend-test-deploy', keyFileVariable: 'DEPLOY_KEY')]) {
          sh '''
            release=$(cat release/id)
            digest=$(cut -d' ' -f1 "release/frontend-test-$release.sha256")
            ssh -i "$DEPLOY_KEY" -o IdentitiesOnly=yes -o UserKnownHostsFile=frontend/deploy/pb-srv5/known_hosts \
                -o StrictHostKeyChecking=yes -o BatchMode=yes deploy@148.135.138.193 \
                deploy "$release" "$digest" < "release/frontend-test-$release.tar.gz"
            for attempt in $(seq 1 30); do
              live=$(curl -fsS https://frontend.test.pepbits.com/__nexora-release.json || true)
              case "$live" in *"$release"*) echo "public site serves $release"; exit 0 ;; esac
              sleep 5
            done
            echo "public site does not serve $release: $live"; exit 1
          '''
        }
      }
    }
  }
  post {
    always {
      cleanWs(deleteDirs: true, disableDeferredWipeout: true)
    }
  }
}
