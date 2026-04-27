import "@testing-library/jest-dom/vitest"

// jsdom does not implement ResizeObserver; provide a no-op stub so components
// that use it (e.g. OrbitalCanvas) don't throw in tests.
if (!global.ResizeObserver) {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
