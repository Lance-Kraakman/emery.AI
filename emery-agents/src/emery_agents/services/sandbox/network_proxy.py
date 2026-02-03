"""
Filtering CONNECT proxy for sandboxed network access.

Architecture (same pattern as Anthropic's sandbox-runtime):
- Listens on a Unix domain socket on the host
- Socket is bind-mounted into bwrap sandbox (which has --unshare-net)
- Sandbox has zero network interfaces — only exit is through this proxy
- Resolves DNS on host side, checks resolved IP against private/reserved ranges
- Blocks all internal/private IPs, allows public internet only

Security properties:
1. Sandbox process that ignores http_proxy env var gets ZERO network (safe default)
2. DNS resolution happens on host — sandbox can't resolve anything itself
3. Proxy checks the RESOLVED IP (not hostname) — catches DNS rebinding
4. ALL resolved IPs are checked — if any A/AAAA record is private, request is blocked
5. Runs as separate subprocess — exploit doesn't directly compromise gRPC server
"""

import asyncio
import logging
import os
import socket
from ipaddress import IPv4Network, IPv6Network, ip_address
from typing import Optional

logger = logging.getLogger(__name__)

# Buffer size for bidirectional tunneling
TUNNEL_BUFFER = 65536

# Blocked IP ranges beyond what ipaddress.is_private/is_reserved covers
BLOCKED_EXTRA_V4 = [
    IPv4Network("100.64.0.0/10"),       # Carrier-grade NAT / AWS internal
    IPv4Network("169.254.169.254/32"),   # AWS EC2 instance metadata (IAM creds)
    IPv4Network("169.254.170.2/32"),     # ECS task credential endpoint
]

BLOCKED_EXTRA_V6 = [
    IPv6Network("fd00::/8"),             # Unique local (sometimes missed by is_private)
]


def is_blocked_ip(ip_str: str) -> bool:
    """Check if an IP address is private, reserved, or AWS-internal.

    Uses Python's ipaddress module which covers RFC1918 (10/172.16/192.168),
    loopback (127), link-local (169.254), and reserved ranges.
    Then checks AWS-specific ranges on top.
    """
    try:
        addr = ip_address(ip_str)
    except ValueError:
        # Can't parse → block for safety
        return True

    if addr.is_private or addr.is_reserved or addr.is_loopback or addr.is_link_local:
        return True

    # Check extra ranges not covered by stdlib
    if addr.version == 4:
        return any(addr in net for net in BLOCKED_EXTRA_V4)
    else:
        return any(addr in net for net in BLOCKED_EXTRA_V6)


def resolve_and_check(host: str, port: int) -> Optional[str]:
    """Resolve hostname and check ALL resolved IPs against blocklist.

    Returns the first allowed IP address, or None if all are blocked.
    Uses socket.getaddrinfo which returns both A and AAAA records.
    """
    try:
        results = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except socket.gaierror as e:
        logger.warning(f"DNS resolution failed for {host}:{port}: {e}")
        return None

    if not results:
        return None

    # Check ALL resolved IPs — if ANY is private, block entirely
    # This prevents DNS rebinding where attacker controls some A records
    resolved_ips = list({str(r[4][0]) for r in results})

    for ip_str in resolved_ips:
        if is_blocked_ip(ip_str):
            logger.warning(
                f"🚫 BLOCKED: {host}:{port} resolved to private/reserved IP {ip_str}"
            )
            return None

    # All IPs are public — use the first one
    allowed_ip = resolved_ips[0]
    logger.info(f"✅ ALLOWED: {host}:{port} → {allowed_ip}")
    return allowed_ip


async def _pipe(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    """Bidirectional pipe: read from reader, write to writer until EOF."""
    try:
        while True:
            data = await reader.read(TUNNEL_BUFFER)
            if not data:
                break
            writer.write(data)
            await writer.drain()
    except (ConnectionError, asyncio.CancelledError):
        pass
    finally:
        try:
            writer.close()
            await writer.wait_closed()
        except Exception:
            pass


async def handle_client(
    client_reader: asyncio.StreamReader,
    client_writer: asyncio.StreamWriter,
) -> None:
    """Handle a single proxy client connection.

    Supports:
    - CONNECT method (HTTPS tunneling) — most common
    - Plain HTTP proxy (GET/POST/etc. with absolute URL) — fallback
    """
    peer = client_writer.get_extra_info("peername") or "unknown"

    try:
        # Read the request line
        raw_line = await asyncio.wait_for(client_reader.readline(), timeout=30)
        if not raw_line:
            return

        request_line = raw_line.decode("utf-8", errors="replace").strip()
        if not request_line:
            return

        parts = request_line.split()
        if len(parts) < 3:
            client_writer.write(b"HTTP/1.1 400 Bad Request\r\n\r\n")
            await client_writer.drain()
            return

        method = parts[0].upper()

        if method == "CONNECT":
            await _handle_connect(client_reader, client_writer, parts[1], peer)
        else:
            await _handle_plain_http(
                client_reader, client_writer, method, parts[1], parts[2], raw_line, peer
            )

    except asyncio.TimeoutError:
        logger.debug(f"Client {peer} timed out waiting for request")
    except Exception as e:
        logger.error(f"Error handling client {peer}: {e}")
    finally:
        try:
            client_writer.close()
            await client_writer.wait_closed()
        except Exception:
            pass


async def _handle_connect(
    client_reader: asyncio.StreamReader,
    client_writer: asyncio.StreamWriter,
    target: str,
    peer: str,
) -> None:
    """Handle CONNECT method (HTTPS tunneling).

    Flow: parse host:port → resolve DNS → check IP → tunnel or reject.
    """
    # Parse host:port
    if ":" in target:
        host, port_str = target.rsplit(":", 1)
        try:
            port = int(port_str)
        except ValueError:
            client_writer.write(b"HTTP/1.1 400 Bad Request\r\n\r\n")
            await client_writer.drain()
            return
    else:
        host = target
        port = 443

    # Consume remaining headers (CONNECT sends headers before tunnel)
    while True:
        header_line = await asyncio.wait_for(client_reader.readline(), timeout=10)
        if header_line in (b"\r\n", b"\n", b""):
            break

    # Resolve and check
    allowed_ip = resolve_and_check(host, port)
    if allowed_ip is None:
        response = (
            f"HTTP/1.1 403 Forbidden\r\n"
            f"Content-Type: text/plain\r\n"
            f"Connection: close\r\n"
            f"\r\n"
            f"Blocked: {host} resolves to private/reserved IP\r\n"
        )
        client_writer.write(response.encode())
        await client_writer.drain()
        return

    # Connect to the resolved IP (not hostname — prevents TOCTOU)
    try:
        remote_reader, remote_writer = await asyncio.wait_for(
            asyncio.open_connection(allowed_ip, port),
            timeout=30,
        )
    except Exception as e:
        logger.warning(f"Failed to connect to {allowed_ip}:{port}: {e}")
        client_writer.write(b"HTTP/1.1 502 Bad Gateway\r\n\r\n")
        await client_writer.drain()
        return

    # Tell client the tunnel is established
    client_writer.write(b"HTTP/1.1 200 Connection Established\r\n\r\n")
    await client_writer.drain()

    # Bidirectional tunnel
    await asyncio.gather(
        _pipe(client_reader, remote_writer),
        _pipe(remote_reader, client_writer),
        return_exceptions=True,
    )


async def _handle_plain_http(
    client_reader: asyncio.StreamReader,
    client_writer: asyncio.StreamWriter,
    method: str,
    url: str,
    http_version: str,
    raw_request_line: bytes,
    peer: str,
) -> None:
    """Handle plain HTTP proxy request (non-CONNECT).

    Flow: parse URL → extract host → resolve → check IP → forward request → relay response.
    """
    # Parse the absolute URL: http://host:port/path
    if not url.lower().startswith("http://"):
        client_writer.write(b"HTTP/1.1 400 Bad Request\r\n\r\n")
        await client_writer.drain()
        return

    # Strip scheme
    rest = url[7:]  # Remove "http://"
    # Split host from path
    if "/" in rest:
        host_port, path = rest.split("/", 1)
        path = "/" + path
    else:
        host_port = rest
        path = "/"

    # Parse host:port
    if ":" in host_port:
        host, port_str = host_port.rsplit(":", 1)
        try:
            port = int(port_str)
        except ValueError:
            port = 80
    else:
        host = host_port
        port = 80

    # Resolve and check
    allowed_ip = resolve_and_check(host, port)
    if allowed_ip is None:
        response = (
            f"HTTP/1.1 403 Forbidden\r\n"
            f"Content-Type: text/plain\r\n"
            f"Connection: close\r\n"
            f"\r\n"
            f"Blocked: {host} resolves to private/reserved IP\r\n"
        )
        client_writer.write(response.encode())
        await client_writer.drain()
        return

    # Connect to remote
    try:
        remote_reader, remote_writer = await asyncio.wait_for(
            asyncio.open_connection(allowed_ip, port),
            timeout=30,
        )
    except Exception as e:
        logger.warning(f"Failed to connect to {allowed_ip}:{port}: {e}")
        client_writer.write(b"HTTP/1.1 502 Bad Gateway\r\n\r\n")
        await client_writer.drain()
        return

    # Forward the request with relative URL (not absolute)
    rewritten_line = f"{method} {path} {http_version}\r\n".encode()
    remote_writer.write(rewritten_line)

    # Forward remaining headers and body
    while True:
        header_line = await asyncio.wait_for(client_reader.readline(), timeout=10)
        remote_writer.write(header_line)
        if header_line in (b"\r\n", b"\n", b""):
            break

    await remote_writer.drain()

    # Relay response back
    await _pipe(remote_reader, client_writer)


class SandboxProxy:
    """Filtering CONNECT proxy that blocks private/reserved IPs.

    Usage:
        proxy = SandboxProxy("/tmp/sandbox-proxy.sock")
        await proxy.start()
        # ... sandbox executions use the proxy ...
        await proxy.stop()
    """

    def __init__(self, socket_path: str, max_connections: int = 50):
        self.socket_path = socket_path
        self._semaphore = asyncio.Semaphore(max_connections)
        self._server: Optional[asyncio.AbstractServer] = None

    async def _accept_client(
        self,
        reader: asyncio.StreamReader,
        writer: asyncio.StreamWriter,
    ) -> None:
        """Accept a client with connection limiting."""
        async with self._semaphore:
            await handle_client(reader, writer)

    async def start(self) -> None:
        """Start the proxy server on the Unix socket."""
        # Remove stale socket
        if os.path.exists(self.socket_path):
            os.unlink(self.socket_path)

        self._server = await asyncio.start_unix_server(
            self._accept_client,
            path=self.socket_path,
        )

        # Make socket accessible to sandbox processes
        os.chmod(self.socket_path, 0o666)

        logger.info(f"🔒 SandboxProxy started on {self.socket_path}")

    async def stop(self) -> None:
        """Stop the proxy server."""
        if self._server:
            self._server.close()
            await self._server.wait_closed()
            self._server = None

        if os.path.exists(self.socket_path):
            os.unlink(self.socket_path)

        logger.info("SandboxProxy stopped")

    async def run_forever(self) -> None:
        """Start and run until interrupted. Used when running as subprocess."""
        await self.start()
        try:
            await asyncio.Event().wait()  # Block forever
        except (asyncio.CancelledError, KeyboardInterrupt):
            pass
        finally:
            await self.stop()


def main() -> None:
    """Entry point for running proxy as a subprocess."""
    import sys

    socket_path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/sandbox-proxy.sock"
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [SANDBOX-PROXY] %(levelname)s %(message)s",
    )

    proxy = SandboxProxy(socket_path)
    asyncio.run(proxy.run_forever())


if __name__ == "__main__":
    main()
