import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const base=resolve(import.meta.dirname,'..');
const ui=readFileSync(resolve(base,'src/ui.js'),'utf8');
const storage=readFileSync(resolve(base,'src/storage.js'),'utf8');
const pkg=JSON.parse(readFileSync(resolve(base,'package.json'),'utf8'));
assert.equal(pkg.version,'1.7.1');
for(const route of ['/presentation','/admin/settings','/admin/questions','/admin/history']) assert.ok(ui.includes(route),`Rota ausente: ${route}`);
for(const store of ['games','gameTeams','activities','responses','academicScores','competitionScores','cardUsages','questions']) assert.ok(storage.includes(`'${store}'`),`Store ausente: ${store}`);
assert.ok(ui.includes("path==='/admin/games/new'?null"),'Nova partida deve preceder a rota dinâmica');
assert.ok(ui.includes('projectionClockInterval=setInterval'),'Cronômetro projetado sem controle de intervalo');
assert.ok(ui.includes("games.find(g=>g.status==='in_progress')||games[0]"),'Projeção deve priorizar partida em andamento');
assert.ok(ui.includes('scoreForTeam('),'Pontuação consolidada ausente');
assert.ok(ui.includes("type==='hint'") && ui.includes("type==='duel'"),'Cartas incompletas');
for(const name of ['pirates','samurai','galaxy','ninja','gods','retro','monsters','dino']) assert.ok(existsSync(resolve(base,`public/assets/teams/${name}.webp`)),`Imagem ausente: ${name}`);
for(const module of ['architecture','mathematics']) {const data=JSON.parse(readFileSync(resolve(base,`public/modules/${module}/module.json`),'utf8'));assert.ok(data.activityTypes?.length>0);}
console.log('PASSOU: 21 verificações estáticas de integridade do projeto.');

assert.ok(ui.includes('function teamTimeLeft('),'Temporizador individual ausente');
assert.ok(ui.includes('teamExtraSeconds:extra'),'Carta Tempo Extra não individualizada');
assert.ok(ui.includes('data-team-time'),'Tempo individual não exibido');
const css=readFileSync(resolve(base,'src/style.css'),'utf8');
assert.ok(css.includes('.projection section{max-width:1000px}'),'Largura da projeção incorreta');

assert.ok(ui.includes('exportGamePdf('),'Exportação PDF não encontrada');
assert.ok(ui.includes('queue-collective'),'Diferenciação de atividades ausente');

assert.ok(ui.includes("function arenaConfirm("),"Modal de confirmação ausente");
assert.ok(ui.includes("installArenaShortcuts"),"Atalhos ausentes");
assert.ok(existsSync(resolve(base,"public/manual-do-professor.pdf")),"Manual não incorporado");
