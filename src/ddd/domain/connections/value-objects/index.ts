// AIDEV-NOTE: Connection domain value objects exports
// Provides clean imports for connection-related value objects

export { ConnectionId } from './connection-id';
export { AppName } from './app-name';
export type {
  ConnectionPaginationOptions,
  PaginatedResult
} from './pagination';
export {
  createDefaultPaginationOptions,
  isValidPaginationOptions
} from './pagination';