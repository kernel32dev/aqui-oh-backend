import express from "express";
import 'express-async-errors';
import * as auth from "./auth";
import * as reclamacao from "./reclamacao";
import { catchApiExceptions as api } from "./error";
import cors from "cors"; // 
import * as mensagem from "./mensagem"; 
import * as user from "./user";
const port = 3001;
const app = express();

app.use(cors()); 
app.use(express.json({ limit: "10mb" }));

app.get("/api/ping", (req, res) => {
    res.send("pong");
});

app.post("/api/signin", api(auth.signin));
app.post("/api/signoff", api(auth.signoff));
app.post("/api/login", api(auth.login));
app.post("/api/refresh", api(auth.refresh));

app.use(api(auth.authMiddleware));

app.get("/api/reclamacao", api(reclamacao.listReclamacao));
app.post("/api/reclamacao", api(reclamacao.createReclamacao));
app.get("/api/reclamacao/:reclamacao_id", api(reclamacao.getReclamacao));
app.put("/api/reclamacao/:reclamacao_id", api(reclamacao.updateReclamacao));
app.delete("/api/reclamacao/:reclamacao_id", api(reclamacao.deleteReclamacao));

app.get("/api/mensagem/:reclamacaoId", api(mensagem.getMensagensByReclamacaoId));

// Adicione as rotas para o endpoint user
app.get("/api/user/:userId", api(user.getUser));
app.post("/api/user", api(user.createUser));


app.post("/api/me", (req, res) => {
    res.json(req.user);
});

app.listen(port, () => {
    console.log(`Escutando na porta ${port}`);
});
