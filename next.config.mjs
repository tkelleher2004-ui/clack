/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ["apify-client"],
  async rewrites() {
    return [
      // TikTok domain verification appends trailing slash; serve file content at both URLs
      {
        source: "/tiktokscmRWsc5iv5jT4pT4oaCpbku1edQtVxO.txt/",
        destination: "/tiktokscmRWsc5iv5jT4pT4oaCpbku1edQtVxO.txt",
      },
      {
        source: "/terms/tiktok6Iu450gYZ4ZiM7QgTKF11iiotEaeoCt1.txt/",
        destination: "/terms/tiktok6Iu450gYZ4ZiM7QgTKF11iiotEaeoCt1.txt",
      },
      {
        source: "/privacy/tiktokAQPkg6vhhh7wuhS1htskPmLf0IoCDnRt.txt/",
        destination: "/privacy/tiktokAQPkg6vhhh7wuhS1htskPmLf0IoCDnRt.txt",
      },
      {
        source: "/tiktokdOvNnlJQjWWhPJVUCQvvkcI3OdfvHqVe.txt/",
        destination: "/tiktokdOvNnlJQjWWhPJVUCQvvkcI3OdfvHqVe.txt",
      },
    ];
  },
};

export default nextConfig;
