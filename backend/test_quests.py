import unittest
from unittest.mock import patch

from backend.quests import (
    generate_environment_quests,
    normalize_features,
    select_diverse_features,
)


class QuestGenerationTests(unittest.TestCase):
    def setUp(self):
        self.latitude = 33.1972
        self.longitude = -96.6153

    def test_private_and_unsafe_features_are_rejected(self):
        elements = [
            {
                "type": "node",
                "id": 1,
                "lat": 33.198,
                "lon": -96.6153,
                "tags": {
                    "leisure": "park",
                    "name": "Private Garden",
                    "access": "private",
                },
            },
            {
                "type": "node",
                "id": 2,
                "lat": 33.199,
                "lon": -96.6153,
                "tags": {"tourism": "artwork", "name": "Public Sculpture"},
            },
        ]

        features = normalize_features(
            elements,
            self.latitude,
            self.longitude,
            2_000,
        )

        self.assertEqual([feature.name for feature in features], ["Public Sculpture"])

    def test_selection_prefers_category_diversity(self):
        elements = [
            {
                "type": "node",
                "id": index,
                "lat": self.latitude + index * 0.001,
                "lon": self.longitude,
                "tags": tags,
            }
            for index, tags in enumerate(
                [
                    {"tourism": "artwork", "name": "Art One"},
                    {"tourism": "artwork", "name": "Art Two"},
                    {"leisure": "park", "name": "Park"},
                    {"historic": "memorial", "name": "Memorial"},
                ],
                start=1,
            )
        ]
        features = normalize_features(
            elements,
            self.latitude,
            self.longitude,
            2_000,
        )

        selected = select_diverse_features(features, 3)

        self.assertEqual(len({feature.category for feature in selected}), 3)

    def test_motor_highways_and_nearby_road_geometry_are_rejected(self):
        elements = [
            {
                "type": "node",
                "id": 10,
                "lat": 33.199,
                "lon": -96.6153,
                "tags": {
                    "tourism": "artwork",
                    "highway": "primary",
                    "name": "Road Median Art",
                },
            },
            {
                "type": "node",
                "id": 11,
                "lat": 33.2,
                "lon": -96.6153,
                "tags": {
                    "tourism": "artwork",
                    "name": "Roadside Sculpture",
                },
            },
            {
                "type": "way",
                "id": 12,
                "tags": {"highway": "primary", "name": "Major Road"},
                "geometry": [
                    {"lat": 33.19955, "lon": -96.616},
                    {"lat": 33.19955, "lon": -96.614},
                ],
            },
            {
                "type": "way",
                "id": 13,
                "center": {"lat": 33.201, "lon": -96.6153},
                "tags": {"highway": "footway", "name": "Public Walk"},
                "geometry": [
                    {"lat": 33.2008, "lon": -96.6153},
                    {"lat": 33.2012, "lon": -96.6153},
                ],
            },
        ]

        features = normalize_features(
            elements,
            self.latitude,
            self.longitude,
            2_000,
        )

        self.assertEqual([feature.name for feature in features], ["Public Walk"])

    @patch("backend.quests.fetch_osm_features", side_effect=RuntimeError("offline"))
    def test_network_failure_returns_stationary_confirmed_activity(self, _fetch):
        response = generate_environment_quests(
            latitude=12.34567,
            longitude=76.54321,
            radius_m=1_999,
            limit=3,
        )

        self.assertEqual(response["source"], "procedural-stationary-confirmation")
        self.assertEqual(len(response["quests"]), 3)
        self.assertTrue(
            all(
                quest["requires_safe_area_confirmation"]
                and quest["stationary_only"]
                and quest["distance_m"] == 0
                for quest in response["quests"]
            )
        )
        self.assertTrue(response["safety"]["road_buffered"])
        self.assertTrue(response["safety"]["procedural_destinations"])
        self.assertTrue(response["safety"]["stationary_confirmation_required"])


if __name__ == "__main__":
    unittest.main()
