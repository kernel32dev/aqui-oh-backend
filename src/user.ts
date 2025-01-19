import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { validate } from "./utils";
import { z } from "zod";
import { genPasswordSalt, hashPassword } from "./password";
import { AppError} from "./error";
import { CONFLICT, NOT_FOUND } from "./utils";

const prisma = new PrismaClient();

export async function getUser(req: Request<{ userId: string }>, res: Response) {
    const user = await prisma.user.findUnique({
        where: {
            id: req.params.userId,
            deletedAt: null
        },
        select: {
            id: true,
            email: true,
            name: true,
            competeciaId: true,
            password: true, // Inclui o campo senha
            createdAt: true,
            updatedAt: true
        }
    });

    if (!user) {
        throw new AppError(NOT_FOUND, "UserNotFound");
    }

    // Decodifica a senha (não recomendado)
    const decodedPassword = user.password; // Aqui você pode aplicar a lógica de decodificação se necessário

    res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        competeciaId: user.competeciaId,
        password: decodedPassword, // Inclui a senha decodificada na resposta
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    });
}

export async function createUser(req: Request, res: Response) {
    const body = validate(req.body, z.object({
        email: z.string().email(),
        name: z.string(),
        password: z.string(),
        competeciaId: z.string().optional()
    }));

    const existingUser = await prisma.user.findUnique({
        where: {
            email: body.email,
            deletedAt: null
        }
    });

    if (existingUser) {
        throw new AppError(CONFLICT, "EmailAlreadyInUse");
    }

    const passwordSalt = genPasswordSalt();
    const password = await hashPassword(body.password, passwordSalt);

    const user = await prisma.user.create({
        data: {
            email: body.email,
            name: body.name,
            password,
            passwordSalt,
            competeciaId: body.competeciaId || null
        },
        select: {
            id: true,
            email: true,
            name: true,
            competeciaId: true,
            createdAt: true,
            updatedAt: true
        }
    });

    res.json(user);
}


export async function updateUser(req: Request<{ userId: string }>, res: Response) {
    const body = validate(req.body, z.object({
        email: z.string().email().optional(),
        name: z.string().optional(),
        password: z.string().optional(),
        competeciaId: z.string().optional()
    }));

    const user = await prisma.user.findUnique({
        where: {
            id: req.params.userId,
            deletedAt: null
        }
    });

    if (!user) {
        throw new AppError(NOT_FOUND, "UserNotFound");
    }

    if (body.email && body.email !== user.email) {
        const existingUser = await prisma.user.findUnique({
            where: {
                email: body.email,
                deletedAt: null
            }
        });

        if (existingUser) {
            throw new AppError(CONFLICT, "EmailAlreadyInUse");
        }
    }

    let password;
    if (body.password) {
        const passwordSalt = genPasswordSalt();
        password = await hashPassword(body.password, passwordSalt);
    }

    const updatedUser = await prisma.user.update({
        where: {
            id: req.params.userId
        },
        data: {
            email: body.email || user.email,
            name: body.name || user.name,
            password: password || user.password,
            passwordSalt: password ? genPasswordSalt() : user.passwordSalt,
            competeciaId: body.competeciaId || user.competeciaId
        },
        select: {
            id: true,
            email: true,
            name: true,
            competeciaId: true,
            createdAt: true,
            updatedAt: true
        }
    });

    res.json(updatedUser);
}

export async function deleteUser(req: Request<{ userId: string }>, res: Response) {
    const user = await prisma.user.findUnique({
        where: {
            id: req.params.userId,
            deletedAt: null
        }
    });

    if (!user) {
        throw new AppError(NOT_FOUND, "UserNotFound");
    }

    await prisma.user.update({
        where: {
            id: req.params.userId
        },
        data: {
            deletedAt: new Date()
        }
    });

    res.json({ message: "User deleted successfully" });
}