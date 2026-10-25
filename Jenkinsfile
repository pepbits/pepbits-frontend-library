// Root library/demo gates and immutable test-site archive. No registry install credentials needed.
pipeline {
  agent any
  options {
    timestamps()
    disableConcurrentBuilds()                // pb-srv2 has two CPUs; two builds of this size do not fit at once
    timeout(time: 180, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20'))
    skipDefaultCheckout(true)
  }
  parameters { booleanParam(name: 'DEPLOY_TEST_SITE', defaultValue: false, description: 'Owner enables after the phase 8 receiver/Compose migration and review') }
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
            set +x
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
        dir('frontend') {
          sh '''
            npm ci --no-audit --no-fund
            bash tooling/scripts/install-api.sh
          '''
        }
      }
    }
    stage('Gates') {
      agent { docker { image 'node:24-bookworm'; reuseNode true } }
      environment { HC_RCM_MOCK_REPO = "${WORKSPACE}/mock-services" }
      steps {
        dir('frontend') {
          sh '''
            bash tooling/scripts/ci-gates.sh
            npx playwright install --with-deps chromium
            npm run test:browser -w @pepbits/shell
            for demo in reports school tenant-admin healthcare erp desktop; do
              node tooling/scripts/run-demo-integration.mjs "$demo"
            done
          '''
        }
      }
    }
    stage('Package test site') {
      when { branch 'main' }
      agent { docker { image 'node:24-bookworm'; reuseNode true } }
      steps {
        dir('frontend') {
          sh '''
            node tooling/scripts/package-test-site.mjs ../mock-services ../release
            node tooling/scripts/verify-test-site.mjs ../release
          '''
        }
      }
    }
    stage('Deploy test site') {
      when { allOf { branch 'main'; expression { params.DEPLOY_TEST_SITE } } }
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
              if LIVE_RECEIPT="$live" RELEASE_EXPECTED="$release" node -e 'try { process.exit(JSON.parse(process.env.LIVE_RECEIPT).id === process.env.RELEASE_EXPECTED ? 0 : 1) } catch { process.exit(1) }'; then
                echo "public site serves $release"; exit 0
              fi
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
