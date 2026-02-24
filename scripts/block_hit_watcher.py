#!/usr/bin/env python3
import select
import socket
import sys
import time


def append_hit(log_path: str, port: int) -> None:
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(f"{int(time.time())},{port}\n")


def main() -> None:
    if len(sys.argv) < 2:
      print("Usage: block_hit_watcher.py <hit_log_path>", file=sys.stderr)
      sys.exit(1)

    log_path = sys.argv[1]
    listeners = []
    for port in (80, 443):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
        except Exception:
            pass
        sock.bind(("127.0.0.1", port))
        sock.listen(64)
        sock.setblocking(False)
        listeners.append((sock, port))

    socket_map = {sock: port for sock, port in listeners}
    while True:
        ready, _, _ = select.select(list(socket_map.keys()), [], [], 1.0)
        for listener in ready:
            port = socket_map[listener]
            try:
                conn, _addr = listener.accept()
                conn.settimeout(0.1)
                if port == 80:
                    try:
                        conn.sendall(
                            b"HTTP/1.1 204 No Content\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                        )
                    except Exception:
                        pass
                conn.close()
                append_hit(log_path, port)
            except Exception:
                continue


if __name__ == "__main__":
    main()
