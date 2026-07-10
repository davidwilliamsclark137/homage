# Encrypted Document Drop Prototype

Current goal: prove that one phone can publish a location-indexed encrypted
document and another phone can discover the locked package without the backend
or second phone seeing the plaintext first.

## Active Test Flow

1. Phone A opens Homage Document Studio.
2. Phone A writes a short title and body.
3. Phone A enters an unlock phrase.
4. Phone A taps `Encrypt here`.
5. Phone A taps `Upload locked`.
6. Phone B opens Homage Document Studio.
7. Phone B taps `Find nearby encrypted packages`.
8. Phone B selects the locked package.
9. Phone B uses the in-app map or map buttons to travel to the coordinates.
10. Phone B types the same unlock phrase.
11. Phone B taps `Decrypt at location`.

## Privacy Model

The backend stores:

- Document ID
- GPS latitude and longitude
- Unlock radius
- Created time
- Document kind
- Ciphertext
- Nonce
- Encryption algorithm

The backend does not store:

- Plaintext title
- Plaintext body
- Unlock phrase
- Derived encryption key

## Encryption

The phone derives a 32-byte key from the unlock phrase using PBKDF2-SHA256.
The salt includes the document ID:

```text
homage-placed-document:v1:{documentId}
```

The phone encrypts the document with `XChaCha20-Poly1305`.

The visible GPS metadata is authenticated data. If the document ID,
coordinates, radius, created time, or document kind are changed after
encryption, decryption should fail.

## Current Limitations

- GPS unlock is an app rule, not a cryptographic proof of physical presence.
- A weak unlock phrase can be guessed offline from the ciphertext.
- The in-app map uses OpenStreetMap tiles and requires network access.
- The backend discovery tunnel is temporary when using ngrok.
- No account/recipient permission model exists yet.

## Next Hardening Steps

- Require stronger unlock phrases or generate memorable passphrases.
- Persist received locked packages locally on Phone B.
- Add clearer empty/loading states for nearby search.
- Replace ngrok with a stable backend URL for repeated testing.
- Decide whether location unlock should remain phrase-based or move toward a
  stronger recipient-key model.
