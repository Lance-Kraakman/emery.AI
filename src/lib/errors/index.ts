/**
 * Error classes for structured error handling.
 *
 * These error classes provide structured information that can be
 * serialized to JSON for API responses and parsed by consumers.
 */

export {
  PermissionDeniedError,
  isPermissionDeniedError,
  type PermissionDeniedErrorParams,
  type PermissionDeniedJSON,
} from './permission-denied-error';
