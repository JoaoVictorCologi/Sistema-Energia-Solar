# Integrações e importações

Todo dado de referência vem de fonte oficial. As importações gravam no PostgreSQL e o cálculo lê do banco, então nada é consultado em tempo real na hora de simular, com uma exceção: o CEP, que tem cache.

| Fonte | Dado | Como entra | Tabela |
| --- | --- | --- | --- |
| [ViaCEP](https://viacep.com.br/) | Cidade, UF e código IBGE do CEP | Sob demanda, com cache | `cep_cache` |
| [IBGE Localidades](https://servicodados.ibge.gov.br/api/docs/localidades) | Municípios | Script | `municipio` |
| [Atlas Brasileiro de Energia Solar 2017](https://labren.ccst.inpe.br/atlas_2017.html) | Irradiação por sede municipal | Script, com o arquivo baixado à mão | `irradiacao_municipio` |
| [ANEEL, tarifas](https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica) | TE e TUSD | Diária | `tarifa` |
| [ANEEL, componentes](https://dadosabertos.aneel.gov.br/dataset/componentes-tarifarias) | Fio B | Diária | `tarifa` |
| ANEEL, qualidade do serviço | Distribuidora de cada município | Semanal | `distribuidora`, `municipio_distribuidora` |
| Banco Central (SGS) | IPCA e Selic | Diária | `indicador_economico` |

Impostos e parâmetros da Lei 14.300 não têm API: ficam em [arquivos versionados](parametros.md).

## Chamada HTTP comum

Toda integração usa `buscarJson`, de `integracoes/http.ts`:

```ts
const dados = await buscarJson(url, { metodo: 'POST', corpo, timeoutMs: 10_000 });
```

- Timeout em cada tentativa (padrão 10 s) e no máximo 3 tentativas: pedir mais é ignorado.
- Repete só falha de conexão, timeout, 429 e 5xx, esperando 1 s e depois 2 s. Erro 4xx e resposta que não é JSON param na hora.
- A falha final lança `ErroDeIntegracao`, com o domínio e o motivo, sem a URL completa.
- A resposta é `unknown`: valide com zod antes de usar.

O ViaCEP usa timeout de 5 s e 2 tentativas, porque o visitante está esperando. A ANEEL usa 60 s por página, porque os arquivos são grandes.

Nunca se baixa uma base inteira quando ela tem filtro: as consultas usam filtros, colunas selecionadas e paginação.

## Cargas por script

Rodam na instalação e, depois, quando a fonte mudar. Podem rodar de novo, porque só atualizam. A ordem está em [instalacao.md](instalacao.md#4-dados-de-referência).

### `carregar-municipios`

Busca os 5.571 municípios numa chamada (visão nivelada do IBGE, cerca de 2 MB) e grava código, nome e UF.

### `carregar-atlas`

```
npm run carregar-atlas -- <caminho>/tilted_latitude_means_sedes-munic.csv
```

Regras da carga:

- Lê em streaming as 5.569 sedes. Colunas: `ID;LON;LAT;NAME;CLASS;STATE;ANNUAL;JAN;…;DEC`, em Wh/m² por dia.
- HSP = irradiação ÷ 1000.
- O `ID` é a célula da grade, não o código IBGE: o município casa por nome sem acento dentro da mesma UF. O que não casa vai para [`correcoes-atlas.json`](parametros.md#correcoes-atlasjson).
- Linha com HSP mensal fora de 2,0 a 8,0, ou com a média dos meses mais de 2% longe do anual, é recusada.
- O relatório lista as linhas recusadas, as sem município e os municípios sem irradiação. Se algum município ficar sem irradiação, o script termina com erro.

### Atlas Brasileiro de Energia Solar

O arquivo vem do ZIP `TILTED_LATITUDE_sedes-munic_(csv).zip`, na [página do Atlas 2017](https://labren.ccst.inpe.br/atlas_2017.html). É baixado e descompactado à mão, porque o download exige aceitar a licença, e não vai para o Git.

**Licença CC BY-NC-ND (LABREN/INPE):** o crédito precisa aparecer na tela e nos produtos gerados, e o **uso comercial exige autorização do INPE**. Isso precisa ser resolvido antes de uma operação comercial.

## Importações agendadas

Rodam dentro do processo da API, no fuso de São Paulo. As de mesma agenda rodam uma depois da outra.

| Tipo | Agenda | O que faz |
| --- | --- | --- |
| `aneel-tarifas` | Todo dia, 06:00 | Tarifas e Fio B das distribuidoras ligadas a municípios |
| `bcb-indicadores` | Todo dia, 06:00, depois da anterior | Séries 433 (IPCA mensal), 13522 (IPCA em 12 meses) e 432 (Selic meta) |
| `aneel-distribuidoras` | Domingo, 05:00 | Liga cada município às distribuidoras |

Para rodar na hora: `npm run importar -- <tipo>` ou `POST /api/admin/importacoes/:tipo`.

### Regras comuns

- **Rastreável:** cada execução grava uma linha em `importacao` com início, fim, status, versão da fonte, linhas gravadas e mensagem.
- **Falha nunca apaga dados:** o sistema segue com a última importação bem-sucedida.
- **Trava:** uma linha `executando` com menos de 30 minutos bloqueia uma nova execução do mesmo tipo. Depois disso, deixa de bloquear, para o caso de o servidor ter reiniciado no meio.
- **Mensagens:** `mensagem` só traz erros previstos (`ErroDeIntegracao`, `ErroDeImportacao`). Outro erro vira uma mensagem genérica e a pilha vai para o log.
- **Desatualizada:** sem sucesso há mais de 2 dias, a lista de importações marca `desatualizada: true`.

### `aneel-tarifas`

1. Compara a versão da fonte (datas dos recursos de tarifas e de componentes dos últimos 4 anos, mais a lista de distribuidoras ligadas, resumidas num hash) com a da última importação. Sem mudança, registra `sem_alteracao`.
2. Busca as tarifas cheias: B1 residencial, B2 rural e B3, modalidade convencional, base "Tarifa de Aplicação", sem as linhas de SCEE.
3. Busca o Fio B (`TUSD_FioB`) nos componentes dos últimos 4 anos. O componente não é publicado para todas as distribuidoras todo ano.
4. Grava numa transação, só para as distribuidoras ligadas a municípios. Vigência nova vira linha nova, e a antiga nunca é apagada.

**Validação:** a ANEEL publica em R$/MWh, com vírgula decimal e às vezes sem o zero (`",00"`).

| Situação | Tratamento |
| --- | --- |
| Valor ilegível, ou TE + TUSD fora de R$ 0,10 a R$ 2,00 | A linha é descartada e listada em `mensagem` |
| Fio B fora do intervalo entre zero e a TUSD, vigência invertida | A linha é descartada e listada em `mensagem` |
| Unidade diferente de MWh, ou erro que põe todas as linhas fora da faixa | A distribuidora fica com as tarifas anteriores, e as outras seguem |

A faixa de valores é uma trava contra erro de unidade, não um limite regulatório. Em 11/2026, a importação grava 104 distribuidoras em cerca de 10 s, e 22 delas não têm Fio B na vigência mais nova: a simulação usa o último publicado.

### `aneel-distribuidoras`

Não há um arquivo simples com a relação município → distribuidora. A base de usinas (MMGD) tem essa informação, mas só existe como ZIP ou Parquet completos. O caminho usa duas bases de qualidade do serviço, com DataStore:

1. `indqual-municipio` liga cada município aos conjuntos de unidades consumidoras.
2. Os limites de DEC/FEC do ano ligam cada conjunto atual à distribuidora, pelo CNPJ.

Regras:

- A distribuidora **sugerida** é a de mais conjuntos no município. Em empate, a de menor CNPJ, para o resultado não depender da ordem da API.
- Troca todos os vínculos numa transação.
- Recusa a importação se ligaria menos de 90% dos municípios: é a trava contra uma resposta incompleta.

Em 11/2026: 6.235 vínculos, 5.547 municípios ligados, 573 deles com mais de uma distribuidora, e 24 sem dado. Nesses casos, o cliente escolhe entre as distribuidoras da UF.

### `bcb-indicadores`

Busca desde o dia seguinte ao último valor gravado, ou 2 anos na primeira vez. Busca as três séries antes de gravar: falha em qualquer uma não grava nada.

| Série | Faixa aceita (%) | Uso |
| --- | --- | --- |
| 433, IPCA mensal | −2 a 3 | Histórico |
| 13522, IPCA em 12 meses | −5 a 30 | Reajuste anual da tarifa |
| 432, Selic meta | 0 a 50 | Taxa de desconto do VPL |

Um valor fora da faixa recusa a importação inteira, porque indica série trocada ou erro de unidade.

## Cliente da ANEEL (CKAN)

`integracoes/ckan.ts` lê o portal de dados abertos, em `https://dadosabertos.aneel.gov.br/api/3/action`:

```ts
const recursos = await buscarRecursosDoPacote('bandeiras-tarifarias');   // [{ id, nome, formato, datastoreAtivo, modificadoEm }]

await percorrerDatastore({
  recursoId,
  filtros: { SigUF: 'SP' },                     // E entre campos; lista no mesmo campo = OU
  campos: ['CodMunicipioIbge', 'SigAgente'],    // só as colunas usadas
  distinct: true,                               // opcional
  tamanhoDaPagina: 1000, limiteDePaginas: 20,   // padrões
}, async (registros) => { /* cada página, uma por vez */ });
```

Passar do limite de páginas lança erro: o filtro está largo demais e o resultado viria incompleto. Os IDs dos recursos não ficam fixos no código: são descobertos pelo nome do conjunto.

**Campos conferidos em 11/2026:**

- **Tarifas:** `SigAgente`, `NumCNPJDistribuidora`, `DatInicioVigencia`, `DatFimVigencia`, `DscBaseTarifaria`, `DscSubGrupo`, `DscModalidadeTarifaria`, `DscClasse`, `DscSubClasse`, `DscDetalhe`, `DscUnidadeTerciaria`, `VlrTUSD`, `VlrTE`.
- **Componentes:** `NumCPFCNPJ`, `DscSubGrupoTarifario`, `DscClasseConsumidor`, `DscSubClasseConsumidor`, `DscComponenteTarifario`, `DscUnidade`, `VlrComponenteTarifario`.
- A mesma sigla pode repetir com outro CNPJ depois de uma incorporação. Vale o CNPJ da vigência mais recente.

Os dados da ANEEL têm licença ODbL. A base de usinas traz CPF e CNPJ de titulares e não é importada.

## Banco Central

`https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados`, uma série por chamada, sempre com data inicial e final, porque séries diárias recusam janelas de 10 anos ou mais. Os valores vêm como texto e a data em `dd/mm/aaaa`.

## Criar uma importação

Um módulo acrescenta uma linha em `jobsDosModulos`, em `modulos/index.ts`:

```ts
import { ErroDeImportacao, type JobDeImportacao } from '../../jobs/tipos.ts';

export const jobBandeiras: JobDeImportacao = {
  tipo: 'tarifas-bandeiras',              // letras minúsculas, números e hífen
  descricao: 'Bandeiras tarifárias da ANEEL',
  agenda: '0 6 * * *',                    // cron, fuso de São Paulo
  async executar({ importacaoId, agora }) {
    // busca, valida (lance ErroDeImportacao para recusar) e grava em transação
    return { status: 'sucesso', linhasGravadas: 12, versaoDaFonte: '2026-11-02T08:24:31' };
  },
};
```

- O agendador e a rota chamam `registrarImportacao(job)`, que grava o início, executa e grava o resultado. Use essa função também ao rodar fora do agendador.
- Para saber se a fonte mudou, compare com `buscarVersaoDaUltimaImportacao(tipo)`.
- O job aparece sozinho em `GET /api/admin/importacoes` e no `npm run importar`.
