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
            createdAt: true,
            updatedAt: true
        }
    });

    if (!user) {
        throw new AppError(NOT_FOUND, "UserNotFound");
    }

    res.json(user);
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