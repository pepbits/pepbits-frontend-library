import type {NextConfig} from "next";
const config: NextConfig = {agentRules:false, output:"standalone", distDir:process.env.ONBOARDING_BUILD_DIR??".next", transpilePackages: ["@pepbits/i18n", "@pepbits/components", "@pepbits/icons", "@pepbits/ui", "@pepbits/preferences", "@pepbits/tokens", "@pepbits/patterns", "@pepbits/data", "@pepbits/page-engines", "@pepbits/shell", "@pepbits/platform"], experimental: {cpus: 2},
  // Source security headers (demo-pages/orvia-health-onboarding/next.config.mjs), retained for the hosted app.
  poweredByHeader: false,
  async headers() {return [{source: "/(.*)", headers: [{key: "X-Content-Type-Options", value: "nosniff"}, {key: "X-Frame-Options", value: "DENY"}, {key: "Referrer-Policy", value: "strict-origin-when-cross-origin"}, {key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()"}]}];}};
config.webpack = (webpackConfig) => {
  webpackConfig.resolve.conditionNames = ['pepbits-source', ...webpackConfig.resolve.conditionNames];
  return webpackConfig;
};
export default config;
