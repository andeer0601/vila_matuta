// Public builds opt in explicitly; default production stays authenticated.
// This is a build-time public flag: keep the same value at runtime.
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEMO_MODE !== 'false');
