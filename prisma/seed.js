//@ts-check
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const competencia = await prisma.competecia.create({
        data: {
            name: 'Competência de Teste',
        },
    });

    console.log('Competência criada:', competencia);

    const userInCompetencia = await prisma.user.create({
        data: {
            email: 'fulano@gmail.com',
            name: 'Fulano',
            // SENHA 12345 (com PASSWORD_PEPPER=76dfa480fd5044799c8deec6e88a11a2)
            password: "cFIW4y82EUus-nzhTbDZYXvN5rkHZdP-wPMVP0u_0-gbPbX1GjBvMGv-FlhftJegiXVy7Jy0M3N9OjKmPHoPKg",
            passwordSalt: "vvtR20gZrkg",
            competeciaId: competencia.id,
        },
    });

    console.log('Usuário dentro da Competência criado:', userInCompetencia);

    const userOutCompetencia = await prisma.user.create({
        data: {
            email: 'cicrano@gmail.com',
            name: 'Cicrano',
            // SENHA 12345 (com PASSWORD_PEPPER=76dfa480fd5044799c8deec6e88a11a2)
            password: "cFIW4y82EUus-nzhTbDZYXvN5rkHZdP-wPMVP0u_0-gbPbX1GjBvMGv-FlhftJegiXVy7Jy0M3N9OjKmPHoPKg",
            passwordSalt: "vvtR20gZrkg",
        },
    });

    console.log('Usuário fora da Competência criado:', userOutCompetencia);

    const reclamacao = await prisma.reclamacao.create({
        data: {
            title: 'Reclamação de Teste',
            competeciaId: competencia.id,
            userId: userInCompetencia.id,
            status: "aberto",
        },
    });

    console.log('Reclamação criada:', reclamacao);

    const mensagens = await prisma.mensagem.createMany({
        data: [
            {
                text: 'Primeira mensagem na reclamação.',
                dth: new Date(),
                reclamacaoId: reclamacao.id,
                userId: userInCompetencia.id,
            },
            {
                text: 'Segunda mensagem na reclamação.',
                dth: new Date(),
                reclamacaoId: reclamacao.id,
                userId: userInCompetencia.id,
            },
            {
                text: 'Terceira mensagem adicionada.',
                dth: new Date(),
                reclamacaoId: reclamacao.id,
                userId: userOutCompetencia.id,
            },
        ],
    });

    console.log('Mensagens criadas:', mensagens);
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });