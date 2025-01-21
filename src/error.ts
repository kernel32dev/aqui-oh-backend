import type { NextFunction, Request, Response } from "express";
import { INTERNAL_SERVER_ERROR } from "./utils";
import type { WebSocket } from "ws";

/** essa classe é capturada por `catchApiExceptions` para retornar erros com status de forma mais prática */
export class StatusException {
    constructor(public status: number, public body?: any) { }
}

export class AppError extends StatusException {
    constructor(status: number, errorId: string, description?: string) {
        super(status, {error: errorId, description });
    }
}

/** captura erros de uma função assincrona, para que não mate o servidor
 *
 * faz isso criando uma função que chama a sua função assincrona,
 * mas caso a sua função dé um exception, responde com um 500 e loga o exception no console
 *
 * caso o exception for StatusException, usa o status do StatusException ao invés de 500 */
export function catchApiExceptions(
    api: (req: Request<any>, res: Response, next: NextFunction) => any
): (req: Request<any>, res: Response, next: NextFunction) => void {
    return async (req, res, next) => {
        try {
            await api(req, res, next);
        } catch (e) {
            if (e instanceof StatusException) {
                if (typeof e.body == "undefined") {
                    res.status(e.status).send();
                } else {
                    res.status(e.status).json(e.body);
                }
            } else {
                console.error(e);
                res.status(INTERNAL_SERVER_ERROR).send();
            }
        }
    };
}

/** captura erros de uma função assincrona, para que não mate o servidor
 *
 * faz isso criando uma função que chama a sua função assincrona,
 * mas caso a sua função dé um exception, envia uma mensagem com o erro e loga o exception no console */
export function catchWsExceptions(
    api: (ws: WebSocket, req: Request<any>, next: NextFunction) => any
): (ws: WebSocket, req: Request<any>, next: NextFunction) => void {
    return async (ws, req, next) => {
        try {
            await api(ws, req, next);
        } catch (e) {
            if (e instanceof StatusException) {
                if (typeof e.body == "undefined") {
                    ws.send(JSON.stringify({
                        status: e.status,
                        error: "StatusException",
                    }));
                } else {
                    ws.send(JSON.stringify({
                        status: e.status,
                        error: e.body,
                    }));
                }
            } else {
                console.error(e);
                ws.send(JSON.stringify({
                    status: INTERNAL_SERVER_ERROR,
                    error: "Unknown Error",
                }));
            }
            ws.close();
        }
    };
}
