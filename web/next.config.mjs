// AgentGuard web console — static export SPA.
//
// The console is PURE UI: it ships as static HTML/JS behind the same reverse
// proxy as the control plane, and every data call goes to the SAME-ORIGIN
// /v1/* API with the browser's cookies attached automatically. There is NO
// Next.js server runtime in production, NO session store, NO Route-Handler API
// pass-through, and NO CSRF authority here — the control plane is the sole
// session + CSRF authority (plan §M3 / NEW-CR-2). `output: 'export'` enforces
// that: any accidental server-only feature (Route Handler, server action,
// dynamic SSR) fails the build.
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  reactStrictMode: true,
  images: { unoptimized: true },
  // This package has its own lockfile; pin the workspace root so Turbopack does
  // not walk up to the main package (which triggers a multi-lockfile warning).
  turbopack: { root: import.meta.dirname },
}

export default nextConfig
