import { PrismaClient } from '@prisma/client';
import { genPasswordSalt, hashPassword } from '../src/password';

const prisma = new PrismaClient();

async function senha(password: string) {
    const passwordSalt = genPasswordSalt();
    return { passwordSalt, password: await hashPassword(password, passwordSalt) };
}

async function main() {
    await prisma.mensagem.deleteMany({ where: { reclamacao: { title: 'Reclamação de Teste' } } });
    await prisma.reclamacao.deleteMany({ where: { title: 'Reclamação de Teste' } });
    await prisma.user.deleteMany({ where: { email: 'fulano@gmail.com' } });
    await prisma.user.deleteMany({ where: { email: 'cicrano@gmail.com' } });
    await prisma.competecia.deleteMany({ where: { name: 'Competência de Teste' } });

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
            ...await senha("12345"),
            competeciaId: competencia.id,
        },
    });

    console.log('Usuário dentro da Competência criado:', userInCompetencia);

    const userOutCompetencia = await prisma.user.create({
        data: {
            email: 'cicrano@gmail.com',
            name: 'Cicrano',
            ...await senha("12345"),
            competeciaId: null,
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


    const reclamacao2 = await prisma.reclamacao.create({
        data: {
            title: 'Buraco na rua vicente pestana',
            competeciaId: competencia.id,
            userId: userInCompetencia.id,
            status: "aberto",
        },
    });
    

    console.log('Reclamação criada:', reclamacao2);

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


    const mensagens2 = await prisma.mensagem.createMany({
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

    console.log('Mensagens criadas:', mensagens2);
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