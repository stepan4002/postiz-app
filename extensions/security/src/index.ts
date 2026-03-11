// @social/security barrel exports
// Phase 8 Plan 02: SSRF protection utility

// SSRF guard: assertSafeUrl — validates URLs against private ranges, internal hostnames, non-HTTPS
export * from './ssrf.guard';
