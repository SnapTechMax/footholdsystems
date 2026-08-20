import type { NextConfig } from "next";

// Every filename the guide has ever been published under. The delivery email and
// the nurture sequence print the link as raw text, so a copy of every old name is
// sitting in somebody's inbox for good. They all land on the current file.
const RETIRED_GUIDE_PATHS = [
  "/downloads/foothold-5-levels-of-ai.pdf",
  "/downloads/Foothold-The-Five-Levels-of-AI-for-Small-Business.pdf",
];

const CURRENT_GUIDE_PATH =
  "/downloads/Foothold-The-5-Levels-of-AI-and-The-Prompts.pdf";

const nextConfig: NextConfig = {
  async redirects() {
    return RETIRED_GUIDE_PATHS.map((source) => ({
      source,
      destination: CURRENT_GUIDE_PATH,
      permanent: true,
    }));
  },
};

export default nextConfig;
