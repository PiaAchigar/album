import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Hide the floating Next.js dev-tools button in development.
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
      {
        protocol: 'https',
        hostname: '*.cloudflare.com',
      },
      {
        // URLs firmadas (presigned) de R2, apuntan al endpoint S3 directo
        // de la cuenta de cada organizador — distinto del dominio público
        // *.r2.dev de arriba, que ya no se usa para esto.
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
    ],
  },
  webpack: (config) => {
    // Workspace packages (e.g. @album/database) are authored for NodeNext
    // resolution and use explicit `.js` extensions on relative imports that
    // point at `.ts` source (no build step — `exports` in their
    // package.json resolves straight to `src/*.ts`). tsc's `Bundler`
    // moduleResolution already tolerates this, but webpack does not by
    // default: it treats an explicit `.js` specifier literally and never
    // looks for `.ts`. This alias tells webpack to also try `.ts`/`.tsx`
    // when a `.js` import can't be resolved literally.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
    }
    return config
  },
}

export default nextConfig
