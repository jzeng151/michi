import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // Geolocation and mic are the app's own features; everything else off.
    value: "geolocation=(self), microphone=(self), camera=(self), payment=()",
  },
];

const nextConfig: NextConfig = {
  // The floating dev-tools badge overlaps the playback controls' corner and
  // blocks automated QA clicks; it has no production equivalent.
  devIndicators: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
