import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "./db";
import { CONFLICT, getEnv, UNAUTHORIZED, validate } from "./utils";
import { AppError, StatusException } from "./error";
import type { User } from "@prisma/client";
import { RequestHandler, RouteParameters } from "express-serve-static-core";
import { genPasswordSalt, hashPassword } from "./password";

//#region constants

const refreshTokenMaxAgeSeconds = 60 * 60 * 24 * 30; // 30 dias
const accessTokenMaxAgeSeconds = 60 * 60 * 24; // 1 dia

const refreshToken = z.object({
    type: z.literal("refresh"),
    user: z.string().min(1),
});

const accessToken = z.object({
    type: z.literal("access"),
    id: z.string().min(1),
    email: z.string().min(1),
    name: z.string().min(1),
    competeciaId: z.string().min(1).nullable(),
    createdAt: z.string().transform(Date),
    updatedAt: z.string().transform(Date),
});

const jwtSecret = getEnv("JWT_SECRET");

//#endregion

//#region apis

export async function signin(req: Request, res: Response) {
    const { name, email, password: plainTextPassword } = validate(req.body, z.object({
        email: z.string().min(1).email(),
        name: z.string().min(1),
        password: z.string().min(1),
    }));

    if (!await prisma.user.findFirst({
        select: {
            email: true,
        },
        where: {
            email,
            deletedAt: null
        },
    })) {
        throw new StatusException(CONFLICT, {
            error: "email_used",
            desciption: "esse email já está em uso",
        });
    }

    const passwordSalt = genPasswordSalt();
    const password = await hashPassword(plainTextPassword, passwordSalt);
    const user = await prisma.user.create({
        data: {
            name,
            email,
            password,
            passwordSalt,
        },
    });

    const tokens = await signTokens(user);
    return res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        ...tokens,
    });
}

/** apaga um usuário */
export async function signoff(req: Request, res: Response) {
    const { email, password: plainTextPassword } = validate(req.body, z.object({
        email: z.string().min(1).email(),
        password: z.string().min(1),
    }));
    const user = await prisma.user.findFirst({
        select: {
            id: true,
            password: true,
            passwordSalt: true,
        },
        where: {
            email,
            deletedAt: null,
        },
    });
    if (!user) {
        throw new StatusException(UNAUTHORIZED);
    }
    const password = await hashPassword(plainTextPassword, user.passwordSalt);
    if (user.password != password) {
        throw new StatusException(UNAUTHORIZED);
    }
    await prisma.user.update({
        where: {
            id: user.id,
            deletedAt: null,
        },
        data: {
            deletedAt: new Date(),
        },
    });
    return res.json({});
}

/** cria o token de refresh e acesso */
export async function login(req: Request, res: Response) {
    const { email, password: plainTextPassword, competencia } = validate(req.body, z.object({
        email: z.string().min(1).email(),
        password: z.string().min(1),
        competencia: z.boolean(),
    }));
    const user = await prisma.user.findFirst({
        select: {
            id: true,
            email: true,
            name: true,
            competeciaId: true,
            password: true,
            passwordSalt: true,
            createdAt: true,
            updatedAt: true,
        },
        where: {
            email,
            competeciaId: competencia ? { not: null } : null,
            deletedAt: null,
        },
    });
    if (!user) {
        console.warn("TENTATIVA DE LOGIN: usuário não encontrado", email);
        throw new StatusException(UNAUTHORIZED);
    }
    const password = await hashPassword(plainTextPassword, user.passwordSalt);
    if (user.password != password) {
        console.warn("TENTATIVA DE LOGIN: senha incorreta", email);
        throw new StatusException(UNAUTHORIZED);
    }

    res.json(await signTokens(user));
}

/** usa o token de refresh para criar novos token de refresh e acesso */
export async function refresh(req: Request, res: Response) {
    const authorization = req.headers.authorization || "";
    if (
        !authorization.toUpperCase().startsWith("BEARER ") ||
        authorization.length <= 7
    ) {
        throw new StatusException(UNAUTHORIZED, {
            error: "sem_token",
            description: "o token JWT não foi passado",
        });
    }
    const token = authorization.substring(7);

    const [verifyErr, payload] = await jwtVerifiy(token);

    const parsed = refreshToken.safeParse(payload);

    if (verifyErr || !parsed.success) {
        throw new AppError(UNAUTHORIZED, "token_invalido", "o token JWT é inválido ou expirou");
    }

    const user = await prisma.user.findUnique({
        where: {
            id: parsed.data.user,
        },
    });

    if (!user) {
        throw new AppError(UNAUTHORIZED, "token_invalido", "o token JWT é inválido ou expirou");
    }

    return res.json(await signTokens(user));
}

//#endregion

//#region middleware

declare global {
    namespace Express {
        interface Request {
            user: Pick<User, "id" | "name" | "competeciaId" | "email" | "createdAt" | "updatedAt">,
        }
    }
}

export async function auth(req: Request<any>) {
    const authorization = req.headers.authorization || "";
    if (
        !authorization.toUpperCase().startsWith("BEARER ") ||
        authorization.length <= 7
    ) {
        throw new AppError(UNAUTHORIZED, "sem_token", "o token JWT não foi passado");
    }
    const token = authorization.substring(7);

    const [verifyErr, payload] = await jwtVerifiy(token);

    const parsed = accessToken.safeParse(payload);

    if (verifyErr || !parsed.success) {
        throw new AppError(UNAUTHORIZED, "token_invalido", "o token JWT é inválido ou expirou");
    }
    return {
        id: parsed.data.id,
        email: parsed.data.email,
        name: parsed.data.name,
        competeciaId: parsed.data.competeciaId,
        createdAt: new Date(parsed.data.createdAt),
        updatedAt: new Date(parsed.data.updatedAt),
    };
}

export const authMiddleware: RequestHandler<RouteParameters<string>> = async (req, res, next) => {
    req.user = await auth(req);
    next();
}

//#endregion

//#region jwt

async function signTokens(user: {
    id: string;
    email: string;
    name: string;
    competeciaId: string | null;
    createdAt: Date;
    updatedAt: Date;
}) {
    const accessTokenData = {
        type: "access",
        id: user.id,
        email: user.email,
        name: user.name,
        competeciaId: user.competeciaId,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
    } satisfies z.input<typeof accessToken>;

    const refreshTokenData = {
        type: "refresh",
        user: user.id,
    } satisfies z.input<typeof refreshToken>

    const token_refresh = jwtSign(refreshTokenData, { expiresIn: refreshTokenMaxAgeSeconds });
    const token_access = jwtSign(accessTokenData, { expiresIn: accessTokenMaxAgeSeconds });
    return {
        token_refresh: await token_refresh,
        token_access: await token_access,
    };
}

function jwtVerifiy(token: string) {
    return new Promise<
        [jwt.VerifyErrors, null] | [null, string | jwt.JwtPayload]
    >((resolve) => {
        jwt.verify(token, jwtSecret, (err, payload) => {
            if (err) {
                resolve([err, null]);
                return;
            }
            if (payload === undefined) {
                resolve([
                    new jwt.JsonWebTokenError("jwt verification failed with no error"),
                    null,
                ]);
                return;
            }
            resolve([null, payload]);
        });
    });
}

function jwtSign(payload: string | Buffer | object, options: jwt.SignOptions) {
    return new Promise<string>((resolve, reject) => {
        jwt.sign(payload, jwtSecret, options, (err, token) => {
            if (err) {
                reject(err);
                return;
            }
            if (token === undefined) {
                reject(new Error("jwt signing failed with no error"));
                return;
            }
            resolve(token);
        });
    });
}

//#endregion
