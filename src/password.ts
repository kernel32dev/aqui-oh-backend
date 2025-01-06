import * as crypto from "node:crypto";
import { getEnv } from "./utils";

const passwordHashingConfig = {
    pepper: getEnv("PASSWORD_PEPPER"),
    iterations: 10000,
    keyLength: 64,
    digest: "sha512",
};

export function genPasswordSalt(): string {
    return crypto.randomBytes(8).toString("base64url");
}

export function hashPassword(
    plainText: string,
    passwordSalt: string
): Promise<string> {
    const {
        pepper: passwordPepper,
        iterations,
        keyLength,
        digest,
    } = passwordHashingConfig;
    const salt = Buffer.concat([
        Buffer.from(passwordPepper),
        Buffer.from(passwordSalt),
    ]);
    return new Promise((resolve, reject) => {
        crypto.pbkdf2(
            plainText,
            salt,
            iterations,
            keyLength,
            digest,
            (err, derivedKey) => {
                if (!err) {
                    resolve(derivedKey.toString("base64url"));
                } else {
                    reject(err);
                }
            }
        );
    });
}