from __future__ import annotations

import json
import logging
import os
import signal
import sqlite3
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


LOGGER = logging.getLogger("telegram_relay")
STOP_EVENT = threading.Event()
POLL_TIMEOUT_SECONDS = 30
HTTP_TIMEOUT_SECONDS = 45


class TelegramApiError(Exception):
    def __init__(
        self,
        message: str,
        *,
        retry_after: int | None = None,
        http_status: int | None = None,
    ) -> None:
        super().__init__(message)
        self.retry_after = retry_after
        self.http_status = http_status


class TelegramClient:
    def __init__(self, token: str) -> None:
        self._token = token
        self._api_url = f"https://api.telegram.org/bot{token}/"

    def call(self, method: str, payload: dict[str, Any] | None = None) -> Any:
        body = json.dumps(payload or {}).encode("utf-8")
        request = urllib.request.Request(
            self._api_url + method,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
                result = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            retry_after, description = self._read_api_error(error)
            raise TelegramApiError(
                self._safe_message(description or f"Telegram HTTP {error.code}"),
                retry_after=retry_after,
                http_status=error.code,
            ) from None
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            reason = getattr(error, "reason", None)
            detail = str(reason or "network connection failed")
            raise TelegramApiError(
                self._safe_message(detail),
                http_status=None,
            ) from None
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise TelegramApiError(
                f"Invalid response from Telegram: {type(error).__name__}"
            ) from None

        if not result.get("ok"):
            parameters = result.get("parameters") or {}
            description = result.get("description") or "Telegram API request failed"
            retry_after = parameters.get("retry_after")
            raise TelegramApiError(
                self._safe_message(description),
                retry_after=retry_after if isinstance(retry_after, int) else None,
            )
        return result.get("result")

    def _read_api_error(self, error: urllib.error.HTTPError) -> tuple[int | None, str | None]:
        try:
            result = json.loads(error.read().decode("utf-8"))
            parameters = result.get("parameters") or {}
            retry_after = parameters.get("retry_after")
            description = result.get("description")
            return (
                retry_after if isinstance(retry_after, int) else None,
                description if isinstance(description, str) else None,
            )
        except (UnicodeDecodeError, json.JSONDecodeError, AttributeError):
            return None, None

    def _safe_message(self, message: str) -> str:
        return message.replace(self._token, "[redacted]").replace("\n", " ")[:300]

    def get_me(self) -> dict[str, Any]:
        return self.call("getMe")

    def get_updates(self, offset: int) -> list[dict[str, Any]]:
        return self.call(
            "getUpdates",
            {
                "offset": offset,
                "timeout": POLL_TIMEOUT_SECONDS,
                "allowed_updates": ["message"],
            },
        )

    def send_message(self, chat_id: int, text: str) -> dict[str, Any]:
        return self.call("sendMessage", {"chat_id": chat_id, "text": text})

    def copy_message(
        self, *, destination_chat_id: int, source_chat_id: int, message_id: int
    ) -> dict[str, Any]:
        return self.call(
            "copyMessage",
            {
                "chat_id": destination_chat_id,
                "from_chat_id": source_chat_id,
                "message_id": message_id,
            },
        )


class RelayStore:
    def __init__(self, database_path: Path) -> None:
        database_path.parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(database_path, timeout=10)
        self._connection.row_factory = sqlite3.Row
        self._connection.execute("PRAGMA journal_mode=WAL")
        self._connection.execute("PRAGMA busy_timeout=10000")
        self._connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS admin_message_map (
                admin_message_id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS deliveries (
                update_id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL,
                notice_message_id INTEGER,
                content_message_id INTEGER
            );
            """
        )
        self._connection.commit()

    def last_update_id(self) -> int:
        row = self._connection.execute(
            "SELECT value FROM settings WHERE key = 'last_update_id'"
        ).fetchone()
        return int(row["value"]) if row else -1

    def mark_update_processed(self, update_id: int) -> None:
        self._connection.execute(
            """
            INSERT INTO settings (key, value)
            VALUES ('last_update_id', ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            (str(update_id),),
        )
        self._connection.commit()

    def get_delivery(self, update_id: int) -> sqlite3.Row | None:
        return self._connection.execute(
            "SELECT * FROM deliveries WHERE update_id = ?", (update_id,)
        ).fetchone()

    def create_delivery(self, update_id: int, user_id: int) -> None:
        self._connection.execute(
            """
            INSERT OR IGNORE INTO deliveries (update_id, user_id)
            VALUES (?, ?)
            """,
            (update_id, user_id),
        )
        self._connection.commit()

    def save_delivery_message(
        self, *, update_id: int, user_id: int, message_id: int, kind: str
    ) -> None:
        if kind not in {"notice", "content"}:
            raise ValueError("Unknown delivery message kind")
        column = "notice_message_id" if kind == "notice" else "content_message_id"
        self._connection.execute(
            f"UPDATE deliveries SET {column} = ? WHERE update_id = ?",
            (message_id, update_id),
        )
        self._connection.execute(
            """
            INSERT OR REPLACE INTO admin_message_map (admin_message_id, user_id)
            VALUES (?, ?)
            """,
            (message_id, user_id),
        )
        self._connection.commit()

    def user_for_admin_message(self, message_id: int) -> int | None:
        row = self._connection.execute(
            "SELECT user_id FROM admin_message_map WHERE admin_message_id = ?",
            (message_id,),
        ).fetchone()
        return int(row["user_id"]) if row else None

    def close(self) -> None:
        self._connection.close()


def required_config() -> tuple[str, int]:
    token = os.getenv("BOT_TOKEN", "").strip()
    admin_id_value = os.getenv("ADMIN_ID", "").strip()

    if not token:
        raise RuntimeError("BOT_TOKEN is missing. Add it as a secret environment variable.")
    if not admin_id_value:
        raise RuntimeError("ADMIN_ID is missing. Set it to the administrator's Telegram user ID.")

    try:
        admin_id = int(admin_id_value)
    except ValueError as error:
        raise RuntimeError("ADMIN_ID must be a numeric Telegram user ID.") from error
    if admin_id == 0:
        raise RuntimeError("ADMIN_ID must not be zero.")
    return token, admin_id


def message_text_for_admin(message: dict[str, Any], user: dict[str, Any]) -> str:
    first_name = str(user.get("first_name") or "").strip()
    last_name = str(user.get("last_name") or "").strip()
    full_name = " ".join(part for part in (first_name, last_name) if part)
    username = user.get("username")

    lines = ["رسالة جديدة من مستخدم"]
    if full_name:
        lines.append(f"الاسم: {full_name}")
    if username:
        lines.append(f"اسم المستخدم: @{username}")
    lines.extend(
        [
            f"معرّف المستخدم: {user['id']}",
            "للرد، استخدم Reply على هذه الرسالة أو على محتوى الرسالة المرفق.",
        ]
    )
    return "\n".join(lines)


def handle_user_message(
    *,
    api: TelegramClient,
    store: RelayStore,
    admin_id: int,
    update_id: int,
    message: dict[str, Any],
) -> None:
    user = message.get("from") or {}
    user_id = user.get("id")
    source_chat_id = (message.get("chat") or {}).get("id")
    message_id = message.get("message_id")
    if not isinstance(user_id, int) or not isinstance(source_chat_id, int):
        LOGGER.warning("Ignoring a message with missing sender or chat identifiers")
        return
    if not isinstance(message_id, int):
        LOGGER.warning("Ignoring a message with no message identifier")
        return

    store.create_delivery(update_id, user_id)
    delivery = store.get_delivery(update_id)
    if delivery is None:
        raise RuntimeError("Could not prepare a message delivery record")

    if delivery["notice_message_id"] is None:
        notice = api.send_message(admin_id, message_text_for_admin(message, user))
        store.save_delivery_message(
            update_id=update_id,
            user_id=user_id,
            message_id=int(notice["message_id"]),
            kind="notice",
        )

    delivery = store.get_delivery(update_id)
    if delivery is not None and delivery["content_message_id"] is None:
        copied = api.copy_message(
            destination_chat_id=admin_id,
            source_chat_id=source_chat_id,
            message_id=message_id,
        )
        store.save_delivery_message(
            update_id=update_id,
            user_id=user_id,
            message_id=int(copied["message_id"]),
            kind="content",
        )


def handle_admin_reply(
    *,
    api: TelegramClient,
    store: RelayStore,
    admin_id: int,
    message: dict[str, Any],
) -> None:
    reply = message.get("reply_to_message") or {}
    replied_to_id = reply.get("message_id")
    if not isinstance(replied_to_id, int):
        return

    user_id = store.user_for_admin_message(replied_to_id)
    if user_id is None:
        api.send_message(
            admin_id,
            "لم أتعرف على الرسالة التي رددت عليها. أرسل Reply على الرسالة التي وصلتك من البوت.",
        )
        return

    source_chat_id = (message.get("chat") or {}).get("id")
    message_id = message.get("message_id")
    if not isinstance(source_chat_id, int) or not isinstance(message_id, int):
        LOGGER.warning("Ignoring an administrator reply with missing message identifiers")
        return

    try:
        api.copy_message(
            destination_chat_id=user_id,
            source_chat_id=source_chat_id,
            message_id=message_id,
        )
    except TelegramApiError as error:
        LOGGER.error("Could not deliver an administrator reply: %s", error)
        if error.http_status is not None and 400 <= error.http_status < 500:
            api.send_message(
                admin_id,
                "تعذر إيصال هذا الرد إلى المستخدم. قد يكون قد حظر البوت أو أوقف المحادثة.",
            )
            return
        raise


def process_update(
    *,
    api: TelegramClient,
    store: RelayStore,
    admin_id: int,
    update: dict[str, Any],
) -> None:
    message = update.get("message")
    if not isinstance(message, dict):
        return

    user = message.get("from") or {}
    sender_id = user.get("id")
    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    text = message.get("text")

    if chat.get("type") == "private" and isinstance(chat_id, int) and isinstance(text, str):
        parts = text.strip().split(maxsplit=1)
        command = parts[0].split("@", maxsplit=1)[0] if parts else ""
        if command == "/start":
            api.send_message(
                chat_id,
                "أهلاً بك، أرسل رسالتك وسيتم إيصالها إلى الإدارة.",
            )
            return

    if sender_id == admin_id and chat_id == admin_id:
        if message.get("reply_to_message"):
            handle_admin_reply(
                api=api,
                store=store,
                admin_id=admin_id,
                message=message,
            )
        return

    if chat.get("type") != "private" or user.get("is_bot"):
        return

    update_id = update.get("update_id")
    if not isinstance(update_id, int):
        LOGGER.warning("Ignoring an update with no update identifier")
        return

    handle_user_message(
        api=api,
        store=store,
        admin_id=admin_id,
        update_id=update_id,
        message=message,
    )


def retry_delay(error: TelegramApiError, current_delay: int) -> int:
    if error.retry_after is not None:
        return max(1, min(error.retry_after, 120))
    return min(current_delay, 30)


def run_polling(api: TelegramClient, store: RelayStore, admin_id: int) -> None:
    offset = store.last_update_id() + 1
    backoff = 1

    while not STOP_EVENT.is_set():
        try:
            updates = api.get_updates(offset)
            backoff = 1
        except TelegramApiError as error:
            LOGGER.error("Polling failed: %s", error)
            STOP_EVENT.wait(retry_delay(error, backoff))
            backoff = min(backoff * 2, 30)
            continue

        for update in updates:
            if STOP_EVENT.is_set():
                break
            update_id = update.get("update_id")
            if not isinstance(update_id, int):
                continue
            if update_id < offset:
                continue
            try:
                process_update(api=api, store=store, admin_id=admin_id, update=update)
                store.mark_update_processed(update_id)
                offset = update_id + 1
            except TelegramApiError as error:
                LOGGER.error("Could not process update %s: %s", update_id, error)
                STOP_EVENT.wait(retry_delay(error, backoff))
                backoff = min(backoff * 2, 30)
                break
            except Exception:
                LOGGER.exception("Unexpected error while processing update %s", update_id)
                STOP_EVENT.wait(backoff)
                backoff = min(backoff * 2, 30)
                break
        else:
            continue


def configure_logging() -> None:
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


def main() -> int:
    configure_logging()
    try:
        token, admin_id = required_config()
    except RuntimeError as error:
        LOGGER.error("%s", error)
        return 1

    database_path = Path(
        os.getenv("BOT_DB_PATH", "data/telegram-relay.sqlite3")
    ).expanduser()
    store: RelayStore | None = None

    try:
        store = RelayStore(database_path)
        api = TelegramClient(token)
        bot = api.get_me()
        username = bot.get("username") or "unknown"
        LOGGER.info("Telegram relay started as @%s", username)
        LOGGER.info("Persistent reply mapping database: %s", database_path)

        def request_stop(signum: int, _frame: Any) -> None:
            LOGGER.info("Received signal %s; shutting down cleanly", signum)
            STOP_EVENT.set()

        signal.signal(signal.SIGINT, request_stop)
        signal.signal(signal.SIGTERM, request_stop)
        run_polling(api, store, admin_id)
        return 0
    except TelegramApiError as error:
        LOGGER.error("Could not connect to Telegram: %s", error)
        return 1
    except Exception:
        LOGGER.exception("The bot stopped because of an unexpected error")
        return 1
    finally:
        if store is not None:
            store.close()


if __name__ == "__main__":
    raise SystemExit(main())
