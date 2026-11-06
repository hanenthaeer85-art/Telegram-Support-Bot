from __future__ import annotations

import io
import json
import tempfile
import urllib.error
import unittest
from pathlib import Path
from typing import Any
from unittest.mock import patch

from bot.main import (
    RelayStore,
    TelegramApiError,
    TelegramClient,
    process_update,
    run_polling,
)


ADMIN_ID = 9000
FAKE_BOT_TOKEN = "123456789:FAKE_TEST_TOKEN_NOT_REAL"


class FakeTelegramClient:
    def __init__(self) -> None:
        self.next_message_id = 1000
        self.sent_messages: list[tuple[int, str]] = []
        self.copied_messages: list[tuple[int, int, int]] = []
        self.copy_error: TelegramApiError | None = None

    def send_message(self, chat_id: int, text: str) -> dict[str, Any]:
        self.sent_messages.append((chat_id, text))
        message_id = self.next_message_id
        self.next_message_id += 1
        return {"message_id": message_id}

    def copy_message(
        self, *, destination_chat_id: int, source_chat_id: int, message_id: int
    ) -> dict[str, Any]:
        if self.copy_error is not None:
            raise self.copy_error
        self.copied_messages.append(
            (destination_chat_id, source_chat_id, message_id)
        )
        copied_id = self.next_message_id
        self.next_message_id += 1
        return {"message_id": copied_id}


def user_update(
    update_id: int, user_id: int, message_id: int
) -> dict[str, Any]:
    return {
        "update_id": update_id,
        "message": {
            "message_id": message_id,
            "from": {
                "id": user_id,
                "first_name": f"User {user_id}",
            },
            "chat": {"id": user_id, "type": "private"},
            "text": f"Message from {user_id}",
        },
    }


def admin_reply(update_id: int, reply_to_message_id: int) -> dict[str, Any]:
    return {
        "update_id": update_id,
        "message": {
            "message_id": 7000 + update_id,
            "from": {"id": ADMIN_ID},
            "chat": {"id": ADMIN_ID, "type": "private"},
            "reply_to_message": {"message_id": reply_to_message_id},
            "text": "Admin response",
        },
    }


class StopAfterWait:
    """Stops the polling loop after its first retry wait."""

    def __init__(self) -> None:
        self.stopped = False

    def is_set(self) -> bool:
        return self.stopped

    def wait(self, _timeout: int) -> bool:
        self.stopped = True
        return True


class EmptyStore:
    def last_update_id(self) -> int:
        return -1


class TokenRedactionTests(unittest.TestCase):
    def http_error_with_token(self) -> urllib.error.HTTPError:
        response = json.dumps(
            {
                "ok": False,
                "description": f"Unauthorized token: {FAKE_BOT_TOKEN}",
            }
        ).encode("utf-8")
        return urllib.error.HTTPError(
            url=f"https://api.telegram.org/bot{FAKE_BOT_TOKEN}/getMe",
            code=401,
            msg="Unauthorized",
            hdrs=None,
            fp=io.BytesIO(response),
        )

    def test_http_error_redacts_fake_token_from_exception_text(self) -> None:
        with patch(
            "bot.main.urllib.request.urlopen",
            side_effect=self.http_error_with_token(),
        ):
            with self.assertRaises(TelegramApiError) as raised:
                TelegramClient(FAKE_BOT_TOKEN).get_me()

        self.assertNotIn(FAKE_BOT_TOKEN, str(raised.exception))

    def test_network_error_redacts_fake_token_from_exception_text(self) -> None:
        network_error = urllib.error.URLError(
            f"Connection failed for /bot{FAKE_BOT_TOKEN}/getUpdates"
        )
        with patch(
            "bot.main.urllib.request.urlopen",
            side_effect=network_error,
        ):
            with self.assertRaises(TelegramApiError) as raised:
                TelegramClient(FAKE_BOT_TOKEN).get_updates(offset=0)

        self.assertNotIn(FAKE_BOT_TOKEN, str(raised.exception))

    def test_polling_log_does_not_include_fake_token(self) -> None:
        stop_event = StopAfterWait()
        with (
            patch("bot.main.STOP_EVENT", stop_event),
            patch(
                "bot.main.urllib.request.urlopen",
                side_effect=self.http_error_with_token(),
            ),
            self.assertLogs("telegram_relay", level="ERROR") as captured,
        ):
            run_polling(
                api=TelegramClient(FAKE_BOT_TOKEN),
                store=EmptyStore(),  # type: ignore[arg-type]
                admin_id=ADMIN_ID,
            )

        self.assertNotIn(FAKE_BOT_TOKEN, "\n".join(captured.output))


class ReplyRoutingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.database_path = Path(self.temp_dir.name) / "relay.sqlite3"
        self.store = RelayStore(self.database_path)
        self.addCleanup(self.store.close)
        self.api = FakeTelegramClient()

    def process_user(self, update_id: int, user_id: int, message_id: int) -> None:
        process_update(
            api=self.api,  # type: ignore[arg-type]
            store=self.store,
            admin_id=ADMIN_ID,
            update=user_update(update_id, user_id, message_id),
        )

    def process_admin_reply(self, update_id: int, target_message_id: int) -> None:
        process_update(
            api=self.api,  # type: ignore[arg-type]
            store=self.store,
            admin_id=ADMIN_ID,
            update=admin_reply(update_id, target_message_id),
        )

    def test_interleaved_users_can_be_replied_to_via_notice_or_copy(self) -> None:
        self.process_user(update_id=1, user_id=101, message_id=11)
        self.process_user(update_id=2, user_id=202, message_id=22)

        # The API returns IDs in the order each user's notice and copied message
        # are created: 1000/1001 for user 101 and 1002/1003 for user 202.
        self.process_admin_reply(update_id=3, target_message_id=1000)
        self.process_admin_reply(update_id=4, target_message_id=1003)

        self.assertEqual(
            [destination for destination, _, _ in self.api.copied_messages[-2:]],
            [101, 202],
        )

    def test_reply_destinations_survive_reopening_sqlite(self) -> None:
        self.process_user(update_id=10, user_id=111, message_id=31)
        self.process_user(update_id=11, user_id=222, message_id=42)
        self.store.close()
        self.store = RelayStore(self.database_path)

        # Reply to user 111's copied message and user 222's identity notice.
        self.process_admin_reply(update_id=12, target_message_id=1001)
        self.process_admin_reply(update_id=13, target_message_id=1002)

        self.assertEqual(
            [destination for destination, _, _ in self.api.copied_messages[-2:]],
            [111, 222],
        )

    def test_failed_user_delivery_notifies_admin(self) -> None:
        self.process_user(update_id=20, user_id=303, message_id=53)
        self.api.copy_error = TelegramApiError(
            "bot was blocked by the user", http_status=403
        )

        self.process_admin_reply(update_id=21, target_message_id=1000)

        self.assertEqual(len(self.api.copied_messages), 1)
        admin_id, notice = self.api.sent_messages[-1]
        self.assertEqual(admin_id, ADMIN_ID)
        self.assertIn("تعذر إيصال هذا الرد", notice)

    def test_retry_after_temporary_copy_failure_does_not_duplicate_notice(self) -> None:
        update = user_update(update_id=30, user_id=404, message_id=64)
        self.api.copy_error = TelegramApiError(
            "temporary Telegram error", http_status=500
        )

        with self.assertRaises(TelegramApiError):
            process_update(
                api=self.api,  # type: ignore[arg-type]
                store=self.store,
                admin_id=ADMIN_ID,
                update=update,
            )

        self.assertEqual(len(self.api.sent_messages), 1)
        delivery = self.store.get_delivery(30)
        self.assertIsNotNone(delivery)
        notice_id = int(delivery["notice_message_id"])  # type: ignore[index]

        self.store.close()
        self.store = RelayStore(self.database_path)
        self.addCleanup(self.store.close)
        self.api.copy_error = None

        process_update(
            api=self.api,  # type: ignore[arg-type]
            store=self.store,
            admin_id=ADMIN_ID,
            update=update,
        )

        self.assertEqual(len(self.api.sent_messages), 1)
        self.assertEqual(len(self.api.copied_messages), 1)
        self.process_admin_reply(update_id=31, target_message_id=notice_id)
        self.assertEqual(self.api.copied_messages[-1][0], 404)


if __name__ == "__main__":
    unittest.main()
