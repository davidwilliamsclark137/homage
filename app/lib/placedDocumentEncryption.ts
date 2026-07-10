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

export type PlacedDocumentTransferPayload =
  | {
      app: "homage";
      version: 1;
      kind: "encrypted-placed-document";
      document: EncryptedPlacedDocument;
    }
  | {
      app: "homage";
      version: 1;
      kind: "placed-document-key";
      documentId: string;
      secret: PlacedDocumentSecret;
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

export function encodePlacedDocumentPackage(
  encryptedDocument: EncryptedPlacedDocument,
) {
  return JSON.stringify({
    app: "homage",
    version: 1,
    kind: "encrypted-placed-document",
    document: encryptedDocument,
  } satisfies PlacedDocumentTransferPayload);
}

export function encodePlacedDocumentKey(
  encryptedDocument: EncryptedPlacedDocument,
  secret: PlacedDocumentSecret,
) {
  return JSON.stringify({
    app: "homage",
    version: 1,
    kind: "placed-document-key",
    documentId: encryptedDocument.id,
    secret,
  } satisfies PlacedDocumentTransferPayload);
}

export function decodePlacedDocumentTransfer(
  value: string,
): PlacedDocumentTransferPayload {
  const parsed = JSON.parse(value) as Partial<PlacedDocumentTransferPayload>;
  if (parsed.app !== "homage" || parsed.version !== 1) {
    throw new Error("This is not a Homage transfer code.");
  }
  if (parsed.kind === "encrypted-placed-document") {
    if (!isEncryptedDocument(parsed.document)) {
      throw new Error("The encrypted document code is incomplete.");
    }
    return parsed as PlacedDocumentTransferPayload;
  }
  if (parsed.kind === "placed-document-key") {
    if (
      typeof parsed.documentId !== "string" ||
      !parsed.documentId ||
      !isSecret(parsed.secret)
    ) {
      throw new Error("The document key code is incomplete.");
    }
    return parsed as PlacedDocumentTransferPayload;
  }
  throw new Error("Unsupported Homage transfer code.");
}

function isEncryptedDocument(
  value: unknown,
): value is EncryptedPlacedDocument {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<EncryptedPlacedDocument>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.latitude === "number" &&
    typeof candidate.longitude === "number" &&
    typeof candidate.radiusMeters === "number" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.documentKind === "string" &&
    candidate.algorithm === "XChaCha20-Poly1305" &&
    typeof candidate.ciphertextHex === "string" &&
    typeof candidate.nonceHex === "string"
  );
}

function isSecret(value: unknown): value is PlacedDocumentSecret {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PlacedDocumentSecret>;
  return typeof candidate.documentKeyHex === "string";
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
