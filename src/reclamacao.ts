import { Request, Response } from "express";
import { z } from "zod";
import { FORBIDDEN, NOT_FOUND, validate } from "./utils";
import { prisma } from "./db";
import { Prisma } from "@prisma/client";
import { AppError } from "./error";

export const reclamacaoSelect = {
    id: true,
    title: true,
    status: true,
    competecia: {
        select: {
            id: true,
            name: true,
        },
    },
    user: {
        select: {
            id: true,
            name: true,
        },
    },
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.ReclamacaoSelect;

export async function listReclamacao(req: Request, res: Response) {
    // const query = validate(req.query, z.object({
    //     title: z.string().optional(),
    // }));

    // // Log the userId and competeciaId
    // console.log(`Request userId: ${req.user?.id}, CompeteciaId: ${req.user?.competeciaId}`);

    // const reclamacoes = await prisma.reclamacao.findMany({
    //     select: reclamacaoSelect,
    //     where: {
    //         title: query.title,
    //         userId: req.user?.competeciaId ? undefined : req.user?.id,
    //         competeciaId: req.user?.competeciaId || undefined,
    //         deletedAt: null
    //     },
    // });

    // res.json(reclamacoes);



    const query = validate(req.query, z.object({
        title: z.string().optional(),
    }));

    // Log the userId and competeciaId
    console.log(`Request userId: ${req.user?.id}, CompeteciaId: ${req.user?.competeciaId}`);

    // Construção condicional da cláusula where
    const whereClause: any = {
        title: query.title || undefined,
        deletedAt: null
    };

    if (req.user?.competeciaId) {
        whereClause.competeciaId = req.user.competeciaId;
    } else if (req.user?.id) {
        whereClause.userId = req.user.id;
    }

    const reclamacoes = await prisma.reclamacao.findMany({
        select: reclamacaoSelect,
        where: whereClause,
    });

    console.log('Reclamações encontradas:', reclamacoes);

    res.json(reclamacoes);
    
}

export async function createReclamacao(req: Request, res: Response) {
    if (req.user.competeciaId) throw new AppError(FORBIDDEN, "CompetenciaCannotCreateReclamacaoError");
    const body = validate(req.body, z.object({
        title: z.string(),
        competeciaId: z.string(),
    }));
    res.json(await prisma.reclamacao.create({
        select: reclamacaoSelect,
        data: {
            userId: req.user.id,
            title: body.title,
            status: "aberto",
            competeciaId: body.competeciaId,
        }
    }));
}

export async function getReclamacao(req: Request<{ reclamacao_id: string }>, res: Response) {
    const reclamacao = await prisma.reclamacao.findUnique({
        select: reclamacaoSelect,
        where: {
            id: req.params.reclamacao_id,
            deletedAt: null
        },
    });
    if (!reclamacao) throw new AppError(NOT_FOUND, "ReclamacaoByIdNotFound");
    res.json(reclamacao);
}

export async function updateReclamacao(req: Request<{ reclamacao_id: string }>, res: Response) {
    let body;
    if (req.user.competeciaId) {
        body = validate(req.body, z.object({
            status: z.literal("aberto").or(z.literal("em_andamento")).or(z.literal("ignorado")).or(z.literal("resolvido")),
        }));
        await assertCanMutateReclamacaoAsCompetencia(req.params.reclamacao_id, req.user.competeciaId);
    } else {
        body = validate(req.body, z.object({
            title: z.string().optional(),
            competeciaId: z.string().optional(),
        }));
        await assertCanMutateReclamacaoAsAuthor(req.params.reclamacao_id, req.user.id);
    }
    await prisma.reclamacao.updateMany({
        data: body,
        where: {
            id: req.params.reclamacao_id,
            deletedAt: null
        },
    });
}

export async function deleteReclamacao(req: Request<{ reclamacao_id: string }>, res: Response) {
    const { count } = await prisma.reclamacao.updateMany({
        data: {
            deletedAt: new Date()
        },
        where: {
            id: req.params.reclamacao_id,
            userId: req.user.id,
            deletedAt: null
        },
    });
    if (count == 0) {
        const count = await prisma.reclamacao.count({
            where: {
                id: req.params.reclamacao_id,
                deletedAt: null
            }
        });
        if (count == 0) {
            throw new AppError(NOT_FOUND, "ReclamacaoByIdNotFound");
        } else {
            throw new AppError(FORBIDDEN, "NotReclamacaoAuthorError");
        }
    }
    res.json({});
}

async function assertCanMutateReclamacaoAsAuthor(reclamacaoId: string, userId: string) {
    const reclamacao = await prisma.reclamacao.findUnique({
        select: {
            userId: true,
        },
        where: {
            id: reclamacaoId,
            deletedAt: null
        }
    });
    if (!reclamacao) throw new AppError(NOT_FOUND, "ReclamacaoByIdNotFound");
    if (reclamacao.userId != userId) throw new AppError(FORBIDDEN, "NotReclamacaoAuthorError");
}

async function assertCanMutateReclamacaoAsCompetencia(reclamacaoId: string, competenciaId: string) {
    const reclamacao = await prisma.reclamacao.findUnique({
        select: {
            id: true,
        },
        where: {
            id: reclamacaoId,
            competeciaId: competenciaId,
            deletedAt: null
        }
    });
    if (!reclamacao) throw new AppError(NOT_FOUND, "ReclamacaoByIdNotFound");
}
