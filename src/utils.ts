import type { ZodType, ZodTypeDef } from "zod";
import { StatusException } from "./error";

export const OK = 200;
export const BAD_REQUEST = 400;
export const UNAUTHORIZED = 401;
export const FORBIDDEN = 403;
export const NOT_FOUND = 404;
export const CONFLICT = 409;
export const INTERNAL_SERVER_ERROR = 500;

export function getEnv(name: string): string {
    const value = process.env[name];
    if (!value)
        throw new Error(`a variável de ambiente ${name}, não foi configurada`);
    return value;
}

export function validate<A, B extends ZodTypeDef, C>(data: unknown, validator: ZodType<A, B, C>): A {
    const result = validator.safeParse(data);
    if (!result.success) {
        console.error(result.error);
        throw new StatusException(BAD_REQUEST, {
            error: "zod_error",
            description: "ocorreu um erro ao validar o request com zod",
            zod: result.error.errors,
        });
    }
    return result.data;
}

export function unreachable(message?: string): never {
    throw new Error(
        message
            ? "não era para ser possível chegar aqui, pois: " + message
            : "não era para ser possível chegar aqui"
    );
}
