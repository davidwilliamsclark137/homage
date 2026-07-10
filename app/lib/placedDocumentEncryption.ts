import "react-native-get-random-values";

import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import {
  bytesToHex,
  hexToBytes,
  randomBytes,
} from "@noble/ciphers/utils.js";

export type PlacedDocumentPublicMetadata = {
  id: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  createdAt: string;
  documentKind: string;
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

export function decryptPlacedDocument(
  encryptedDocument: EncryptedPlacedDocument,
  secret: PlacedDocumentSecret,
): PlacedDocumentPlaintext {
  const metadata: PlacedDocumentPublicMetadata = {
    id: encryptedDocument.id,
    latitude: encryptedDocument.latitude,
    longitude: encryptedDocument.longitude,
    radiusMeters: encryptedDocument.radiusMeters,
    createdAt: encryptedDocument.createdAt,
    documentKind: encryptedDocument.documentKind,
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
      radiusMeters: metadata.radiusMeters,
      createdAt: metadata.createdAt,
      documentKind: metadata.documentKind,
    }),
  );
}

function roundCoordinate(value: number) {
  return Number(value.toFixed(7));
}

function encodeText(value: string) {
  return new TextEncoder().encode(value);
}

function decodeText(value: Uint8Array) {
  return new TextDecoder().decode(value);
}
