from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from typing import Any

from bot.main import RelayStore, TelegramApiError, process_update


ADMIN_ID = 9000


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


if __name__ == "__main__":
    unittest.main()
