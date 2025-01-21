import { Request, Response } from "express";
import { AppError } from "./error";
import { NOT_FOUND } from "./utils";
import type { WebSocket } from "ws";
import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

const sockets = new Map<string, Set<WebSocket>>();

export const mensagemSelect = {
    id: true,
    text: true,
    dth: true,
    image: true,
    lat: true,
    lng: true,
    userId: true,
} satisfies Prisma.MensagemSelect;

export async function getMensagensByReclamacaoId(req: Request<{ reclamacaoId: string }>, res: Response) {
    const mensagens = await prisma.mensagem.findMany({
        select: mensagemSelect,
        where: {
            reclamacaoId: req.params.reclamacaoId,
            deletedAt: null
        },
    });

    if (mensagens.length === 0) {
        throw new AppError(NOT_FOUND, "MensagensByReclamacaoIdNotFound");
    }

    res.json(mensagens);
}

export async function connect(ws: WebSocket, req: Request<{ reclamacaoId: string }>) {
    const reclamacao = await prisma.reclamacao.findFirst({
        select: {
            status: true,
            title: true,
            mensagens: {
                select: mensagemSelect
            }
        },
    });
    if (!reclamacao) {
        throw new AppError(NOT_FOUND, "ReclamacaoByIdNotFound");
    }
    const mensagens = await prisma.mensagem.findMany({
        select: mensagemSelect,
        where: {
            reclamacaoId: req.params.reclamacaoId,
            deletedAt: null
        },
    });
    
    ws.send(JSON.stringify({
        type: "Reclamacao",
        id: req.params.reclamacaoId,
        status: reclamacao.status,
        title: reclamacao.title,
    }))
    for (let i = 0; i < mensagens.length; i++) {
        ws.send(JSON.stringify({
            type: "Mensagem",
            ...mensagens[i]
        }));
    }

    let set = sockets.get(req.params.reclamacaoId);
    if (!set) sockets.set(req.params.reclamacaoId, set = new Set());
    set.add(ws);
    ws.on("error", () => set.delete(ws));
    ws.on("close", () => set.delete(ws));
}

export async function emitLiveMessage(reclamacaoId: string, message: {
    id: string;
    text: string;
    dth: Date;
    image: string | null;
    lat: number | null;
    lng: number | null;
    userId: string;
}) {
    const json = JSON.stringify({
        type: "Mensagem",
        ...message,
    });
    for (const ws of sockets.get(reclamacaoId) || []) {
        ws.send(json);
    }
}
