#!/usr/bin/env python3
"""Small Filametria server: static PWA + per-user SQLite memory."""
from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import ipaddress
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
from http import cookies
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
SESSION_COOKIE = "filametria_session"
SESSION_DAYS = int(os.environ.get("FILAMETRIA_SESSION_DAYS", "30"))
MAX_BODY = int(os.environ.get("FILAMETRIA_MAX_BODY", str(8 * 1024 * 1024)))
PBKDF2_ROUNDS = int(os.environ.get("FILAMETRIA_PBKDF2_ROUNDS", "260000"))
ALLOW_SIGNUP = os.environ.get("FILAMETRIA_ALLOW_SIGNUP", "").lower() in {"1", "true", "yes", "on"}
ALLOW_PUBLIC_BOOTSTRAP = os.environ.get("FILAMETRIA_ALLOW_PUBLIC_BOOTSTRAP", "").lower() in {
    "1",
    "true",
    "yes",
    "on",
}
COOKIE_SECURE = os.environ.get("FILAMETRIA_COOKIE_SECURE", "").lower() in {"1", "true", "yes", "on"}

SPOT_URL = "https://api.energy-charts.info/price?bzn={zone}"
SPOT_TTL = int(os.environ.get("FILAMETRIA_SPOT_TTL", "900"))
_spot_cache: dict[str, tuple[float, dict[str, Any]]] = {}


def now() -> int:
    return int(time.time())


# ------------------------------------------------------------------ Bobina --
# O inventário de filamento vive no Bobina (porta 8100). O pedido é feito daqui,
# do lado do servidor, e não pelo browser: entre portas diferentes o browser
# batia em CORS e o cookie de sessão não passava. As duas apps correm na mesma
# máquina e com o mesmo utilizador, por isso o segredo é lido do ficheiro que o
# Bobina escreve -- não há nada para a Filametria configurar.
BOBINA_URL = os.environ.get("FILAMETRIA_BOBINA_URL", "http://127.0.0.1:8100")
BOBINA_TOKEN_FILE = Path(
    os.environ.get("FILAMETRIA_BOBINA_TOKEN",
                   str(Path.home() / ".local/share/bobina/bridge.token")))


# A app pergunta de 45 em 45 segundos, e há mais do que um separador aberto e
# mais do que um aparelho em casa: uma cache curta chega para isso não passar de
# uma leitura por vez. Curta de propósito -- mexer no Bobina e saltar para o
# Filametria tem de mostrar o número novo.
BOBINA_TTL = int(os.environ.get("FILAMETRIA_BOBINA_TTL", "10"))
_bobina_cache: tuple[float, dict[str, Any]] | None = None


def bobina_filaments() -> tuple[int, dict[str, Any]]:
    """O inventário do Bobina, tal como ele o dá.

    Vai tudo para o browser -- preço, stock, locais, cor já em hex -- porque é
    o Filametria que escolhe o que mostrar, e a ponte não deve ter de mudar de cada
    vez que o seletor de lá passa a dizer mais uma coisa.
    """
    global _bobina_cache
    if _bobina_cache and time.time() - _bobina_cache[0] < BOBINA_TTL:
        return 200, _bobina_cache[1]
    if not BOBINA_TOKEN_FILE.exists():
        return 503, {"ok": False, "error": "O Bobina ainda não arrancou nesta máquina."}
    token = BOBINA_TOKEN_FILE.read_text().strip()
    if not token:
        return 503, {"ok": False, "error": "O Bobina ainda não gerou o segredo da ligação."}
    url = f"{BOBINA_URL}/api/filametria/filamentos?token={urllib.parse.quote(token)}"
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            data = json.loads(r.read().decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        return 502, {"ok": False, "error": f"Sem resposta do Bobina: {exc}"}
    fils = data.get("filamentos", [])
    payload = {
        "ok": True,
        "filamentos": fils,
        "resumo": data.get("resumo") or {
            "filamentos": len(fils),
            "com_stock": len([f for f in fils if f.get("bobines")]),
            "bobines": sum(int(f.get("bobines") or 0) for f in fils),
            "total_g": round(sum(float(f.get("restante_g") or 0) for f in fils), 1),
        },
        # a data em que o Bobina viu os preços pela última vez: é ela que
        # preenche o "Preços revistos em", que ninguém se lembrava de mexer
        "precos_em": data.get("precos_em", ""),
        "em": data.get("em") or now(),
        "bobina": data.get("versao", ""),
    }
    _bobina_cache = (time.time(), payload)
    return 200, payload


def bobina_escreve(caminho: str, corpo: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    """Um pedido de escrita ao Bobina, com o segredo da ponte metido aqui.

    O token nunca chega ao browser: a página pede ao Filametria, o Filametria é que fala
    com o Bobina -- o mesmo caminho da leitura, pelas mesmas razões (CORS e
    cookies não passam entre as duas portas).

    A cache da leitura é deitada fora a seguir a uma escrita. Sem isso, dar
    baixa e ver o stock logo a seguir mostrava o número de antes durante 10
    segundos, e parecia que a baixa não tinha entrado."""
    global _bobina_cache
    if not BOBINA_TOKEN_FILE.exists():
        return 503, {"ok": False, "error": "O Bobina ainda não arrancou nesta máquina."}
    token = BOBINA_TOKEN_FILE.read_text().strip()
    if not token:
        return 503, {"ok": False, "error": "O Bobina ainda não gerou o segredo da ligação."}
    dados = json.dumps({**corpo, "token": token}).encode("utf-8")
    pedido = urllib.request.Request(
        f"{BOBINA_URL}{caminho}", data=dados, method="POST",
        headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(pedido, timeout=15) as r:
            resposta = json.loads(r.read().decode("utf-8") or "{}")
            codigo = r.status
    except urllib.error.HTTPError as exc:
        try:
            resposta = json.loads(exc.read().decode("utf-8") or "{}")
        except Exception:  # noqa: BLE001
            resposta = {"error": f"O Bobina recusou: {exc}"}
        codigo = exc.code
    except Exception as exc:  # noqa: BLE001
        return 502, {"ok": False, "error": f"Sem resposta do Bobina: {exc}"}
    _bobina_cache = None
    return codigo, resposta


def spot_price(zone: str = "PT") -> tuple[int, dict[str, Any]]:
    """Preço de mercado da eletricidade, pedido daqui em vez do browser.

    A energy-charts responde com Access-Control-Allow-Origin fixo no domínio dela,
    por isso um fetch feito pela página leva sempre com CORS, esteja a ligação boa
    ou não. Do lado do servidor não há CORS. A resposta fica em cache uns minutos
    para não bater na API a cada arranque da app.
    """
    zone = re.sub(r"[^A-Za-z0-9-]", "", zone)[:8].upper() or "PT"
    cached = _spot_cache.get(zone)
    if cached and time.time() - cached[0] < SPOT_TTL:
        return 200, cached[1]
    try:
        req = urllib.request.Request(
            SPOT_URL.format(zone=zone), headers={"User-Agent": "Filametria/1.x (+servidor local)"}
        )
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:  # rede, timeout, JSON partido — o cliente só precisa de saber que falhou
        return 502, {"ok": False, "error": f"sem resposta do mercado ({exc.__class__.__name__})"}
    precos = [p for p in (data.get("price") or []) if isinstance(p, (int, float))]
    if not precos:
        return 502, {"ok": False, "error": "o mercado não devolveu preços"}
    payload = {
        "ok": True,
        "zone": zone,
        "unit": data.get("unit", "EUR/MWh"),
        "media_mwh": sum(precos) / len(precos),
        "n": len(precos),
        "obtido_em": now(),
    }
    _spot_cache[zone] = (time.time(), payload)
    return 200, payload


def init_db(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT NOT NULL UNIQUE,
              password_hash TEXT NOT NULL,
              created_at INTEGER NOT NULL
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
              token_hash TEXT PRIMARY KEY,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              created_at INTEGER NOT NULL,
              expires_at INTEGER NOT NULL
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS user_state (
              user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
              state_json TEXT NOT NULL,
              updated_at INTEGER NOT NULL
            )
            """
        )


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ROUNDS)
    return "pbkdf2_sha256${}${}${}".format(
        PBKDF2_ROUNDS,
        base64.b64encode(salt).decode("ascii"),
        base64.b64encode(digest).decode("ascii"),
    )


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, rounds, salt_b64, digest_b64 = stored.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_b64.encode("ascii"))
        expected = base64.b64decode(digest_b64.encode("ascii"))
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(rounds))
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("ascii")).hexdigest()


def valid_username(username: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z0-9_.@-]{2,40}", username))


def is_lan_or_mesh(address: str) -> bool:
    try:
        ip = ipaddress.ip_address(address)
    except ValueError:
        return False
    mesh = ipaddress.ip_network("100.64.0.0/10")
    return ip.is_loopback or ip.is_private or ip in mesh


def first_forwarded_for(headers: Any, fallback: str) -> str:
    cf_ip = headers.get("CF-Connecting-IP", "")
    if cf_ip:
        return cf_ip.strip()
    xff = headers.get("X-Forwarded-For", "")
    if xff:
        return xff.split(",", 1)[0].strip()
    return fallback


def marked_public(headers: Any) -> bool:
    return headers.get("X-Filametria-Public", "").strip() == "1"


class FilametriaHandler(SimpleHTTPRequestHandler):
    server_version = "FilametriaServer/1.0"

    def __init__(self, *args: Any, directory: str | None = None, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(ROOT), **kwargs)

    @property
    def db_path(self) -> Path:
        return self.server.db_path  # type: ignore[attr-defined]

    def db(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    def end_headers(self) -> None:
        if urllib.parse.urlparse(self.path).path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def list_directory(self, path: str):  # type: ignore[override]
        self.send_error(404)
        return None

    def send_head(self):  # type: ignore[override]
        parsed = urllib.parse.urlparse(self.path)
        parts = [p for p in urllib.parse.unquote(parsed.path).split("/") if p]
        if any(part.startswith(".") for part in parts):
            self.send_error(404)
            return None
        if parts and parts[-1] in {"server.py"}:
            self.send_error(404)
            return None
        return super().send_head()

    def read_json(self) -> Any:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            return {}
        if length > MAX_BODY:
            raise ValueError("Pedido demasiado grande")
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def write_json(self, status: int, payload: Any, extra_headers: dict[str, str] | None = None) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        if extra_headers:
            for key, value in extra_headers.items():
                self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def error_json(self, status: int, message: str) -> None:
        self.write_json(status, {"ok": False, "error": message})

    def cookie_token(self) -> str | None:
        jar = cookies.SimpleCookie(self.headers.get("Cookie", ""))
        morsel = jar.get(SESSION_COOKIE)
        return morsel.value if morsel else None

    def session_cookie(self, token: str, max_age: int | None = None) -> str:
        age = SESSION_DAYS * 86400 if max_age is None else max_age
        parts = [
            f"{SESSION_COOKIE}={token}",
            "Path=/",
            "HttpOnly",
            "SameSite=Lax",
            f"Max-Age={age}",
        ]
        if COOKIE_SECURE:
            parts.append("Secure")
        return "; ".join(parts)

    def current_user(self) -> sqlite3.Row | None:
        token = self.cookie_token()
        if not token:
            return None
        with self.db() as db:
            db.execute("DELETE FROM sessions WHERE expires_at < ?", (now(),))
            return db.execute(
                """
                SELECT users.id, users.username
                FROM sessions
                JOIN users ON users.id = sessions.user_id
                WHERE sessions.token_hash = ? AND sessions.expires_at >= ?
                """,
                (token_hash(token), now()),
            ).fetchone()

    def create_session(self, user_id: int) -> str:
        token = secrets.token_urlsafe(32)
        with self.db() as db:
            db.execute(
                "INSERT INTO sessions(token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
                (token_hash(token), user_id, now(), now() + SESSION_DAYS * 86400),
            )
        return token

    def do_GET(self) -> None:  # noqa: N802
        path = urllib.parse.urlparse(self.path).path
        if path == "/api/bobina/filamentos":
            status, payload = bobina_filaments()
            self.write_json(status, payload)
            return
        if path == "/api/health":
            self.write_json(200, {"ok": True, "name": "Filametria", "memory": True})
            return
        if path == "/api/spot":
            zona = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get("bzn", ["PT"])[0]
            status, payload = spot_price(zona)
            self.write_json(status, payload)
            return
        if path == "/api/auth/me":
            user = self.current_user()
            with self.db() as db:
                count = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]
            client_ip = first_forwarded_for(self.headers, self.client_address[0])
            can_bootstrap = count == 0 and (
                ALLOW_PUBLIC_BOOTSTRAP
                or (is_lan_or_mesh(client_ip) and not marked_public(self.headers))
            )
            self.write_json(
                200,
                {
                    "ok": True,
                    "user": {"username": user["username"]} if user else None,
                    "can_register": can_bootstrap or (count > 0 and ALLOW_SIGNUP),
                },
            )
            return
        if path == "/api/state":
            user = self.current_user()
            if not user:
                self.error_json(401, "Precisas de entrar para usar memória remota")
                return
            with self.db() as db:
                row = db.execute(
                    "SELECT state_json, updated_at FROM user_state WHERE user_id = ?", (user["id"],)
                ).fetchone()
            self.write_json(
                200,
                {
                    "ok": True,
                    "user": {"username": user["username"]},
                    "state": json.loads(row["state_json"]) if row else None,
                    "updated_at": row["updated_at"] if row else None,
                },
            )
            return
        return super().do_GET()

    def do_HEAD(self) -> None:  # noqa: N802
        path = urllib.parse.urlparse(self.path).path
        if path == "/api/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        return super().do_HEAD()

    def do_POST(self) -> None:  # noqa: N802
        self.route_write()

    def do_PUT(self) -> None:  # noqa: N802
        self.route_write()

    def route_write(self) -> None:
        path = urllib.parse.urlparse(self.path).path
        try:
            data = self.read_json()
        except Exception as exc:
            self.error_json(400, str(exc) or "JSON inválido")
            return

        if path == "/api/auth/register":
            self.handle_register(data)
            return
        if path == "/api/auth/login":
            self.handle_login(data)
            return
        if path == "/api/auth/logout":
            token = self.cookie_token()
            if token:
                with self.db() as db:
                    db.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash(token),))
            self.write_json(200, {"ok": True}, {"Set-Cookie": self.session_cookie("", 0)})
            return
        if path == "/api/state":
            self.handle_state_save(data)
            return
        # dar baixa no Bobina do filamento que o trabalho gastou (e desfazer).
        # Não exige sessão -- a app inteira funciona sem conta, e a leitura do
        # inventário também não exige -- mas exige vir de casa: um pedido da
        # Internet não mexe nas bobines de ninguém.
        if path in ("/api/bobina/gastar", "/api/bobina/gastar/anular", "/api/bobina/impressora"):
            cliente = first_forwarded_for(self.headers, self.client_address[0])
            if not is_lan_or_mesh(cliente):
                self.error_json(403, "As escritas no Bobina só se fazem da rede de casa")
                return
            if path == "/api/bobina/impressora":
                caminho = "/api/filametria/impressora"
            else:
                caminho = ("/api/filametria/gastar/anular" if path.endswith("/anular")
                           else "/api/filametria/gastar")
            status, payload = bobina_escreve(caminho, data if isinstance(data, dict) else {})
            self.write_json(status, payload)
            return
        self.error_json(404, "API desconhecida")

    def handle_register(self, data: Any) -> None:
        username = str(data.get("username", "")).strip()
        password = str(data.get("password", ""))
        if not valid_username(username):
            self.error_json(400, "Usa 2-40 caracteres: letras, números, _, ., @ ou -")
            return
        if len(password) < 8:
            self.error_json(400, "A password precisa de pelo menos 8 caracteres")
            return

        client_ip = first_forwarded_for(self.headers, self.client_address[0])
        with self.db() as db:
            count = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]
            if count == 0 and not (
                ALLOW_PUBLIC_BOOTSTRAP
                or (is_lan_or_mesh(client_ip) and not marked_public(self.headers))
            ):
                self.error_json(403, "Cria o primeiro utilizador pela LAN ou Meshnet")
                return
            if count > 0 and not ALLOW_SIGNUP:
                self.error_json(403, "Registo fechado neste servidor")
                return
            try:
                cur = db.execute(
                    "INSERT INTO users(username, password_hash, created_at) VALUES (?, ?, ?)",
                    (username, hash_password(password), now()),
                )
            except sqlite3.IntegrityError:
                self.error_json(409, "Esse utilizador já existe")
                return
            user_id = cur.lastrowid

        token = self.create_session(int(user_id))
        self.write_json(
            201,
            {"ok": True, "user": {"username": username}},
            {"Set-Cookie": self.session_cookie(token)},
        )

    def handle_login(self, data: Any) -> None:
        username = str(data.get("username", "")).strip()
        password = str(data.get("password", ""))
        with self.db() as db:
            row = db.execute(
                "SELECT id, username, password_hash FROM users WHERE username = ?", (username,)
            ).fetchone()
        if not row or not verify_password(password, row["password_hash"]):
            self.error_json(401, "Utilizador ou password inválidos")
            return
        token = self.create_session(int(row["id"]))
        self.write_json(
            200,
            {"ok": True, "user": {"username": row["username"]}},
            {"Set-Cookie": self.session_cookie(token)},
        )

    def handle_state_save(self, data: Any) -> None:
        user = self.current_user()
        if not user:
            self.error_json(401, "Precisas de entrar para guardar memória remota")
            return
        payload = data.get("state", data)
        encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        stamp = now()
        with self.db() as db:
            db.execute(
                """
                INSERT INTO user_state(user_id, state_json, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                  state_json = excluded.state_json,
                  updated_at = excluded.updated_at
                """,
                (user["id"], encoded, stamp),
            )
        self.write_json(200, {"ok": True, "updated_at": stamp})


def main() -> None:
    mimetypes.add_type("application/manifest+json", ".webmanifest")
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default=os.environ.get("FILAMETRIA_HOST", "0.0.0.0"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("FILAMETRIA_PORT", "8098")))
    parser.add_argument(
        "--data-dir",
        default=os.environ.get("FILAMETRIA_DATA_DIR", str(Path.home() / ".local/share/filametria")),
    )
    args = parser.parse_args()

    data_dir = Path(args.data_dir).expanduser().resolve()
    db_path = data_dir / "filametria.db"
    init_db(db_path)

    server = ThreadingHTTPServer((args.host, args.port), FilametriaHandler)
    server.db_path = db_path  # type: ignore[attr-defined]
    print(f"Filametria a ouvir em http://{args.host}:{args.port} · dados em {db_path}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
