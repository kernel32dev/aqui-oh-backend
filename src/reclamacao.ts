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
    const reclamacoes = await prisma.reclamacao.findMany({
        select: reclamacaoSelect,
        where: {
            title: !query.title ? undefined : {
                contains: query.title,
                mode: "insensitive",
            },
            competeciaId: req.user.competeciaId || undefined,
            userId: req.user.competeciaId ? undefined : req.user.id,
            deletedAt: null,
        },
    });

    console.log('Reclamações encontradas:', reclamacoes);

    res.json(reclamacoes);
    
}

export async function createReclamacao(req: Request, res: Response) {
    if (req.user.competeciaId) throw new AppError(FORBIDDEN, "CompetenciaCannotCreateReclamacaoError");
    const body = validate(req.body, z.object({
        title: z.string().min(1),
        competeciaId: z.string().nullable().optional(),
        text: z.string().min(1),
        image: z.string().min(1),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
    }));
    body.competeciaId = body.competeciaId || await prisma.competecia.findFirst({
        select: {
            id: true,
        },
        where: {
            deletedAt: null,
        },
    }).then(x => x?.id);
    if (!body.competeciaId) {
        throw new AppError(NOT_FOUND, "CompetenciaByIdNotFound");
    }
    const result = await prisma.reclamacao.create({
        select: reclamacaoSelect,
        data: {
            userId: req.user.id,
            title: body.title.trim(),
            status: "aberto",
            competeciaId: body.competeciaId,
            mensagens: {
                create: {
                    text: body.text.trim(),
                    image: body.image,
                    lat: body.lat,
                    lng: body.lng,
                    dth: new Date(),
                    userId: req.user.id,
                }
            }
        }
    });
    console.log(result);
    res.json(result);
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
