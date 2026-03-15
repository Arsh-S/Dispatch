/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_DISPATCH_OUTPUT_PATH: process.env.NEXT_PUBLIC_DISPATCH_OUTPUT_PATH || "/dispatch-output.json",
    NEXT_PUBLIC_POLL_INTERVAL_MS: process.env.NEXT_PUBLIC_POLL_INTERVAL_MS || "2000",
  },
};

export default nextConfig;
