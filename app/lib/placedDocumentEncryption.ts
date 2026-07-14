import "react-native-get-random-values";

import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import {
  bytesToHex,
  hexToBytes,
  randomBytes,
} from "@noble/ciphers/utils.js";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

export type PlacedDocumentPublicMetadata = {
  id: string;
  latitude: number;
  longitude: number;
  altitudeMeters?: number | null;
  altitudeAccuracyMeters?: number | null;
  altitudeToleranceMeters?: number | null;
  radiusMeters: number;
  createdAt: string;
  documentKind: string;
  hint?: string;
  checkpointId?: string;
  checkpointName?: string;
  checkpointLatitude?: number;
  checkpointLongitude?: number;
  checkpointRadiusMeters?: number;
};

export type EncryptedPlacedDocument = PlacedDocumentPublicMetadata & {
  algorithm: "XChaCha20-Poly1305";
  ciphertextHex: string;
  nonceHex: string;
};

export type PlacedDocumentSecret = {
  documentKeyHex: string;
};

export type PlacedDocumentPlaintext = {
  title: string;
  byline: string;
  body: string;
};

export function encryptPlacedDocument(
  metadata: PlacedDocumentPublicMetadata,
  plaintext: PlacedDocumentPlaintext,
): {
  encryptedDocument: EncryptedPlacedDocument;
  secret: PlacedDocumentSecret;
} {
  const key = randomBytes(32);
  const nonce = randomBytes(24);
  const cipher = xchacha20poly1305(key, nonce, encodeMetadata(metadata));
  const plaintextBytes = encodeText(JSON.stringify(plaintext));
  const ciphertext = cipher.encrypt(plaintextBytes);

  return {
    encryptedDocument: {
      ...metadata,
      algorithm: "XChaCha20-Poly1305",
      ciphertextHex: bytesToHex(ciphertext),
      nonceHex: bytesToHex(nonce),
    },
    secret: {
      documentKeyHex: bytesToHex(key),
    },
  };
}

export function encryptPlacedDocumentWithSecret(
  metadata: PlacedDocumentPublicMetadata,
  plaintext: PlacedDocumentPlaintext,
  secret: PlacedDocumentSecret,
): EncryptedPlacedDocument {
  const nonce = randomBytes(24);
  const cipher = xchacha20poly1305(
    hexToBytes(secret.documentKeyHex),
    nonce,
    encodeMetadata(metadata),
  );
  const plaintextBytes = encodeText(JSON.stringify(plaintext));
  const ciphertext = cipher.encrypt(plaintextBytes);

  return {
    ...metadata,
    algorithm: "XChaCha20-Poly1305",
    ciphertextHex: bytesToHex(ciphertext),
    nonceHex: bytesToHex(nonce),
  };
}

export function derivePlacedDocumentSecret(
  documentId: string,
  unlockPhrase: string,
): PlacedDocumentSecret {
  const key = pbkdf2(
    sha256,
    normalizeUnlockPhrase(unlockPhrase),
    `homage-placed-document:v1:${documentId}`,
    { c: 120_000, dkLen: 32 },
  );
  return { documentKeyHex: bytesToHex(key) };
}

export function decryptPlacedDocument(
  encryptedDocument: EncryptedPlacedDocument,
  secret: PlacedDocumentSecret,
): PlacedDocumentPlaintext {
  const metadata: PlacedDocumentPublicMetadata = {
    id: encryptedDocument.id,
    latitude: encryptedDocument.latitude,
    longitude: encryptedDocument.longitude,
    altitudeMeters: encryptedDocument.altitudeMeters,
    altitudeAccuracyMeters: encryptedDocument.altitudeAccuracyMeters,
    altitudeToleranceMeters: encryptedDocument.altitudeToleranceMeters,
    radiusMeters: encryptedDocument.radiusMeters,
    createdAt: encryptedDocument.createdAt,
    documentKind: encryptedDocument.documentKind,
    hint: encryptedDocument.hint,
    checkpointId: encryptedDocument.checkpointId,
    checkpointName: encryptedDocument.checkpointName,
    checkpointLatitude: encryptedDocument.checkpointLatitude,
    checkpointLongitude: encryptedDocument.checkpointLongitude,
    checkpointRadiusMeters: encryptedDocument.checkpointRadiusMeters,
  };
  const cipher = xchacha20poly1305(
    hexToBytes(secret.documentKeyHex),
    hexToBytes(encryptedDocument.nonceHex),
    encodeMetadata(metadata),
  );
  const plaintextBytes = cipher.decrypt(hexToBytes(encryptedDocument.ciphertextHex));
  return JSON.parse(decodeText(plaintextBytes)) as PlacedDocumentPlaintext;
}

export function createPlacedDocumentId() {
  return `placed-${bytesToHex(randomBytes(8))}`;
}

function encodeMetadata(metadata: PlacedDocumentPublicMetadata) {
  return encodeText(
    JSON.stringify({
      id: metadata.id,
      latitude: roundCoordinate(metadata.latitude),
      longitude: roundCoordinate(metadata.longitude),
      altitudeMeters:
        typeof metadata.altitudeMeters === "number"
          ? roundAltitude(metadata.altitudeMeters)
          : null,
      altitudeAccuracyMeters:
        typeof metadata.altitudeAccuracyMeters === "number"
          ? roundAltitude(metadata.altitudeAccuracyMeters)
          : null,
      altitudeToleranceMeters: metadata.altitudeToleranceMeters ?? null,
      radiusMeters: metadata.radiusMeters,
      createdAt: metadata.createdAt,
      documentKind: metadata.documentKind,
      hint: metadata.hint ?? "",
      checkpointId: metadata.checkpointId ?? "",
      checkpointName: metadata.checkpointName ?? "",
      checkpointLatitude:
        typeof metadata.checkpointLatitude === "number"
          ? roundCoordinate(metadata.checkpointLatitude)
          : null,
      checkpointLongitude:
        typeof metadata.checkpointLongitude === "number"
          ? roundCoordinate(metadata.checkpointLongitude)
          : null,
      checkpointRadiusMeters: metadata.checkpointRadiusMeters ?? null,
    }),
  );
}

function roundCoordinate(value: number) {
  return Number(value.toFixed(7));
}

function roundAltitude(value: number) {
  return Number(value.toFixed(1));
}

function encodeText(value: string) {
  return new TextEncoder().encode(value);
}

function decodeText(value: Uint8Array) {
  return new TextDecoder().decode(value);
}

function normalizeUnlockPhrase(value: string) {
  return value.trim().normalize("NFKC");
}
