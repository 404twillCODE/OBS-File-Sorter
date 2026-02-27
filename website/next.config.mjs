/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath: process.env.NODE_ENV === "production" ? "/OBS-File-Sorter" : "",
  assetPrefix: process.env.NODE_ENV === "production" ? "/OBS-File-Sorter/" : "",
  images: { unoptimized: true },
};

export default nextConfig;
