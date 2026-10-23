import type {NextConfig} from "next";
const config: NextConfig = {agentRules:false, distDir:process.env.HEALTHCARE_BUILD_DIR??".next", transpilePackages: ["@pepbits/i18n", "@pepbits/components", "@pepbits/icons", "@pepbits/ui", "@pepbits/preferences", "@pepbits/tokens", "@pepbits/patterns", "@pepbits/data", "@pepbits/page-engines", "@pepbits/shell", "@pepbits/platform"], experimental: {cpus: 2}};
export default config;
