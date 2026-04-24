import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const SALT = 'surdej-keyvault-v1'; // static salt (key derivation uses env master key)

function getMasterKey(): Buffer {
    const raw = process.env['KEYVAULT_MASTER_KEY'];
    if (!raw) {
        throw new Error(
            'KEYVAULT_MASTER_KEY environment variable is not set. ' +
            'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
        );
    }
    // Derive a fixed-length key from the master secret
    return scryptSync(raw, SALT, KEY_LENGTH);
}

export interface EncryptedPayload {
    encryptedValue: string; // base64
    iv: string;             // base64
    authTag: string;        // base64
}

export function encryptSecret(plaintext: string): EncryptedPayload {
    const key = getMasterKey();
    const iv = randomBytes(IV_LENGTH);

    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
        encryptedValue: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
    };
}

export function decryptSecret(payload: EncryptedPayload): string {
    const key = getMasterKey();
    const iv = Buffer.from(payload.iv, 'base64');
    const authTag = Buffer.from(payload.authTag, 'base64');
    const ciphertext = Buffer.from(payload.encryptedValue, 'base64');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function maskSecret(value: string): string {
    if (value.length <= 8) return '••••••••';
    return value.slice(0, 4) + '••••' + value.slice(-4);
}
