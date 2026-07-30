import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        // The guide was renamed for branding. Anyone who received the delivery
        // email before the rename still has the old link sitting in their inbox,
        // so keep it working rather than handing them a 404.
        source: "/downloads/foothold-5-levels-of-ai.pdf",
        destination:
          "/downloads/Foothold-The-Five-Levels-of-AI-for-Small-Business.pdf",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
