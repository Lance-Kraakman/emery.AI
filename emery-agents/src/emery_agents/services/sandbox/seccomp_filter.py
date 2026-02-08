"""
Seccomp BPF filter for bwrap sandbox.

Uses libseccomp Python bindings (same library Flatpak uses) to generate a
compiled BPF filter that blocks dangerous syscalls. The filter is passed to
bwrap via --seccomp <fd>.

Blocklist approach: blocks specific high-risk syscalls, allows everything else.
This is safer than an allowlist for our use case because the sandbox runs
bash/python/curl/git which collectively use hundreds of syscalls.

References:
- libseccomp: https://github.com/seccomp/libseccomp
- Flatpak's filter: https://github.com/flatpak/flatpak/blob/main/common/flatpak-run.c
- Datadog seccomp guide: https://securitylabs.datadoghq.com/articles/container-security-fundamentals-part-6/
"""

import errno
import logging
import os

logger = logging.getLogger(__name__)

# Syscalls to block — these are frequent kernel exploit targets.
# libseccomp resolves names to arch-specific numbers automatically.
BLOCKED_SYSCALLS = [
    # io_uring — kernel async I/O, has had ~10+ CVEs in recent years
    "io_uring_setup",
    "io_uring_enter",
    "io_uring_register",
    # bpf — eBPF kernel programmability, regular privilege escalation target
    "bpf",
    # Kernel keyring — has had escalation bugs
    "keyctl",
    "add_key",
    "request_key",
    # ptrace — process tracing, sandbox escape vector
    "ptrace",
    # userfaultfd — used as a primitive in race condition exploits
    "userfaultfd",
    # kexec — load/execute a new kernel (reboot attack)
    "kexec_load",
    "kexec_file_load",
    # perf_event_open — kernel info leak + exploit vector
    "perf_event_open",
]


def create_seccomp_fd() -> int:
    """Create a file descriptor containing a compiled seccomp BPF filter.

    The returned fd can be passed to bwrap via:
        --seccomp <fd>

    The caller must:
    1. Include the fd in subprocess pass_fds=(fd,)
    2. Close the fd after subprocess.run() returns

    Returns:
        Read-end file descriptor containing the compiled BPF program.

    Raises:
        ImportError: If the seccomp library is not installed.
    """
    import pyseccomp as seccomp  # type: ignore[import-not-found]

    # Default action: ALLOW. We only block specific dangerous syscalls.
    f = seccomp.SyscallFilter(seccomp.ALLOW)

    blocked_count = 0
    for syscall_name in BLOCKED_SYSCALLS:
        try:
            f.add_rule(seccomp.ERRNO(errno.EPERM), syscall_name)
            blocked_count += 1
        except Exception:
            # Syscall doesn't exist on this architecture — skip it.
            # e.g. kexec_load may not exist on aarch64.
            logger.debug(
                f"Seccomp: syscall '{syscall_name}' not available on this arch"
            )

    logger.info(
        f"Seccomp filter: blocking {blocked_count}/{len(BLOCKED_SYSCALLS)} syscalls"
    )

    # Export compiled BPF to a pipe. bwrap reads from the fd.
    r_fd, w_fd = os.pipe()
    try:
        with os.fdopen(w_fd, "wb") as w_file:
            f.export_bpf(w_file)
    except Exception:
        os.close(r_fd)
        raise

    return r_fd
