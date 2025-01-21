import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { FORBIDDEN, validate } from "./utils";
import { z } from "zod";
import { genPasswordSalt, hashPassword } from "./password";
import { AppError} from "./error";
import { CONFLICT, NOT_FOUND } from "./utils";

const prisma = new PrismaClient();

export async function listUser(req: Request<{ userId: string }>, res: Response) {
    if (!req.user.competeciaId) {
        throw new AppError(FORBIDDEN, "UserNotInCompetencia");
    }
    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            updatedAt: true
        },
        where: {
            id: req.params.userId,
            competeciaId: req.user.competeciaId,
            deletedAt: null
        },
    });
    res.json(users);
}

export async function getUser(req: Request<{ userId: string }>, res: Response) {
    if (!req.user.competeciaId) {
        throw new AppError(FORBIDDEN, "UserNotInCompetencia");
    }
    const user = await prisma.user.findUnique({
        select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            updatedAt: true
        },
        where: {
            id: req.params.userId,
            competeciaId: req.user.competeciaId,
            deletedAt: null
        },
    });

    if (!user) {
        throw new AppError(NOT_FOUND, "UserByIdNotFound");
    }

    res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    });
}

export async function createUser(req: Request, res: Response) {
    if (!req.user.competeciaId) {
        throw new AppError(FORBIDDEN, "UserNotInCompetencia");
    }

    const body = validate(req.body, z.object({
        email: z.string().email(),
        name: z.string(),
        password: z.string(),
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
            competeciaId: req.user.competeciaId,
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
    if (!req.user.competeciaId) {
        throw new AppError(FORBIDDEN, "UserNotInCompetencia");
    }

    const body = validate(req.body, z.object({
        name: z.string().optional(),
        password: z.string().optional(),
    }));

    let password = undefined;
    let passwordSalt = undefined;
    if (body.password) {
        passwordSalt = genPasswordSalt();
        password = await hashPassword(body.password, passwordSalt);
    }

    const exec = await prisma.user.updateMany({
        where: {
            id: req.params.userId
        },
        data: {
            name: body.name,
            password,
            passwordSalt,
        },
        
    });

    if (exec.count == 0) {
        throw new AppError(NOT_FOUND, "UserByIdNotFound");
    }

    res.json({});
}

export async function deleteUser(req: Request<{ userId: string }>, res: Response) {
    if (!req.user.competeciaId) {
        throw new AppError(FORBIDDEN, "UserNotInCompetencia");
    }

    const exec = await prisma.user.updateMany({
        data: {
            deletedAt: new Date()
        },
        where: {
            id: req.params.userId,
            competeciaId: req.user.competeciaId,
            deletedAt: null,
        }
    });

    if (exec.count == 0) {
        throw new AppError(NOT_FOUND, "UserByIdNotFound");
    }

    res.json({});
}