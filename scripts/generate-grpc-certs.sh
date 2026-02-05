#!/usr/bin/env bash
#
# Generate self-signed CA + server + client certs for local gRPC mTLS development.
# Output: certs/ directory with PEM files, plus a .env snippet.
#
# Usage: bash scripts/generate-grpc-certs.sh
#
set -euo pipefail

CERT_DIR="certs"
DAYS=3650  # 10 years for dev certs

mkdir -p "$CERT_DIR"

echo "=== Generating CA ==="
openssl req -x509 -newkey rsa:4096 -sha256 -days $DAYS -nodes \
  -keyout "$CERT_DIR/ca.key" -out "$CERT_DIR/ca.crt" \
  -subj "/CN=Emery Dev CA" 2>/dev/null

echo "=== Generating server cert (SAN: localhost, agent.emery.local) ==="
openssl req -newkey rsa:2048 -nodes \
  -keyout "$CERT_DIR/server.key" -out "$CERT_DIR/server.csr" \
  -subj "/CN=agent.emery.local" 2>/dev/null
openssl x509 -req -in "$CERT_DIR/server.csr" -CA "$CERT_DIR/ca.crt" -CAkey "$CERT_DIR/ca.key" \
  -CAcreateserial -out "$CERT_DIR/server.crt" -days $DAYS \
  -extfile <(printf "subjectAltName=DNS:localhost,DNS:agent.emery.local,IP:127.0.0.1") 2>/dev/null

echo "=== Generating client cert ==="
openssl req -newkey rsa:2048 -nodes \
  -keyout "$CERT_DIR/client.key" -out "$CERT_DIR/client.csr" \
  -subj "/CN=emery-nextjs-client" 2>/dev/null
openssl x509 -req -in "$CERT_DIR/client.csr" -CA "$CERT_DIR/ca.crt" -CAkey "$CERT_DIR/ca.key" \
  -CAcreateserial -out "$CERT_DIR/client.crt" -days $DAYS 2>/dev/null

# Cleanup temp files
rm -f "$CERT_DIR"/*.csr "$CERT_DIR"/*.srl

echo ""
echo "=== Certs generated in $CERT_DIR/ ==="
echo ""
echo "Add to .env.local (copy-paste the block below):"
echo ""
echo "GRPC_CA_CERT=\"$(cat $CERT_DIR/ca.crt)\""
echo "GRPC_SERVER_CERT=\"$(cat $CERT_DIR/server.crt)\""
echo "GRPC_SERVER_KEY=\"$(cat $CERT_DIR/server.key)\""
echo "GRPC_CLIENT_CERT=\"$(cat $CERT_DIR/client.crt)\""
echo "GRPC_CLIENT_KEY=\"$(cat $CERT_DIR/client.key)\""
echo ""
echo "IMPORTANT: Add 'certs/' to .gitignore!"
