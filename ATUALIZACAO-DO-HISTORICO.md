# Atualização do histórico da `main`

Em 06/11/2026 o histórico da `main` foi reescrito: os commits antigos foram agrupados em 5 commits que descrevem o que foi feito. Todos os hashes mudaram, com exceção do primeiro commit (`32f6237`).

**Quem clonou o repositório antes dessa data precisa seguir os passos abaixo.** Um `git pull` comum na `main` antiga traz os commits antigos de volta.

Quem clonar o repositório depois dessa data não precisa fazer nada.

## 1. Guarde o seu trabalho

Veja se há alterações sem commit:

```
git status
```

Se houver, faça um commit delas ou guarde com `git stash`.

## 2. Baixe o histórico novo

```
git fetch origin
```

## 3. Atualize a sua `main`

**Se você não tem commits próprios na `main`:**

```
git switch main
git reset --hard origin/main
```

O `reset --hard` apaga alterações sem commit. Por isso o passo 1 vem antes.

**Se você tem commits na `main` que ainda não enviou**, leve esses commits para uma branch antes de atualizar:

```
git switch main
git branch meu-trabalho
git reset --hard origin/main
git rebase --onto origin/main 29790d9 meu-trabalho
```

## 4. Atualize as suas branches

Faça isto em cada branch criada a partir da `main` antiga, como a `plano-2-usinas`. Na sua máquina, a branch pode estar atrasada em relação ao GitHub, por isso o `merge` vem primeiro:

```
git switch plano-2-usinas
git merge --ff-only origin/plano-2-usinas
git rebase --onto bc2bf15 29790d9
git push --force-with-lease origin plano-2-usinas
```

O commit `bc2bf15` tem exatamente o mesmo código do antigo `29790d9`, então essa troca de base não deve gerar conflitos. Se o `merge` recusar, é porque a branch local e a do GitHub divergiram: resolva essa diferença antes de continuar.

Se a branch partiu de outro commit, use o hash desse commit no lugar de `29790d9` e `origin/main` no lugar de `bc2bf15`. Nesse caso podem aparecer conflitos.

## 5. Atualize as dependências e o banco

A `main` ganhou migrations depois do `29790d9`. O banco não precisa ser recriado: as migrations antigas continuam com os mesmos nomes.

```
cd backend
npm install
npm run db:migrate

cd ../frontend
npm install
```

## 6. Confira

```
git log --oneline origin/main
```

O resultado precisa mostrar 5 commits, nesta ordem, do mais novo para o mais antigo:

1. `docs: adiciona a documentação do backend e do frontend e a coleção do Insomnia`
2. `feat: adiciona simulação refinada, papéis de acesso e orçamentos`
3. `feat: atende todo o Brasil e adiciona as telas do simulador e da área restrita`
4. `feat: cria a API, o motor de cálculo, o login e a identidade visual do site`
5. `Adiciona arquivos do projeto`

## O que não fazer

- Não rode `git pull` na `main` antiga, nem faça merge dela em outra branch: isso traz os commits antigos de volta.
- Não rode `git push --force` na `main` a partir de um clone antigo: isso apaga o histórico novo do GitHub.

Se um merge já trouxe os commits antigos para a sua `main`, volte ao passo 3. Antes, crie uma branch com `git branch meu-trabalho` para não perder o que for seu.

## Colocando uma branch na `main`

Quando a branch estiver pronta, coloque-a por cima da `main` atual. Aqui pode haver conflitos, porque a `main` avançou:

```
git switch plano-2-usinas
git rebase origin/main
```

Depois, junte os commits em um só e descreva o que foi feito, sem citar códigos de planos ou tarefas:

```
git reset --soft origin/main
git commit -m "feat: adiciona o cadastro de usinas"
git push --force-with-lease origin plano-2-usinas
```

Antes do merge na `main`, todos os testes precisam passar.
