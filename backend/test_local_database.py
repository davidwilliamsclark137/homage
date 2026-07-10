import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend import local_database, server


class LocalDatabaseTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.temporary.name)
        self.data_patch = patch.object(server, "DATA_DIR", self.data_dir)
        self.data_patch.start()

    def tearDown(self):
        self.data_patch.stop()
        self.temporary.cleanup()

    def test_database_initializes_with_expected_tables(self):
        path = local_database.initialize_database(self.data_dir)
        status = local_database.database_status(self.data_dir)

        self.assertTrue(path.exists())
        self.assertEqual(status["schema_version"], local_database.SCHEMA_VERSION)
        self.assertEqual(status["counts"]["local_accounts"], 0)
        self.assertEqual(status["counts"]["artifacts"], 0)

    def test_account_and_device_registration_are_local(self):
        account = server.create_local_account(
            server.LocalAccountCreateRequest(display_name="Desktop Keeper")
        )["account"]
        device = server.register_local_device(
            server.LocalDeviceRegisterRequest(
                account_id=account["account_id"],
                device_id="device-iphone-test",
                device_name="Field iPhone",
                platform="ios",
            )
        )["device"]
        status = server.local_database_status()

        self.assertEqual(device["account_id"], account["account_id"])
        self.assertEqual(status["counts"]["local_accounts"], 1)
        self.assertEqual(status["counts"]["devices"], 1)

    def test_custom_quest_is_indexed_in_database(self):
        created = server.create_custom_quest(
            server.CustomQuestCreateRequest(
                player_id="player-one",
                player_name="One",
                name="Watch the horizon",
                description="Stand somewhere safe and watch the horizon line.",
                category="observation",
                latitude=33.1,
                longitude=-96.6,
                accuracy=8,
                stationary_fixes=3,
                safe_area_confirmed=True,
            )
        )
        status = server.local_database_status()

        self.assertEqual(created["status"], "created")
        self.assertEqual(status["counts"]["players"], 1)
        self.assertEqual(status["counts"]["quests"], 1)
        self.assertEqual(status["counts"]["sync_events"], 1)

    def test_pairing_code_registers_phone_device_once(self):
        created = server.create_pairing_code(
            server.PairingCodeCreateRequest(display_name="Desk")
        )
        code = created["pairing"]["code"]
        paired = server.claim_pairing_code(
            code,
            server.PairingCodeClaimRequest(
                device_id="device-graphene-test",
                device_name="GrapheneOS Field Phone",
                platform="android",
                player_id="player-one",
                player_name="One",
            ),
        )
        status = server.local_database_status()

        self.assertEqual(paired["status"], "paired")
        self.assertEqual(
            paired["device"]["account_id"],
            created["account"]["account_id"],
        )
        self.assertEqual(status["counts"]["local_accounts"], 1)
        self.assertEqual(status["counts"]["devices"], 1)
        self.assertEqual(status["counts"]["players"], 1)
        self.assertEqual(status["counts"]["pairing_codes"], 1)
        self.assertEqual(status["counts"]["sync_events"], 1)

        with self.assertRaises(Exception):
            server.claim_pairing_code(
                code,
                server.PairingCodeClaimRequest(
                    device_id="device-reuse-test",
                    device_name="Reuse",
                    platform="ios",
                    player_id="player-two",
                    player_name="Two",
                ),
            )


if __name__ == "__main__":
    unittest.main()
