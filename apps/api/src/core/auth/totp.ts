import { TOTP, Secret } from 'otpauth';
import * as QRCode from 'qrcode';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const APP_NAME = 'Surdej';
const BACKUP_CODE_COUNT = 8;

/** Generate a new TOTP secret + provisioning URI + QR code data URL */
export async function generateTotpSetup(userEmail: string) {
    const secret = new Secret({ size: 20 });

    const totp = new TOTP({
        issuer: APP_NAME,
        label: userEmail,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret,
    });

    const uri = totp.toString();
    const qrCodeDataUrl = await QRCode.toDataURL(uri);

    return {
        secret: secret.base32,
        uri,
        qrCodeDataUrl,
    };
}

/** Verify a TOTP token against a secret (allows +-1 window) */
export function verifyTotp(secret: string, token: string): boolean {
    const totp = new TOTP({
        issuer: APP_NAME,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: Secret.fromBase32(secret),
    });

    const delta = totp.validate({ token, window: 1 });
    return delta !== null;
}

/** Generate backup codes (plaintext + hashed pairs) */
export async function generateBackupCodes(): Promise<{
    plaintext: string[];
    hashed: string[];
}> {
    const codes: string[] = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
        const code = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8-char hex
        codes.push(code);
    }

    const hashed = await Promise.all(codes.map((c) => bcrypt.hash(c, 10)));

    return { plaintext: codes, hashed };
}

/** Verify a backup code against the stored hashed list. Returns the index if found, -1 otherwise. */
export async function verifyBackupCode(
    code: string,
    hashedCodes: string[],
): Promise<number> {
    const normalized = code.toUpperCase().replace(/[\s-]/g, '');
    for (let i = 0; i < hashedCodes.length; i++) {
        if (await bcrypt.compare(normalized, hashedCodes[i])) {
            return i;
        }
    }
    return -1;
}
