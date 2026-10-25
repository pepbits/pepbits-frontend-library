import type {NextConfig} from "next";
// @allyvora/shared is the read-only source form definition, consumed as TypeScript source like the original frontend.
const config: NextConfig = {agentRules:false, distDir:process.env.ALLYVORA_BUILD_DIR??".next", transpilePackages: ["@allyvora/shared", "@pepbits/i18n", "@pepbits/components", "@pepbits/icons", "@pepbits/ui", "@pepbits/preferences", "@pepbits/tokens", "@pepbits/patterns", "@pepbits/data", "@pepbits/page-engines", "@pepbits/shell", "@pepbits/platform"], experimental: {cpus: 2}};
config.webpack = (webpackConfig) => {
  webpackConfig.resolve.conditionNames = ['pepbits-source', ...webpackConfig.resolve.conditionNames];
  return webpackConfig;
};
export default config;
