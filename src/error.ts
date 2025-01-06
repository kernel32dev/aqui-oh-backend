import type { NextFunction, Request, Response } from "express";
import { INTERNAL_SERVER_ERROR } from "./utils";

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
export function catchApiExceptions<T>(
    api: (req: Request<T>, res: Response, next: NextFunction) => any
): (req: Request<T>, res: Response, next: NextFunction) => void {
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
