/**
 * gRPC TLS credential loader for Node.js clients.
 *
 * Loads mTLS certificates from environment variables for secure
 * client-to-server gRPC communication.
 *
 * Env vars:
 * - GRPC_CA_CERT: PEM-encoded CA certificate (trust anchor)
 * - GRPC_CLIENT_CERT: PEM-encoded client certificate
 * - GRPC_CLIENT_KEY: PEM-encoded client private key
 *
 * Behavior:
 * - Production: requires all 3 env vars, throws on missing
 * - Development: falls back to insecure if no env vars set
 * - Partial config (some set, some not): always throws
 */

import * as grpc from '@grpc/grpc-js';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Get gRPC client credentials for connecting to Python gRPC servers.
 * Returns mTLS credentials when cert env vars are set, insecure in dev without certs.
 */
export function getGrpcClientCredentials(): grpc.ChannelCredentials {
  const caCert = process.env.GRPC_CA_CERT;
  const clientCert = process.env.GRPC_CLIENT_CERT;
  const clientKey = process.env.GRPC_CLIENT_KEY;

  // No certs configured
  if (!caCert && !clientCert && !clientKey) {
    if (isDev) {
      return grpc.credentials.createInsecure();
    }
    throw new Error(
      'gRPC TLS credentials required in production. ' +
      'Set GRPC_CA_CERT, GRPC_CLIENT_CERT, GRPC_CLIENT_KEY env vars.'
    );
  }

  // Partial config is always an error
  if (!caCert || !clientCert || !clientKey) {
    throw new Error(
      'Incomplete gRPC TLS configuration. All three required: ' +
      'GRPC_CA_CERT, GRPC_CLIENT_CERT, GRPC_CLIENT_KEY'
    );
  }

  return grpc.credentials.createSsl(
    Buffer.from(caCert),
    Buffer.from(clientKey),
    Buffer.from(clientCert)
  );
}
