import '@testing-library/jest-dom/vitest'
import { beforeAll, vi } from 'vitest'

// Mock next/router
vi.mock('next/router', () => ({
  useRouter: () => ({
    route: '/',
    pathname: '/',
    query: {},
    asPath: '/',
    push: vi.fn(),
    pop: vi.fn(),
    reload: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn().mockResolvedValue(undefined),
    beforePopState: vi.fn(),
    events: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    },
  }),
}))

// Mock next/navigation (App Router)
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

// Mock NextAuth
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: null,
    status: 'loading',
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
}))

// Mock the main database client to avoid connection issues in tests
vi.mock('@/lib/db/client', () => ({
  db: vi.fn(),
  rawClient: vi.fn(),
  createNotificationClient: vi.fn(),
  getConnectionStats: vi.fn(),
}))

// Environment variables
beforeAll(() => {
  process.env.NEXTAUTH_URL = 'http://localhost:3000'
  process.env.NEXTAUTH_SECRET = 'test-secret'
  process.env.NODE_ENV = 'test'
  // Mock DATABASE_URL to prevent connection attempts
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
})

// Global mocks for browser APIs
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })),
})

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })),
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock console methods to reduce noise during tests (optional)
vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})