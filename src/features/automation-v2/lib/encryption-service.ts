/**
 * Encryption service for provider API keys.
 *
 * Uses AES-256-GCM with a key derived from the ENCRYPTION_KEY env var.
 * Falls back to a development-only key if ENCRYPTION_KEY is not set.
 * ⚠️  In production, always set ENCRYPTION_KEY to a 64-char hex string.
 */
import crypto from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 16  // 128 bits
const TAG_LENGTH = 16 // 128 bits

function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY
  if (keyHex) {
    const key = Buffer.from(keyHex, 'hex')
    if (key.length !== KEY_LENGTH) {
      throw new Error(
        `ENCRYPTION_KEY must be ${KEY_LENGTH * 2} hex chars (got ${keyHex.length})`,
      )
    }
    return key
  }
  // Dev-only fallback: derive from a known string so it's stable across restarts
  return crypto.scryptSync('sikkha-automation-dev-key', 'salt', KEY_LENGTH)
}

export const encryptionService = {
  encrypt(plaintext: string): string {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const authTag = cipher.getAuthTag().toString('hex')

    // Format: iv:authTag:ciphertext  (all hex)
    return `${iv.toString('hex')}:${authTag}:${encrypted}`
  },

  decrypt(ciphertext: string): string {
    const key = getEncryptionKey()
    const parts = ciphertext.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted payload format')
    }

    const iv = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  },
}
