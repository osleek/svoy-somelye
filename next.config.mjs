const nextConfig = {
  outputFileTracingIncludes: {
    '/**': ['./data/**'],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
