import { Request, Response } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { AppError } from "./error";
import { NOT_FOUND } from "./utils";


const prisma = new PrismaClient();

export const mensagemSelect = {
    id: true,
    text: true,
    dth: true,
    image: true,
    lat: true,
    lng: true,
    reclamacao: {
        select: {
            id: true,
            title: true,
        },
    },
    user: {
        select: {
            id: true,
            name: true,
        },
    },
    
} satisfies Prisma.MensagemSelect;

export async function getMensagensByReclamacaoId(req: Request<{ reclamacaoId: string }>, res: Response) {
    const { reclamacaoId } = req.params
    const mensagens = await prisma.mensagem.findMany({
        select: mensagemSelect,
        where: {
            reclamacaoId: reclamacaoId.toString(),
            deletedAt: null
        },
    });

    if (mensagens.length === 0) {
        throw new AppError(NOT_FOUND, "MensagensByReclamacaoIdNotFound");
    }

    res.json(mensagens);
}