import { Request, Response } from "express";
import { AppError } from "./error";
import { NOT_FOUND } from "./utils";
import type { WebSocket } from "ws";
import { prisma } from "./db";
import type { Prisma } from "@prisma/client";
import { auth } from "./auth";

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
    req.user = await auth(req);
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




    ws.on("message", async (data) => {
        try {
            const mensagem = JSON.parse(data.toString());
    
            // Salva a mensagem no banco de dados
            const novaMensagem = await prisma.mensagem.create({
                data: {
                    text: mensagem.text,
                    dth: new Date(),
                    image: mensagem.image || null,
                    lat: mensagem.lat || null,
                    lng: mensagem.lng || null,
                    userId: req.user.id,
                    reclamacaoId: req.params.reclamacaoId,
                },
                select: mensagemSelect,
            });
    
            // Envia a mensagem para todos os clientes conectados
            await emitLiveMessage(req.params.reclamacaoId, novaMensagem);
    
        } catch (error) {
            console.error("Erro ao processar mensagem:", error);
        }
    });

    
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

