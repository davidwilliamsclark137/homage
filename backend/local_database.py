from __future__ import annotations

import json
import secrets
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SCHEMA_VERSION = 1
DATABASE_NAME = "homage.sqlite3"
_DB_LOCK = threading.RLock()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def database_path(data_dir: Path) -> Path:
    return data_dir / DATABASE_NAME


def connect(data_dir: Path) -> sqlite3.Connection:
    data_dir.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path(data_dir))
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    return connection


def initialize_database(data_dir: Path) -> Path:
    with _DB_LOCK, connect(data_dir) as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS schema_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS local_accounts (
                account_id TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS devices (
                device_id TEXT PRIMARY KEY,
                account_id TEXT,
                device_name TEXT NOT NULL,
                platform TEXT NOT NULL,
                created_at TEXT NOT NULL,
                last_seen_at TEXT NOT NULL,
                FOREIGN KEY (account_id) REFERENCES local_accounts(account_id)
            );

            CREATE TABLE IF NOT EXISTS players (
                player_id TEXT PRIMARY KEY,
                player_name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS quests (
                quest_id TEXT PRIMARY KEY,
                created_by TEXT,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                category TEXT NOT NULL,
                kind TEXT NOT NULL,
                source TEXT NOT NULL,
                latitude REAL,
                longitude REAL,
                radius_m REAL,
                created_at TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS artifacts (
                artifact_id TEXT PRIMARY KEY,
                artifact_kind TEXT NOT NULL,
                owner_player_id TEXT,
                quest_id TEXT,
                title TEXT NOT NULL,
                file_url TEXT,
                latitude REAL,
                longitude REAL,
                created_at TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sync_events (
                event_id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT,
                player_id TEXT,
                event_type TEXT NOT NULL,
                created_at TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS pairing_codes (
                code TEXT PRIMARY KEY,
                account_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                claimed_at TEXT,
                claimed_by_device_id TEXT,
                FOREIGN KEY (account_id) REFERENCES local_accounts(account_id)
            );

            CREATE TABLE IF NOT EXISTS encrypted_placed_documents (
                document_id TEXT PRIMARY KEY,
                creator_player_id TEXT,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                radius_m REAL NOT NULL,
                algorithm TEXT NOT NULL,
                created_at TEXT NOT NULL,
                document_kind TEXT NOT NULL,
                ciphertext_hex TEXT NOT NULL,
                nonce_hex TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS secret_maze_destinations (
                destination_id TEXT PRIMARY KEY,
                creator_player_id TEXT,
                label TEXT NOT NULL,
                kind TEXT NOT NULL,
                clue TEXT,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                altitude_m REAL,
                horizontal_accuracy_m REAL,
                altitude_accuracy_m REAL,
                altitude_tolerance_m REAL,
                sample_count INTEGER NOT NULL,
                calibrated_seconds REAL NOT NULL,
                created_at TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );
            """
        )
        connection.execute(
            """
            INSERT INTO schema_meta (key, value)
            VALUES ('schema_version', ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            (str(SCHEMA_VERSION),),
        )
        connection.commit()
    return database_path(data_dir)


def database_status(data_dir: Path) -> dict[str, Any]:
    path = initialize_database(data_dir)
    with _DB_LOCK, connect(data_dir) as connection:
        counts = {
            table: connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            for table in (
                "local_accounts",
                "devices",
                "players",
                "quests",
                "artifacts",
                "sync_events",
                "pairing_codes",
                "encrypted_placed_documents",
                "secret_maze_destinations",
            )
        }
        schema_version = connection.execute(
            "SELECT value FROM schema_meta WHERE key = 'schema_version'"
        ).fetchone()
    return {
        "path": str(path),
        "exists": path.exists(),
        "size_bytes": path.stat().st_size if path.exists() else 0,
        "schema_version": int(schema_version["value"]) if schema_version else None,
        "counts": counts,
    }


def create_account(data_dir: Path, display_name: str) -> dict[str, str]:
    initialize_database(data_dir)
    now = utc_now()
    account = {
        "account_id": f"account-{secrets.token_hex(8)}",
        "display_name": display_name,
        "created_at": now,
        "updated_at": now,
    }
    with _DB_LOCK, connect(data_dir) as connection:
        connection.execute(
            """
            INSERT INTO local_accounts (
                account_id, display_name, created_at, updated_at
            )
            VALUES (:account_id, :display_name, :created_at, :updated_at)
            """,
            account,
        )
        connection.commit()
    return account


def list_accounts(data_dir: Path) -> list[dict[str, Any]]:
    initialize_database(data_dir)
    with _DB_LOCK, connect(data_dir) as connection:
        rows = connection.execute(
            """
            SELECT account_id, display_name, created_at, updated_at
            FROM local_accounts
            ORDER BY created_at DESC
            """
        ).fetchall()
    return [dict(row) for row in rows]


def get_account(data_dir: Path, account_id: str) -> dict[str, Any] | None:
    initialize_database(data_dir)
    with _DB_LOCK, connect(data_dir) as connection:
        row = connection.execute(
            """
            SELECT account_id, display_name, created_at, updated_at
            FROM local_accounts
            WHERE account_id = ?
            """,
            (account_id,),
        ).fetchone()
    return dict(row) if row else None


def register_device(
    data_dir: Path,
    *,
    device_id: str,
    device_name: str,
    platform: str,
    account_id: str | None = None,
) -> dict[str, Any]:
    initialize_database(data_dir)
    now = utc_now()
    device = {
        "device_id": device_id,
        "account_id": account_id,
        "device_name": device_name,
        "platform": platform,
        "created_at": now,
        "last_seen_at": now,
    }
    with _DB_LOCK, connect(data_dir) as connection:
        connection.execute(
            """
            INSERT INTO devices (
                device_id, account_id, device_name, platform, created_at, last_seen_at
            )
            VALUES (
                :device_id, :account_id, :device_name, :platform,
                :created_at, :last_seen_at
            )
            ON CONFLICT(device_id) DO UPDATE SET
                account_id = excluded.account_id,
                device_name = excluded.device_name,
                platform = excluded.platform,
                last_seen_at = excluded.last_seen_at
            """,
            device,
        )
        connection.commit()
    return device


def create_pairing_code(
    data_dir: Path,
    *,
    account_id: str,
    ttl_minutes: int = 15,
) -> dict[str, Any]:
    initialize_database(data_dir)
    if not get_account(data_dir, account_id):
        raise ValueError("Account not found")
    now = datetime.now(timezone.utc)
    created_at = now.isoformat()
    expires_at = now.replace(microsecond=0).timestamp() + ttl_minutes * 60
    expires_at_iso = datetime.fromtimestamp(expires_at, timezone.utc).isoformat()
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    with _DB_LOCK, connect(data_dir) as connection:
        for _ in range(8):
            code = "".join(secrets.choice(alphabet) for _ in range(6))
            try:
                connection.execute(
                    """
                    INSERT INTO pairing_codes (
                        code, account_id, created_at, expires_at
                    )
                    VALUES (?, ?, ?, ?)
                    """,
                    (code, account_id, created_at, expires_at_iso),
                )
                connection.commit()
                return {
                    "code": code,
                    "account_id": account_id,
                    "created_at": created_at,
                    "expires_at": expires_at_iso,
                }
            except sqlite3.IntegrityError:
                continue
    raise RuntimeError("Could not create a unique pairing code")


def claim_pairing_code(
    data_dir: Path,
    *,
    code: str,
    device_id: str,
    device_name: str,
    platform: str,
    player_id: str | None = None,
    player_name: str | None = None,
) -> dict[str, Any]:
    initialize_database(data_dir)
    normalized_code = "".join(code.upper().split())
    now = utc_now()
    with _DB_LOCK, connect(data_dir) as connection:
        row = connection.execute(
            """
            SELECT code, account_id, created_at, expires_at, claimed_at
            FROM pairing_codes
            WHERE code = ?
            """,
            (normalized_code,),
        ).fetchone()
        if not row:
            raise ValueError("Pairing code not found")
        if row["claimed_at"]:
            raise ValueError("Pairing code has already been used")
        if datetime.fromisoformat(row["expires_at"]) < datetime.now(timezone.utc):
            raise ValueError("Pairing code has expired")

        connection.execute(
            """
            UPDATE pairing_codes
            SET claimed_at = ?, claimed_by_device_id = ?
            WHERE code = ?
            """,
            (now, device_id, normalized_code),
        )
        connection.commit()

    device = register_device(
        data_dir,
        device_id=device_id,
        device_name=device_name,
        platform=platform,
        account_id=row["account_id"],
    )
    ensure_player(data_dir, player_id, player_name)
    if player_id:
        record_sync_event(
            data_dir,
            device_id=device_id,
            player_id=player_id,
            event_type="device_paired",
            payload={
                "account_id": row["account_id"],
                "device_id": device_id,
                "platform": platform,
                "player_id": player_id,
            },
        )
    account = get_account(data_dir, row["account_id"])
    return {
        "account": account,
        "device": device,
        "paired_at": now,
    }


def ensure_player(
    data_dir: Path, player_id: str | None, player_name: str | None
) -> None:
    if not player_id:
        return
    initialize_database(data_dir)
    now = utc_now()
    with _DB_LOCK, connect(data_dir) as connection:
        connection.execute(
            """
            INSERT INTO players (player_id, player_name, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(player_id) DO UPDATE SET
                player_name = excluded.player_name,
                updated_at = excluded.updated_at
            """,
            (player_id, player_name or "Player", now, now),
        )
        connection.commit()


def record_quest(data_dir: Path, quest: dict[str, Any]) -> None:
    ensure_player(data_dir, quest.get("created_by"), quest.get("creator_name"))
    row = {
        "quest_id": quest["id"],
        "created_by": quest.get("created_by"),
        "name": quest.get("name", "Untitled quest"),
        "description": quest.get("description", ""),
        "category": quest.get("category", "unknown"),
        "kind": quest.get("kind", "checkin"),
        "source": quest.get("source", "unknown"),
        "latitude": quest.get("latitude"),
        "longitude": quest.get("longitude"),
        "radius_m": quest.get("radius"),
        "created_at": quest.get("created_at") or utc_now(),
        "payload_json": json.dumps(quest, sort_keys=True),
    }
    with _DB_LOCK, connect(data_dir) as connection:
        connection.execute(
            """
            INSERT INTO quests (
                quest_id, created_by, name, description, category, kind, source,
                latitude, longitude, radius_m, created_at, payload_json
            )
            VALUES (
                :quest_id, :created_by, :name, :description, :category, :kind,
                :source, :latitude, :longitude, :radius_m, :created_at, :payload_json
            )
            ON CONFLICT(quest_id) DO UPDATE SET
                created_by = excluded.created_by,
                name = excluded.name,
                description = excluded.description,
                category = excluded.category,
                kind = excluded.kind,
                source = excluded.source,
                latitude = excluded.latitude,
                longitude = excluded.longitude,
                radius_m = excluded.radius_m,
                payload_json = excluded.payload_json
            """,
            row,
        )
        connection.commit()


def record_artifact(
    data_dir: Path,
    *,
    artifact_id: str,
    artifact_kind: str,
    title: str,
    record: dict[str, Any],
    owner_player_id: str | None = None,
    quest_id: str | None = None,
    file_url: str | None = None,
) -> None:
    ensure_player(data_dir, owner_player_id, record.get("creator_name"))
    row = {
        "artifact_id": artifact_id,
        "artifact_kind": artifact_kind,
        "owner_player_id": owner_player_id,
        "quest_id": quest_id,
        "title": title,
        "file_url": file_url,
        "latitude": record.get("latitude"),
        "longitude": record.get("longitude"),
        "created_at": record.get("created_at") or record.get("timestamp") or utc_now(),
        "payload_json": json.dumps(record, sort_keys=True),
    }
    with _DB_LOCK, connect(data_dir) as connection:
        connection.execute(
            """
            INSERT INTO artifacts (
                artifact_id, artifact_kind, owner_player_id, quest_id, title,
                file_url, latitude, longitude, created_at, payload_json
            )
            VALUES (
                :artifact_id, :artifact_kind, :owner_player_id, :quest_id, :title,
                :file_url, :latitude, :longitude, :created_at, :payload_json
            )
            ON CONFLICT(artifact_id) DO UPDATE SET
                artifact_kind = excluded.artifact_kind,
                owner_player_id = excluded.owner_player_id,
                quest_id = excluded.quest_id,
                title = excluded.title,
                file_url = excluded.file_url,
                latitude = excluded.latitude,
                longitude = excluded.longitude,
                payload_json = excluded.payload_json
            """,
            row,
        )
        connection.commit()


def record_document(data_dir: Path, record: dict[str, Any]) -> None:
    record_artifact(
        data_dir,
        artifact_id=record["id"],
        artifact_kind="document",
        owner_player_id=record.get("created_by"),
        quest_id=record.get("quest_id"),
        title=record.get("title", "Untitled document"),
        file_url=record.get("pdf_url"),
        record=record,
    )


def record_song(data_dir: Path, record: dict[str, Any]) -> None:
    record_artifact(
        data_dir,
        artifact_id=record["id"],
        artifact_kind="song",
        owner_player_id=record.get("created_by"),
        quest_id=record.get("quest_id"),
        title=record.get("title", "Untitled song"),
        file_url=record.get("song_url"),
        record=record,
    )


def record_photo_upload(data_dir: Path, record: dict[str, Any]) -> None:
    artifact_id = f"photo-{Path(record['filename']).stem}"
    record_artifact(
        data_dir,
        artifact_id=artifact_id,
        artifact_kind="photo",
        owner_player_id=record.get("player_id"),
        quest_id=record.get("quest_id"),
        title=record.get("quest_name") or record["filename"],
        file_url=record.get("file_url"),
        record=record,
    )


def record_sync_event(
    data_dir: Path,
    *,
    event_type: str,
    payload: dict[str, Any],
    device_id: str | None = None,
    player_id: str | None = None,
) -> int:
    initialize_database(data_dir)
    with _DB_LOCK, connect(data_dir) as connection:
        cursor = connection.execute(
            """
            INSERT INTO sync_events (
                device_id, player_id, event_type, created_at, payload_json
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                device_id,
                player_id,
                event_type,
                utc_now(),
                json.dumps(payload, sort_keys=True),
            ),
        )
        connection.commit()
        return int(cursor.lastrowid)


def record_encrypted_placed_document(
    data_dir: Path,
    *,
    creator_player_id: str | None,
    document: dict[str, Any],
) -> dict[str, Any]:
    initialize_database(data_dir)
    row = {
        "document_id": document["id"],
        "creator_player_id": creator_player_id,
        "latitude": document["latitude"],
        "longitude": document["longitude"],
        "radius_m": document["radiusMeters"],
        "algorithm": document["algorithm"],
        "created_at": document["createdAt"],
        "document_kind": document["documentKind"],
        "ciphertext_hex": document["ciphertextHex"],
        "nonce_hex": document["nonceHex"],
        "payload_json": json.dumps(document, sort_keys=True),
    }
    with _DB_LOCK, connect(data_dir) as connection:
        connection.execute(
            """
            INSERT INTO encrypted_placed_documents (
                document_id, creator_player_id, latitude, longitude, radius_m,
                algorithm, created_at, document_kind, ciphertext_hex, nonce_hex,
                payload_json
            )
            VALUES (
                :document_id, :creator_player_id, :latitude, :longitude, :radius_m,
                :algorithm, :created_at, :document_kind, :ciphertext_hex, :nonce_hex,
                :payload_json
            )
            ON CONFLICT(document_id) DO UPDATE SET
                creator_player_id = excluded.creator_player_id,
                latitude = excluded.latitude,
                longitude = excluded.longitude,
                radius_m = excluded.radius_m,
                algorithm = excluded.algorithm,
                created_at = excluded.created_at,
                document_kind = excluded.document_kind,
                ciphertext_hex = excluded.ciphertext_hex,
                nonce_hex = excluded.nonce_hex,
                payload_json = excluded.payload_json
            """,
            row,
        )
        connection.commit()
    return document


def list_encrypted_placed_documents(data_dir: Path) -> list[dict[str, Any]]:
    initialize_database(data_dir)
    with _DB_LOCK, connect(data_dir) as connection:
        rows = connection.execute(
            """
            SELECT payload_json
            FROM encrypted_placed_documents
            ORDER BY created_at DESC
            """
        ).fetchall()
    return [json.loads(row["payload_json"]) for row in rows]


def record_secret_maze_destination(
    data_dir: Path,
    *,
    creator_player_id: str | None,
    destination: dict[str, Any],
) -> dict[str, Any]:
    initialize_database(data_dir)
    now = utc_now()
    destination = {
        **destination,
        "created_at": destination.get("created_at") or now,
    }
    row = {
        "destination_id": destination["id"],
        "creator_player_id": creator_player_id,
        "label": destination["label"],
        "kind": destination["kind"],
        "clue": destination.get("clue"),
        "latitude": destination["latitude"],
        "longitude": destination["longitude"],
        "altitude_m": destination.get("altitude_m"),
        "horizontal_accuracy_m": destination.get("horizontal_accuracy_m"),
        "altitude_accuracy_m": destination.get("altitude_accuracy_m"),
        "altitude_tolerance_m": destination.get("altitude_tolerance_m"),
        "sample_count": destination.get("sample_count") or 1,
        "calibrated_seconds": destination.get("calibrated_seconds") or 0,
        "created_at": destination["created_at"],
        "payload_json": json.dumps(destination, sort_keys=True),
    }
    with _DB_LOCK, connect(data_dir) as connection:
        connection.execute(
            """
            INSERT INTO secret_maze_destinations (
                destination_id, creator_player_id, label, kind, clue, latitude,
                longitude, altitude_m, horizontal_accuracy_m, altitude_accuracy_m,
                altitude_tolerance_m, sample_count, calibrated_seconds, created_at,
                payload_json
            )
            VALUES (
                :destination_id, :creator_player_id, :label, :kind, :clue,
                :latitude, :longitude, :altitude_m, :horizontal_accuracy_m,
                :altitude_accuracy_m, :altitude_tolerance_m, :sample_count,
                :calibrated_seconds, :created_at, :payload_json
            )
            ON CONFLICT(destination_id) DO UPDATE SET
                creator_player_id = excluded.creator_player_id,
                label = excluded.label,
                kind = excluded.kind,
                clue = excluded.clue,
                latitude = excluded.latitude,
                longitude = excluded.longitude,
                altitude_m = excluded.altitude_m,
                horizontal_accuracy_m = excluded.horizontal_accuracy_m,
                altitude_accuracy_m = excluded.altitude_accuracy_m,
                altitude_tolerance_m = excluded.altitude_tolerance_m,
                sample_count = excluded.sample_count,
                calibrated_seconds = excluded.calibrated_seconds,
                created_at = excluded.created_at,
                payload_json = excluded.payload_json
            """,
            row,
        )
        connection.commit()
    return destination


def list_secret_maze_destinations(data_dir: Path) -> list[dict[str, Any]]:
    initialize_database(data_dir)
    with _DB_LOCK, connect(data_dir) as connection:
        rows = connection.execute(
            """
            SELECT payload_json
            FROM secret_maze_destinations
            ORDER BY created_at DESC
            """
        ).fetchall()
    return [json.loads(row["payload_json"]) for row in rows]
