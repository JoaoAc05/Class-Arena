# CLASS ARENA — v1.7.1

Aplicação web local para organizar competições educativas em sala de aula. O professor controla as atividades pelo painel administrativo e exibe questões, cronômetro e resultados em uma segunda janela de projeção.

## Requisitos e execução

- Node.js 20.19+ ou 22.12+.
- Navegador moderno com IndexedDB e BroadcastChannel.

```bash
npm install
npm run dev
```

Acesse **http://127.0.0.1:5173/admin**. Para projetar a partida, abra **http://127.0.0.1:5173/presentation** no mesmo navegador e origem. Não execute o HTML diretamente via `file://`.

Para gerar e visualizar a versão de produção:

```bash
npm run build
npm run preview
```

Para executar as verificações estáticas:

```bash
npm test
```

## Funcionalidades

- **Partidas e equipes:** cadastro de disciplinas, equipes e temas; atividades coletivas, confrontos entre duas equipes e ADS Challenge opcional.
- **Banco de questões:** cadastro e importação de arquivos JSON ou Excel (`.xlsx`/`.xls`), com modelo de planilha disponível no sistema.
- **Arena:** respostas registradas pelo professor, cronômetro iniciado automaticamente, pausa, retomada e projeção sincronizada com cenário do Coliseu.
- **Cartas:** Tempo Extra (+15 s para uma equipe), Dica, Troca (uso registrado; substituição presencial) e Duelo (atividade bônus competitiva).
- **Pontuação:** nota acadêmica de até 10 pontos, ranking competitivo separado, ajustes manuais e atividades de recuperação.
- **Resultados:** histórico de partidas, classificação, respostas, cartas, exportações CSV/JSON e relatório em PDF com logo ADS e integrantes das equipes.
- **Segurança:** dados armazenados localmente no IndexedDB, com exportação e restauração de backup JSON.
- **Materiais:** Manual do Professor e Manual do Aluno (convite ilustrado) disponíveis no menu lateral.

## Atalhos da Arena

| Atalho | Ação |
| --- | --- |
| `Espaço` | Pausar ou retomar o cronômetro |
| `Alt + N` | Solicitar encerramento da atividade |
| `Alt + P` | Abrir a projeção |
| `Ctrl + Enter` | Registrar a única resposta preenchida |
| `Esc` | Cancelar diálogo de confirmação |

Os atalhos de operação não são acionados durante a digitação.

## Observações importantes

- A pontuação competitiva não altera automaticamente a nota acadêmica. **O bônus de 1 ponto acadêmico para a equipe campeã está documentado no convite, mas ainda precisa ser aplicado manualmente pelo professor.**
- O encerramento da atividade é manual, mesmo quando o cronômetro chega a zero.
- O banco de dados depende do navegador, perfil e endereço utilizados. **Faça backups antes de atualizar ou restaurar dados**; a restauração substitui o conteúdo atual.
- A seleção automática de questões utiliza a primeira questão elegível, não um sorteio aleatório.
- O projeto possui verificações estáticas; o build completo e a homologação funcional em navegador/sala de aula ainda devem ser realizados.

**Versão 1.7.1:** convite ilustrado do aluno integrado, mantendo as regras e funcionalidades da v1.7.0.
