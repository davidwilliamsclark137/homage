import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from backend import server


QUESTS = [
    {
        "id": "quest-one",
        "name": "First Place",
        "description": "Find the first signal.",
        "latitude": 33.1,
        "longitude": -96.6,
        "radius": 50,
        "kind": "photo",
        "order": 1,
        "category": "park",
        "source": "test",
        "distance_m": 100,
    },
    {
        "id": "quest-two",
        "name": "Second Place",
        "description": "Find the second signal.",
        "latitude": 33.2,
        "longitude": -96.7,
        "radius": 50,
        "kind": "photo",
        "order": 2,
        "category": "historic",
        "source": "test",
        "distance_m": 200,
    },
]


class MultiplayerTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.temporary.name)
        (self.data_dir / "rooms").mkdir()
        self.data_patch = patch.object(server, "DATA_DIR", self.data_dir)
        self.quest_patch = patch.object(
            server,
            "generate_environment_quests",
            return_value={"status": "ok", "quests": QUESTS},
        )
        self.data_patch.start()
        self.quest_patch.start()

    def tearDown(self):
        self.quest_patch.stop()
        self.data_patch.stop()
        self.temporary.cleanup()

    def test_two_players_complete_shared_quest(self):
        room = server.create_multiplayer_room(
            server.RoomCreateRequest(
                player_id="player-one",
                player_name="One",
                platform="ios",
                latitude=33.1,
                longitude=-96.6,
            )
        )
        code = room["code"]
        room = server.join_multiplayer_room(
            code,
            server.RoomJoinRequest(
                player_id="player-two",
                player_name="Two",
                platform="android",
            ),
        )
        self.assertEqual(room["status"], "active")
        self.assertEqual(
            {player["role"] for player in room["players"]},
            {"pathfinder", "archivist"},
        )

        room = self.action(code, "player-one", "melody")
        room = self.action(code, "player-two", "photo")
        room = self.action(code, "player-one", "sky")
        room = self.action(code, "player-two", "sky")

        self.assertEqual(room["completed_ids"], ["quest-one"])
        self.assertEqual(room["quest_index"], 1)
        self.assertEqual(room["progress"]["quest_id"], "quest-two")

    def test_roles_are_enforced(self):
        room = server.create_multiplayer_room(
            server.RoomCreateRequest(
                player_id="player-one",
                player_name="One",
                platform="ios",
                latitude=33.1,
                longitude=-96.6,
            )
        )
        code = room["code"]
        server.join_multiplayer_room(
            code,
            server.RoomJoinRequest(
                player_id="player-two",
                player_name="Two",
                platform="android",
            ),
        )

        with self.assertRaises(HTTPException) as error:
            self.action(code, "player-two", "melody")
        self.assertEqual(error.exception.status_code, 403)

    def test_stationary_fallback_requires_safe_area_confirmation(self):
        flagged_quests = [
            {
                **QUESTS[0],
                "requires_safe_area_confirmation": True,
                "stationary_only": True,
            }
        ]
        with patch.object(
            server,
            "generate_environment_quests",
            return_value={"status": "ok", "quests": flagged_quests},
        ):
            room = server.create_multiplayer_room(
                server.RoomCreateRequest(
                    player_id="player-one",
                    player_name="One",
                    platform="ios",
                    latitude=33.1,
                    longitude=-96.6,
                )
            )
        code = room["code"]
        server.join_multiplayer_room(
            code,
            server.RoomJoinRequest(
                player_id="player-two",
                player_name="Two",
                platform="android",
            ),
        )

        with self.assertRaises(HTTPException) as error:
            self.action(code, "player-one", "melody")
        self.assertEqual(error.exception.status_code, 409)

        room = server.submit_multiplayer_action(
            code,
            server.RoomActionRequest(
                player_id="player-one",
                quest_id="quest-one",
                action="melody",
                safe_area_confirmed=True,
            ),
        )
        self.assertEqual(room["progress"]["melody_by"], "player-one")

    def test_creator_publishes_quest_into_nearby_feed(self):
        created = server.create_custom_quest(
            server.CustomQuestCreateRequest(
                player_id="player-one",
                player_name="One",
                name="Listen to the field",
                description="Listen for three sounds and photograph their setting.",
                category="sound",
                latitude=33.1,
                longitude=-96.6,
                accuracy=8,
                stationary_fixes=3,
                safe_area_confirmed=True,
            )
        )

        self.assertEqual(created["status"], "created")
        self.assertNotIn("created_by", created["quest"])
        self.assertTrue(created["quest"]["stationary_only"])

        feed = server.generate_quest_feed(33.1, -96.6, 2_000, 3)
        self.assertEqual(feed["quests"][0]["id"], created["quest"]["id"])
        self.assertEqual(feed["quests"][0]["distance_m"], 0)
        self.assertTrue(feed["safety"]["community_stationary_confirmation"])
        dashboard = server.list_custom_quests("player-one")
        self.assertEqual(dashboard["count"], 1)

    def test_two_player_message_hunt_completes_when_solver_opens_message(self):
        document = {
            "id": "placed-message-one",
            "latitude": 32.96,
            "longitude": -96.74,
            "radiusMeters": 100,
            "checkpointId": "richardson-heights",
            "checkpointName": "Heights Recreation Center",
            "checkpointLatitude": 32.96222,
            "checkpointLongitude": -96.74562,
            "checkpointRadiusMeters": 120,
            "hint": "Find the green door",
        }
        with patch.object(server.local_database, "list_encrypted_placed_documents", return_value=[document]):
            room = server.create_multiplayer_room(
                server.RoomCreateRequest(
                    player_id="player-one",
                    player_name="Player 1",
                    platform="ios",
                    latitude=32.96,
                    longitude=-96.74,
                    mode="message_hunt",
                    document_id=document["id"],
                )
            )
        self.assertEqual(room["players"][0]["role"], "sender")
        room = server.join_multiplayer_room(
            room["code"],
            server.RoomJoinRequest(player_id="player-two", player_name="Player 2", platform="android"),
        )
        self.assertEqual(room["status"], "active")
        self.assertEqual(room["players"][1]["role"], "solver")
        room = server.submit_multiplayer_action(
            room["code"],
            server.RoomActionRequest(player_id="player-two", quest_id=document["id"], action="message_opened"),
        )
        self.assertEqual(room["status"], "complete")
        self.assertEqual(room["progress"]["opened_by"], "player-two")

    def test_document_template_escapes_latex_and_publishes_reading_quest(self):
        payload = server.DocumentCreateRequest(
            player_id="player-one",
            player_name="One",
            title="Moon & Signal",
            body="A line at 50% brightness.\n\\input{private-file}",
            byline="One",
            document_kind="poem",
            template="neon",
            accent="magenta",
            typography="serif",
            alignment="center",
            puzzle_kind="riddle",
            puzzle_prompt="What repeats without speaking?",
            puzzle_answer="echo",
            latitude=33.1,
            longitude=-96.6,
            accuracy=8,
            stationary_fixes=3,
            safe_area_confirmed=True,
        )
        source = server.document_latex(payload)
        self.assertIn(r"Moon \& Signal", source)
        self.assertIn(r"50\%", source)
        self.assertNotIn(r"\input{private-file}", source)

        def fake_compile(command, **_kwargs):
            Path(command[-1]).with_suffix(".pdf").write_bytes(b"%PDF-1.5\n")
            return SimpleNamespace(returncode=0)

        with patch.object(server.subprocess, "run", side_effect=fake_compile):
            created = server.create_document(payload)

        self.assertEqual(created["status"], "created")
        self.assertEqual(created["document"]["document_kind"], "poem")
        self.assertEqual(created["quest"]["document_id"], created["document"]["id"])
        self.assertTrue(created["quest"]["document_url"].endswith(".pdf"))

        feed = server.generate_quest_feed(33.1, -96.6, 2_000, 3)
        self.assertEqual(feed["quests"][0]["document_id"], created["document"]["id"])

    def test_chip_song_publishes_collectible_eight_bar_quest(self):
        steps = 8
        composition = {
            "version": 1,
            "title": "Field Cartridge",
            "key": "C",
            "scale": "minor",
            "meter": "4/4",
            "tempo": 125,
            "chordDegrees": [0, 3, 4, 0, 5, 3, 4, 0],
            "melody": [[0, None, 2, None, 4, None, 2, None] for _ in range(8)],
            "drums": {
                "kick": [
                    [step in {0, 4} for step in range(steps)] for _ in range(8)
                ],
                "snare": [
                    [step in {2, 6} for step in range(steps)] for _ in range(8)
                ],
                "hat": [
                    [step % 2 == 0 for step in range(steps)] for _ in range(8)
                ],
            },
        }
        created = server.create_song(
            server.SongCreateRequest(
                player_id="player-one",
                player_name="One",
                title="Field Cartridge",
                composition=composition,
                puzzle_kind="word_puzzle",
                puzzle_prompt="What instrument has keys but no locks?",
                puzzle_answer="piano",
                latitude=33.1,
                longitude=-96.6,
                accuracy=8,
                stationary_fixes=3,
                safe_area_confirmed=True,
            )
        )

        self.assertEqual(created["status"], "created")
        self.assertEqual(created["quest"]["category"], "music")
        self.assertEqual(created["quest"]["song_id"], created["song"]["id"])
        self.assertTrue(created["quest"]["stationary_only"])
        self.assertNotIn("answer_digest", created["quest"])
        with self.assertRaises(HTTPException) as error:
            server.unlock_artifact(
                server.ArtifactUnlockRequest(
                    artifact_kind="song",
                    artifact_id=created["song"]["id"],
                    answer="organ",
                )
            )
        self.assertEqual(error.exception.status_code, 403)
        unlocked = server.unlock_artifact(
            server.ArtifactUnlockRequest(
                artifact_kind="song",
                artifact_id=created["song"]["id"],
                answer="Piano!",
            )
        )
        self.assertEqual(
            unlocked["song"]["composition"]["melody"],
            composition["melody"],
        )
        self.assertIn("?token=", unlocked["song"]["song_url"])
        self.assertEqual(server.list_songs("player-one")["count"], 1)

    def test_hide_seek_redacts_target_and_requires_two_sky_locks(self):
        hider_room = server.create_multiplayer_room(
            server.RoomCreateRequest(
                player_id="player-one",
                player_name="Hider",
                platform="ios",
                latitude=33.1,
                longitude=-96.6,
                mode="hide_seek",
            )
        )
        code = hider_room["code"]
        seeker_room = server.join_multiplayer_room(
            code,
            server.RoomJoinRequest(
                player_id="player-two",
                player_name="Seeker",
                platform="android",
            ),
        )
        self.assertEqual(seeker_room["quests"], [])
        self.assertEqual(seeker_room["players"][1]["role"], "seeker")

        server.select_hiding_place(
            code,
            server.HideSelectRequest(
                player_id="player-one",
                quest_id="quest-one",
            ),
        )
        server.mark_hidden_signal_ready(
            code,
            server.HideReadyRequest(
                player_id="player-one",
                photo_url="/files/clue.jpg",
                treatment="night",
            ),
        )
        seeker_room = server.update_seeker_position(
            code,
            server.HidePositionRequest(
                player_id="player-two",
                latitude=33.1,
                longitude=-96.6,
                accuracy=10,
            ),
        )
        self.assertTrue(seeker_room["hide_seek"]["can_find"])
        self.assertIsNone(seeker_room["hide_seek"]["selected_quest"])
        self.assertEqual(seeker_room["quests"], [])

        server.find_hidden_signal(
            code,
            server.HidePlayerRequest(player_id="player-two"),
        )
        first_lock = server.lock_hide_seek_sky(
            code,
            server.HidePlayerRequest(player_id="player-one"),
        )
        self.assertEqual(first_lock["status"], "active")
        second_lock = server.lock_hide_seek_sky(
            code,
            server.HidePlayerRequest(player_id="player-two"),
        )
        self.assertEqual(second_lock["status"], "complete")

    def action(self, code: str, player_id: str, action: str):
        return server.submit_multiplayer_action(
            code,
            server.RoomActionRequest(
                player_id=player_id,
                quest_id="quest-one",
                action=action,
            ),
        )


if __name__ == "__main__":
    unittest.main()
