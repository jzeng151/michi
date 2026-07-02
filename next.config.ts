import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating dev-tools badge overlaps the playback controls' corner and
  // blocks automated QA clicks; it has no production equivalent.
  devIndicators: false,
};

export default nextConfig;
