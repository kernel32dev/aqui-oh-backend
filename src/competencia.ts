import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AppError } from "./error";
import { NOT_FOUND } from "./utils";

const prisma = new PrismaClient();

export async function getCompetencia(req: Request<{ competenciaId: string }>, res: Response) {
    const competencia = await prisma.competecia.findUnique({
        where: {
            id: req.params.competenciaId,
            deletedAt: null
        },
        select: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true
        }
    });

    if (!competencia) {
        throw new AppError(NOT_FOUND, "CompetenciaNotFound");
    }

    res.json(competencia);
}

export async function listCompetencias(req: Request, res: Response) {
    const competencias = await prisma.competecia.findMany({
        where: {
            deletedAt: null
        },
        select: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true
        }
    });

    res.json(competencias);
}