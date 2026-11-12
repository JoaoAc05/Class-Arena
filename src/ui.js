import { done } from './storage.js';
const themes=['Piratas — One Piece','Samurais — Demon Slayer','Galáxia / Astronautas','Ninjas — Naruto','Deuses — Mitologia Grega','Jogos clássicos','Pokémon','Dinossauros'];
const uid=()=>crypto.randomUUID();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const channel=new BroadcastChannel('class-arena-sync');

// Diálogo de confirmação acessível, usado em ações críticas.
function arenaConfirm(message,{danger=false}={}){
 return new Promise(resolve=>{
  const overlay=document.createElement('div');overlay.className='ca-confirm-overlay';
  overlay.innerHTML=`<section class="ca-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ca-confirm-title" aria-describedby="ca-confirm-message" tabindex="-1"><div class="ca-confirm-icon" aria-hidden="true">${danger?'!':'?'}</div><h2 id="ca-confirm-title">${danger?'Confirme esta ação':'Confirmar ação'}</h2><p id="ca-confirm-message"></p><div class="ca-confirm-actions"><button type="button" class="secondary" data-cancel>Cancelar</button><button type="button" class="${danger?'danger':'primary'}" data-accept>Confirmar</button></div></section>`;
  overlay.querySelector('#ca-confirm-message').textContent=message;
  const previous=document.activeElement;document.body.appendChild(overlay);
  const cancel=overlay.querySelector('[data-cancel]'),accept=overlay.querySelector('[data-accept]');
  function finish(value){overlay.removeEventListener('keydown',keyHandler);overlay.remove();previous?.focus?.();resolve(value);}
  function keyHandler(e){if(e.key==='Escape'){e.preventDefault();finish(false);}if(e.key==='Tab'){const first=cancel,last=accept;if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
  overlay.addEventListener('keydown',keyHandler);overlay.addEventListener('click',e=>{if(e.target===overlay)finish(false);});cancel.onclick=()=>finish(false);accept.onclick=()=>finish(true);cancel.focus();
 });
}
function installArenaShortcuts(){
 if(window.__arenaShortcutsInstalled)return;window.__arenaShortcutsInstalled=true;
 document.addEventListener('keydown',e=>{
  if(document.querySelector('.ca-confirm-overlay'))return;
  const target=e.target,typing=target?.matches?.('input,textarea,select,[contenteditable="true"]');
  if(e.altKey&&!e.ctrlKey&&!e.metaKey&&e.code==='KeyP'){
   e.preventDefault();window.open('/presentation','_blank','noopener');return;
  }
  if(typing||e.repeat)return;
  if(e.code==='Space'&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey){
   const btn=document.querySelector('#timer-toggle');if(btn){e.preventDefault();btn.click();}return;
  }
  if(e.altKey&&!e.ctrlKey&&!e.metaKey&&e.code==='KeyN'){
   const btn=document.querySelector('#finish-activity');if(btn){e.preventDefault();btn.click();}return;
  }
  if(e.ctrlKey&&!e.altKey&&!e.metaKey&&e.code==='Enter'){
   const pending=[...document.querySelectorAll('[data-save-answer]')].filter(b=>!b.disabled&&document.querySelector(`[data-answer="${b.dataset.saveAnswer}"]`)?.value.trim());
   if(pending.length===1){e.preventDefault();pending[0].click();}
  }
 });
}

export async function start(root,db) {
  installArenaShortcuts();
  const path=location.pathname.replace(/\/+$/,'')||'/admin';
  if(path==='/presentation') return projection(root,db);
  const arenaMatch=path.match(/^\/admin\/games\/([^/]+)\/arena$/);
  if(arenaMatch) return arena(root,db,decodeURIComponent(arenaMatch[1]));
  const historyMatch=path.match(/^\/admin\/history\/([^/]+)$/);
  const detailMatch=path==='/admin/games/new'?null:path.match(/^\/admin\/games\/([^/]+)$/);
  const page=historyMatch?'history-detail':path==='/admin/history'?'history':path==='/admin/settings'?'settings':path==='/admin/questions'?'questions':detailMatch?'game-detail':path.endsWith('/games/new')?'game-new':path.endsWith('/games')?'games':path.endsWith('/teams')?'teams':path.endsWith('/disciplines')?'disciplines':'home';
  const [ds,teams,games,types,gameTeams,activities,encounters]=await Promise.all(['disciplines','teams','games','activityTypes','gameTeams','activities','encounters'].map(s=>db.all(s)));
  root.innerHTML=layout(page);
  const content=root.querySelector('#content');
  if(page==='home') content.innerHTML=home(ds,teams,games);
  else if(page==='teams') content.innerHTML=teamPage(teams);
  else if(page==='disciplines') content.innerHTML=disciplinePage(ds,types);
  else if(page==='games') content.innerHTML=gamesPage(games,ds,gameTeams);
  else if(page==='questions'){content.innerHTML=questionPage(ds,types,await db.all('questions'));bindQuestions(root,db,ds,types);}
  else if(page==='game-new') content.innerHTML=gameForm(ds,teams,types);
  else if(page==='settings'){content.innerHTML=settingsPage();bindSettings(root,db);}
  else if(page==='history') await renderHistoryList(content,db,games,ds,gameTeams);
  else if(page==='history-detail') await renderHistoryDetail(content,db,decodeURIComponent(historyMatch[1]));
  else if(page==='game-detail') {
    const game=games.find(g=>g.id===decodeURIComponent(detailMatch[1]));
    if(!game){content.innerHTML='<div class="empty"><h3>Partida não encontrada</h3><a class="secondary" href="/admin/games">Voltar às partidas</a></div>';}
    else {
      const teamRows=gameTeams.filter(t=>t.gameId===game.id);
      const gameActivities=activities.filter(a=>a.gameId===game.id).sort((a,b)=>a.order-b.order);
      const gameEncounters=encounters.filter(x=>x.gameId===game.id).sort((a,b)=>a.round-b.round);
      content.innerHTML=gameDetail(game,teamRows,gameEncounters,gameActivities);
      bindGameDetail(root,db,game,teamRows,gameEncounters,gameActivities);
      await renderScorePanel(root,db,game,teamRows,gameActivities);
    }
  }
  else content.innerHTML='<div class="empty"><h3>Página não encontrada</h3><p>O endereço informado não corresponde a uma página do CLASS ARENA.</p><a href="/admin">Voltar ao início</a></div>';
  if(page==='teams') bindTeams(root,db,teams);
  if(page==='disciplines') bindDisciplines(root,db,ds,types);
  if(page==='game-new') bindGameForm(root,db,ds,teams,types);
}
function layout(page){return `<div class="shell"><aside><a class="brand" href="/admin"><img class="ads-logo" src="/assets/logo-ads.png" alt="Logo do curso de ADS"><span><strong>CLASS ARENA</strong><small>CLASSROOM COMPETITION</small></span></a><p class="nav-label">ESPAÇO DE TRABALHO</p><nav><a class="${page==='home'?'active':''}" href="/admin">▦　Visão geral</a><a class="${page==='disciplines'?'active':''}" href="/admin/disciplines">▤　Disciplinas</a><a class="${page==='teams'?'active':''}" href="/admin/teams">◈　Equipes</a><a class="${['games','game-new','game-detail'].includes(page)?'active':''}" href="/admin/games">◷　Partidas</a><a class="${page==='questions'?'active':''}" href="/admin/questions">◷　Banco de questões</a><a class="${['history','history-detail'].includes(page)?'active':''}" href="/admin/history">▧　Histórico</a><a class="${page==='settings'?'active':''}" href="/admin/settings">⚙　Configurações</a><a href="/manual-do-professor.pdf" target="_blank" rel="noopener">ⓘ　Manual do professor</a><a href="/manual-do-aluno.pdf" target="_blank" rel="noopener">ⓘ　Manual do aluno</a></nav><div class="sidefoot">● Modo local<br><small>Dados neste navegador</small></div></aside><main><header><div><small>PAINEL DO PROFESSOR</small><h1>${page==='home'?'Visão geral':page==='teams'?'Equipes':page==='disciplines'?'Disciplinas':page==='game-detail'?'Detalhes da partida':page==='games'?'Partidas':page==='questions'?'Banco de questões':page==='history'?'Histórico de partidas':page==='history-detail'?'Relatório da partida':page==='settings'?'Configurações':'Nova partida'}</h1></div><span>● AMBIENTE LOCAL</span></header><div id="content"></div><footer>CLASS ARENA / v1.7.1 <span>Execução local · Dados persistidos</span></footer></main></div><div id="toast"></div>`}

const BACKUP_STORES=['disciplines','activityTypes','questions','teams','themes','games','gameTeams','activities','encounters','responses','academicScores','competitionScores','cardUsages','settings'];
function settingsPage(){
 return `<section class="intro"><div><small>SEGURANÇA DOS DADOS</small><h2>Backup e restauração</h2><p>Os dados ficam no navegador. Salve uma cópia JSON periodicamente, especialmente antes de atualizações.</p></div></section>
 <section class="cards"><article class="card"><h3>Exportar backup</h3><p>Inclui disciplinas, questões, equipes, partidas, respostas, notas, cartas e configurações.</p><button class="primary" id="backup-export">⬇ Exportar backup JSON</button></article>
 <article class="card"><h3>Restaurar backup</h3><p>A restauração <strong>substitui todos os dados atuais</strong>. Faça um backup antes.</p><input id="backup-file" type="file" accept=".json,application/json"><button class="danger" id="backup-import">Restaurar arquivo</button></article></section>
 <section class="card"><h3>Diagnóstico local</h3><p id="backup-status">Verificando banco de dados...</p><p class="muted">Use o mesmo navegador e endereço local. Mantenha a janela de projeção fechada durante a restauração.</p></section>`;
}
function downloadJson(name,value){
 const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();
 setTimeout(()=>URL.revokeObjectURL(url),2000);
}
async function bindSettings(root,db){
 const status=root.querySelector('#backup-status');
 try{const counts=await Promise.all(BACKUP_STORES.map(async name=>[name,(await db.all(name)).length]));status.textContent=counts.map(([n,c])=>`${n}: ${c}`).join(' · ');}
 catch(err){status.textContent='Não foi possível consultar os dados: '+err.message;}
 root.querySelector('#backup-export').onclick=async()=>{
  try{
   const entries=await Promise.all(BACKUP_STORES.map(async name=>[name,await db.all(name)]));
   const stores=Object.fromEntries(entries);
   downloadJson(`class-arena-backup-${new Date().toISOString().slice(0,10)}.json`,{format:'class-arena-backup',version:1,exportedAt:new Date().toISOString(),stores});
  }catch(err){alert('Falha ao exportar backup: '+err.message);}
 };
 root.querySelector('#backup-import').onclick=async()=>{
  const file=root.querySelector('#backup-file').files?.[0];
  if(!file)return alert('Selecione um arquivo de backup JSON.');
  let data;
  try{if(file.size>30*1024*1024)throw Error('Arquivo maior que 30 MB.');data=JSON.parse(await file.text());
   if(data?.format!=='class-arena-backup'||data.version!==1||!data.stores||BACKUP_STORES.some(k=>!Array.isArray(data.stores[k])))throw Error('Formato de backup incompatível.');
   const keyFields={settings:'key'};
   for(const name of BACKUP_STORES){
    const ids=new Set();
    for(const record of data.stores[name]){
     const key=record?.[keyFields[name]||'id'];
     if(typeof record!=='object'||record===null||typeof key!=='string'||!key.trim()||ids.has(key))throw Error(`Registro inválido ou duplicado em ${name}.`);
     ids.add(key);
    }
   }
  }catch(err){return alert('Backup inválido: '+err.message);}
  if(!await arenaConfirm('ATENÇÃO: esta ação substituirá todas as informações atuais, inclusive partidas e questões. Continuar?'))return;
  try{
   const tx=db.raw.transaction(BACKUP_STORES,'readwrite');
   for(const name of BACKUP_STORES){
    const store=tx.objectStore(name);store.clear();
    for(const record of data.stores[name])store.put(record);
   }
   await done(tx);
   channel.postMessage({type:'backup:restored'});
   alert('Restauração concluída. A página será atualizada.');
   location.reload();
  }catch(err){alert('Falha na restauração (transação revertida): '+err.message);}
 };
}

function home(ds,ts,gs){return `<section class="welcome"><div><small>CENTRAL DE DINÂMICAS</small><h2>Transforme conteúdo em <b>competição.</b></h2><p>Organize equipes, conduza desafios e acompanhe os resultados em sala.</p></div><a class="primary" href="/admin/games/new">＋ Nova partida</a></section><section class="stats"><article>Partidas registradas<strong>${gs.length}</strong><small>Neste dispositivo</small></article><article>Disciplinas disponíveis<strong>${ds.length}</strong><small>Módulos carregados localmente</small></article><article>Equipes cadastradas<strong>${ts.length}</strong><small>Prontas para partidas</small></article></section><section class="panels"><article><small>CONFIGURAÇÃO</small><h3>Cadastros principais</h3><a href="/admin/disciplines">▤　Disciplinas →</a><a href="/admin/teams">◈　Equipes →</a><a href="/admin/games">◷　Partidas →</a></article><article><small>PRÓXIMAS ETAPAS</small><h3>Preparação da arena</h3><p>Configure atividades avaliativas, equipes e confrontos antes de iniciar a Arena.</p></article></section>`}
function disciplinePage(items,types){return `<section class="intro"><div><small>CONTEÚDO PEDAGÓGICO</small><h2>Disciplinas</h2><p>Organize modalidades e bancos de questões por módulo.</p></div><button class="primary" id="add">＋ Nova disciplina</button></section><section class="cards">${items.map(d=>`<article class="card"><small>${d.source==='module'?'MÓDULO JSON':'PERSONALIZADA'}</small><h3>${esc(d.name)}</h3><p>${esc(d.description)}</p><div>${types.filter(t=>t.disciplineId===d.id).length} modalidades</div><div class="actions"><button data-edit="${d.id}">Editar</button><button class="danger" data-delete="${d.id}">Excluir</button></div></article>`).join('')}</section>${modal('disciplina')}`}
function teamPage(items){return `<section class="intro"><div><small>ORGANIZAÇÃO DA TURMA</small><h2>Equipes</h2><p>Cadastre integrantes e temas. Temas repetidos são permitidos.</p></div><button class="primary" id="add">＋ Nova equipe</button></section><div class="notice">ⓘ　Os dados serão copiados para o histórico quando uma partida for criada.</div>${items.length?`<section class="cards">${items.map((t,i)=>`<article class="card"><small>${esc(t.theme||'Tema não definido')}</small><h3>${esc(t.name)}</h3><p>${t.members.length} integrante(s)</p><div class="chips">${t.members.map(m=>`<span>${esc(m)}</span>`).join('')}</div><div class="actions"><button data-edit="${t.id}">Editar</button><button class="danger" data-delete="${t.id}">Excluir</button></div></article>`).join('')}</section>`:`<div class="empty"><h3>Nenhuma equipe cadastrada</h3><p>Crie as equipes da turma para utilizá-las nas partidas.</p><button class="primary" id="empty-add">＋ Cadastrar primeira equipe</button></div>`}${modal('equipe')}`}
function modal(kind){return `<div class="backdrop hidden" id="modal"><form class="modal" id="form"><div class="modalhead"><h3 id="modal-title">Nova ${kind}</h3><button type="button" id="close" class="x">×</button></div><input type="hidden" id="record-id"><label>Nome<input id="name" required maxlength="80"></label>${kind==='equipe'?`<label>Tema<select id="theme"><option value="">Selecione</option>${themes.map(t=>`<option>${esc(t)}</option>`).join('')}</select></label><label>Integrantes <small>Um nome por linha.</small><textarea id="members" rows="5"></textarea></label>`:`<label>Descrição<textarea id="description" rows="3"></textarea></label>`}<div class="actions"><button type="button" id="cancel">Cancelar</button><button class="primary">Salvar</button></div></form></div>`}
function bindTeams(root,db,items){const modalEl=root.querySelector('#modal'),form=root.querySelector('#form');const open=t=>{form.reset();root.querySelector('#record-id').value=t?.id||'';root.querySelector('#name').value=t?.name||'';root.querySelector('#theme').value=t?.theme||'';root.querySelector('#members').value=(t?.members||[]).join('\n');root.querySelector('#modal-title').textContent=t?'Editar equipe':'Nova equipe';modalEl.classList.remove('hidden')};const close=()=>modalEl.classList.add('hidden');root.querySelector('#add').onclick=()=>open();root.querySelector('#empty-add')?.addEventListener('click',()=>open());root.querySelector('#close').onclick=root.querySelector('#cancel').onclick=close;root.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>open(items.find(t=>t.id===b.dataset.edit)));root.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{const t=items.find(x=>x.id===b.dataset.delete);if(await arenaConfirm(`Excluir ${t.name}?`)){await db.delete('teams',t.id);await refresh(root,db)}});form.onsubmit=async e=>{e.preventDefault();const old=items.find(t=>t.id===root.querySelector('#record-id').value);await db.put('teams',{id:old?.id||uid(),name:root.querySelector('#name').value.trim(),theme:root.querySelector('#theme').value,members:root.querySelector('#members').value.split('\n').map(x=>x.trim()).filter(Boolean),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()});channel.postMessage({type:'catalog:updated'});await refresh(root,db)}}
function bindDisciplines(root,db,items,types){const modalEl=root.querySelector('#modal'),form=root.querySelector('#form');const open=d=>{form.reset();root.querySelector('#record-id').value=d?.id||'';root.querySelector('#name').value=d?.name||'';root.querySelector('#description').value=d?.description||'';root.querySelector('#modal-title').textContent=d?'Editar disciplina':'Nova disciplina';modalEl.classList.remove('hidden')};root.querySelector('#add').onclick=()=>open();root.querySelector('#close').onclick=root.querySelector('#cancel').onclick=()=>modalEl.classList.add('hidden');root.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>open(items.find(d=>d.id===b.dataset.edit)));root.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{const d=items.find(x=>x.id===b.dataset.delete);if(!await arenaConfirm(`Excluir ${d.name} e suas modalidades?`))return;const tx=db.raw.transaction(['disciplines','activityTypes'],'readwrite');tx.objectStore('disciplines').delete(d.id);types.filter(t=>t.disciplineId===d.id).forEach(t=>tx.objectStore('activityTypes').delete(t.id));await done(tx);await refresh(root,db)});form.onsubmit=async e=>{e.preventDefault();const old=items.find(d=>d.id===root.querySelector('#record-id').value);await db.put('disciplines',{id:old?.id||uid(),name:root.querySelector('#name').value.trim(),description:root.querySelector('#description').value.trim(),version:old?.version||'1.0.0',source:old?.source||'custom',icon:old?.icon||'book',createdAt:old?.createdAt||new Date().toISOString()});await refresh(root,db)}}
async function refresh(root,db){const page=location.pathname.endsWith('/games/new')?'game-new':location.pathname.endsWith('/games')?'games':location.pathname.endsWith('/teams')?'teams':location.pathname.endsWith('/disciplines')?'disciplines':'home';await start(root,db);const toast=root.querySelector('#toast');if(toast){toast.textContent='Alterações salvas';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1800)}}

function gamesPage(games, disciplines, gameTeams) {
  const disciplineName=id=>disciplines.find(d=>d.id===id)?.name||'Disciplina removida';
  const statusLabel={draft:'RASCUNHO',in_progress:'EM ANDAMENTO',completed:'CONCLUÍDA'};
  const cards=[...games].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(g=>`<article class="card"><small>${esc(disciplineName(g.disciplineId))} · ${new Date(g.createdAt).toLocaleDateString('pt-BR')}</small><h3>${esc(g.name)}</h3><p>${gameTeams.filter(t=>t.gameId===g.id).length} equipes · ${g.config.academicActivities.length} atividades avaliativas</p><div>Nota máxima: 10 pontos · ${g.config.competitionEnabled?'Confrontos habilitados':'Sem confrontos'}</div><div class="actions"><span class="status">${statusLabel[g.status]||'RASCUNHO'}</span><a class="secondary" href="/admin/games/${encodeURIComponent(g.id)}">Abrir partida →</a></div></article>`).join('');
  return `<section class="intro"><div><small>ORGANIZAÇÃO DA AULA</small><h2>Partidas</h2><p>Abra uma partida para conferir a agenda e controlar sua execução.</p></div><a class="primary" href="/admin/games/new">＋ Nova partida</a></section>${cards?`<section class="cards">${cards}</section>`:`<div class="empty"><h3>Nenhuma partida configurada</h3><p>Crie uma partida para definir equipes, atividades e confrontos.</p><a class="primary" href="/admin/games/new">＋ Configurar primeira partida</a></div>`}`;
}
function gameForm(ds,teams) {
 return `<section class="intro"><div><small>PREPARAÇÃO DA DINÂMICA</small><h2>Nova partida</h2><p>Defina as equipes e a distribuição da avaliação acadêmica.</p></div><a href="/admin/games" class="secondary">Voltar às partidas</a></section><form id="game-form" class="game-form">
 <section class="form-panel"><h3>01 · Identificação</h3><label>Nome da partida<input id="game-name" required maxlength="80" placeholder="Ex.: Revisão de Sistemas Numéricos"></label><label>Disciplina<select id="game-discipline" required><option value="">Selecione</option>${ds.map(d=>`<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('')}</select></label><label>Tempo padrão<select id="game-time"><option value="60">1 minuto</option><option value="120" selected>2 minutos</option><option value="180">3 minutos</option></select></label></section>
 <section class="form-panel"><h3>02 · Equipes participantes</h3><p class="muted">Selecione de 2 a 6 equipes. Integrantes e tema serão copiados para o histórico.</p><div class="selection-grid">${teams.map((t,i)=>`<label class="selection"><input type="checkbox" ${i<6?'checked':'disabled'} name="game-team" value="${esc(t.id)}"><span><b>${esc(t.name)}</b><small>${esc(t.theme||'Sem tema')} · ${t.members.length} integrante(s)</small></span></label>`).join('')||'<p class="muted">Cadastre equipes antes de criar uma partida.</p>'}</div><p class="field-hint" id="team-count">${Math.min(teams.length,6)} de 6 equipes selecionadas</p></section>
 <section class="form-panel"><h3>03 · Atividades avaliativas</h3><p class="muted">A soma dos pesos deve totalizar 10 pontos. A nota acadêmica não depende do ranking competitivo.</p><div id="activity-options"><p class="muted">Selecione uma disciplina para carregar as modalidades.</p></div><div class="score-total">Total distribuído <strong id="score-total">0,0 / 10,0</strong></div></section>
 <section class="form-panel"><h3>04 · Competição</h3><label class="toggle"><input type="checkbox" id="competition-enabled" checked> Habilitar confrontos entre equipes</label><p class="muted">Rodízio equilibrado: cada equipe enfrenta todas as demais. Na resposta única, haverá dois ciclos de confrontos, com inversão de posições.</p><label>Direito de resposta nos confrontos<select id="duel-response-mode"><option value="both">Ambas as equipes podem responder</option><option value="first">Somente a primeira equipe a responder</option></select></label><p class="muted">O professor registra a primeira resposta. Uma resposta incorreta também encerra a oportunidade da adversária nesse confronto. Os confrontos valem pontos competitivos; os 10 pontos acadêmicos permanecem disponíveis nas atividades coletivas.</p><label class="toggle"><input type="checkbox" id="ads-challenge"> Incluir ADS Challenge (rodada geral de bônus)</label></section><div class="form-actions"><a class="secondary" href="/admin/games">Cancelar</a><button class="primary" type="submit">Salvar configuração da partida</button></div></form>`;
}
function bindGameForm(root,db,ds,teams,allTypes){
 const form=root.querySelector('#game-form'),discipline=root.querySelector('#game-discipline'),box=root.querySelector('#activity-options');
 const updateTotal=()=>{const total=[...box.querySelectorAll('[data-weight]')].filter(i=>i.closest('.activity-choice').querySelector('[type=checkbox]').checked).reduce((s,i)=>s+(Number(i.value)||0),0);const el=root.querySelector('#score-total');el.textContent=`${total.toFixed(1).replace('.',',')} / 10,0`;el.classList.toggle('invalid',Math.abs(total-10)>.001);};
 const rebalance=()=>{
   const rows=[...box.querySelectorAll('.activity-choice')].filter(r=>r.querySelector('[type=checkbox]').checked);
   const units=20, base=rows.length?Math.floor(units/rows.length):0, remainder=rows.length?units%rows.length:0;
   rows.forEach((r,i)=>{r.querySelector('[data-weight]').value=((base+(i<remainder?1:0))/2).toFixed(1);});
   updateTotal();
 };
 discipline.addEventListener('change',()=>{
   const types=allTypes.filter(t=>t.disciplineId===discipline.value&&t.scope!=='confrontation');
   box.innerHTML=types.length?types.map(t=>`<div class="activity-choice"><label><input type="checkbox" checked data-activity="${esc(t.id)}"><span><b>${esc(t.name)}</b><small>${esc(t.responseType)}</small></span></label><label class="weight-label">Peso<input data-weight="${esc(t.id)}" type="number" min="0.5" max="10" step="0.5" value="2"></label></div>`).join(''):'<p class="muted">Nenhuma modalidade disponível.</p>';
   box.querySelectorAll('[data-activity]').forEach(c=>c.addEventListener('change',()=>{
     c.closest('.activity-choice').querySelector('[data-weight]').disabled=!c.checked;
     rebalance();
   }));
   box.querySelectorAll('[data-weight]').forEach(i=>i.addEventListener('input',updateTotal));
   rebalance();
 });
 const updateTeamCount=()=>{
   const n=root.querySelectorAll('[name="game-team"]:checked').length;
   root.querySelector('#team-count').textContent=`${n} de 6 equipes selecionadas`;
   root.querySelectorAll('[name="game-team"]').forEach(x=>x.disabled=!x.checked&&n>=6);
 };
 root.querySelectorAll('[name="game-team"]').forEach(c=>c.addEventListener('change',updateTeamCount));
 updateTeamCount();
 if(ds.length){discipline.value=ds[0].id;discipline.dispatchEvent(new Event('change'));}
 form.addEventListener('submit',async e=>{e.preventDefault();const chosen=[...root.querySelectorAll('[name="game-team"]:checked')].map(c=>teams.find(t=>t.id===c.value)).filter(Boolean);if(chosen.length<2||chosen.length>6){alert('Selecione de 2 a 6 equipes.');return;}const activities=[...box.querySelectorAll('.activity-choice')].filter(r=>r.querySelector('[type=checkbox]').checked).map(r=>({activityTypeId:r.querySelector('[data-activity]').dataset.activity,name:r.querySelector('b').textContent,weight:Number(r.querySelector('[data-weight]').value)}));if(!activities.length||activities.some(a=>!Number.isFinite(a.weight)||a.weight<=0)){alert('Selecione atividades com pesos maiores que zero.');return;}const total=activities.reduce((s,a)=>s+a.weight,0);if(Math.abs(total-10)>.001){alert(`A soma dos pesos precisa ser 10. Total atual: ${total.toFixed(1)}.`);return;}const d=ds.find(x=>x.id===discipline.value);if(!d){alert('Selecione uma disciplina.');return;}const now=new Date().toISOString(),gameId=uid(),competition=root.querySelector('#competition-enabled').checked;const snapshots=chosen.map(t=>({id:uid(),gameId,teamId:t.id,nameSnapshot:t.name,membersSnapshot:[...t.members],themeSnapshot:t.theme||'',createdAt:now}));const responseMode=root.querySelector('#duel-response-mode').value;const encounters=competition?roundRobin(snapshots,gameId,now,responseMode==='first'?2:1):[];const game={id:gameId,name:root.querySelector('#game-name').value.trim(),disciplineId:d.id,disciplineSnapshot:{id:d.id,name:d.name,version:d.version||'1.0.0'},status:'draft',config:{defaultTimeSeconds:Number(root.querySelector('#game-time').value),academicMaximum:10,academicActivities:activities,competitionEnabled:competition,duelResponseMode:responseMode,adsChallengeEnabled:root.querySelector('#ads-challenge').checked},createdAt:now,updatedAt:now};const tx=db.raw.transaction(['games','gameTeams','encounters'],'readwrite');tx.objectStore('games').put(game);snapshots.forEach(t=>tx.objectStore('gameTeams').put(t));encounters.forEach(x=>tx.objectStore('encounters').put(x));try{await done(tx);channel.postMessage({type:'game:created',gameId});location.href='/admin/games';}catch(err){console.error(err);alert('Falha ao salvar a partida. Consulte o console.');}});
}
function gameDetail(game,teams,encounters,activities){
  const teamName=id=>teams.find(t=>t.id===id)?.nameSnapshot||'Equipe removida';
  const statusText={draft:'Rascunho',in_progress:'Em andamento',completed:'Concluída',pending:'Pendente',active:'Em execução',completed_activity:'Concluída'};
  const completed=activities.filter(a=>a.status==='completed').length;
  const active=activities.find(a=>a.status==='active');
  const queue=activities.map(a=>`<article class="queue-item ${a.scope==='collective'?'queue-collective':a.scope==='confrontation'?'queue-confrontation':'queue-special'} ${a.status==='active'?'is-active':''} ${a.status==='completed'?'is-complete':''}"><div class="queue-number">${String(a.order).padStart(2,'0')}</div><div class="queue-copy"><small>${a.scope==='collective'?'ATIVIDADE COLETIVA':a.scope==='confrontation'?'CONFRONTO':'ATIVIDADE ESPECIAL'} · ${statusText[a.status]||a.status}</small><h4>${esc(a.titleSnapshot)}</h4><p>${a.participants.map(teamName).join(' × ')}${a.academicWeight>0?` · ${a.academicWeight.toLocaleString('pt-BR')} ponto(s) acadêmicos`: ' · Sem pontuação acadêmica'}</p></div>${game.status==='in_progress'&&a.status==='pending'&&!active?`<button class="secondary" data-start-activity="${a.id}">Iniciar</button>`:''}${a.status==='active'?`<a class="primary" href="/admin/games/${game.id}/arena">Abrir Arena</a>`:''}</article>`).join('');
  const rounds=[...new Set(encounters.map(e=>e.round))].sort((a,b)=>a-b).map(round=>{const roundEncounters=encounters.filter(e=>e.round===round);const playing=new Set(roundEncounters.flatMap(e=>[e.teamAId,e.teamBId]));const resting=teams.filter(t=>!playing.has(t.id));return `<div class="round-block"><h4>Rodada ${round}</h4>${roundEncounters.map(e=>`<div class="duel-row"><span>${esc(teamName(e.teamAId))}</span><b>×</b><span>${esc(teamName(e.teamBId))}</span><small>${e.status==='completed'?'Concluído':e.status==='active'?'Em andamento':'Pendente'}</small></div>`).join('')}${resting.map(t=>`<div class="bye-row">Descanso nesta rodada: <b>${esc(t.nameSnapshot)}</b></div>`).join('')}</div>`;}).join('');
  return `<section class="intro"><div><small>${esc(game.disciplineSnapshot?.name||'Disciplina')} · ${new Date(game.createdAt).toLocaleDateString('pt-BR')}</small><h2>${esc(game.name)}</h2><p>Gerencie a agenda, acompanhe o progresso e avance as atividades.</p></div><a class="secondary" href="/admin/games">← Voltar</a></section>
  <section class="game-summary"><div><small>SITUAÇÃO</small><strong>${statusText[game.status]||game.status}</strong></div><div><small>EQUIPES</small><strong>${teams.length}</strong></div><div><small>PROGRESSO</small><strong>${activities.length?completed+'/'+activities.length:'—'}</strong></div><div><small>TEMPO PADRÃO</small><strong>${Math.round(game.config.defaultTimeSeconds/60)} min</strong></div></section>
  ${game.status==='draft'?`<div class="notice">ⓘ　Confira a composição das equipes e a tabela de confrontos antes de iniciar. Ao iniciar, a agenda será criada e a configuração ficará bloqueada.</div>`:''}
  ${game.status==='draft'?`<section class="form-panel"><div class="section-heading"><div><h3>Agenda de confrontos</h3><p class="muted">${game.config.duelResponseMode==='first'?'Resposta única: dois ciclos de duelos para ampliar oportunidades.':'Ambas respondem: um ciclo de duelos sem repetição.'}</p></div><span class="status">${encounters.length} CONFRONTOS</span></div>${rounds||'<p class="muted">Confrontos desabilitados nesta partida.</p>'}</section>`:''}
  ${game.status==='draft'?`<section class="form-panel"><h3>Equipes participantes</h3><div class="team-snapshot-grid">${teams.map(t=>`<article><small>${esc(t.themeSnapshot||'Sem tema')}</small><b>${esc(t.nameSnapshot)}</b><span>${t.membersSnapshot.length} integrante(s)</span></article>`).join('')}</div></section><div class="form-actions"><a class="secondary" href="/admin/games">Voltar</a><button class="primary" id="start-game">Iniciar partida</button></div>`:''}
  ${game.status!=='draft'?`<section class="form-panel"><div class="section-heading"><div><h3>Sequência de atividades</h3><p class="muted">Uma atividade por vez. O encerramento é controlado pelo professor.</p></div><span class="status">${completed} / ${activities.length} CONCLUÍDAS</span></div><div class="progress-track"><span style="width:${activities.length?completed/activities.length*100:0}%"></span></div>${queue||'<div class="empty"><h3>Nenhuma atividade na agenda</h3></div>'}${game.status==='completed'?'<div class="notice">Partida concluída. Abra /presentation para projetar a classificação e as notas.</div>':''}</section>`:''}`;
}



function downloadHistoryFile(filename,content,mime){
 const blob=new Blob([content],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function csvHistory(rows){return '\ufeff'+rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';')).join('\r\n');}
function historyDate(date){if(!date)return '—';const d=new Date(date);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR');}
function historyLabel(t){return {extra:'Tempo extra',hint:'Dica',swap:'Troca',duel:'Duelo'}[t]||t;}
async function renderHistoryList(container,db,games,disciplines,gameTeams){
 const ordered=[...games].sort((a,b)=>String(b.completedAt||b.updatedAt||b.createdAt||'').localeCompare(String(a.completedAt||a.updatedAt||a.createdAt||'')));
 container.innerHTML=`<section class="intro"><div><small>REGISTROS PERMANENTES</small><h2>Histórico de partidas</h2><p>Consulte partidas concluídas ou em andamento, com seus resultados e atividades.</p></div></section><div class="history-toolbar"><label>Pesquisar partida<input id="history-search" placeholder="Nome da partida ou disciplina"></label><label>Situação<select id="history-status"><option value="">Todas</option><option value="completed">Concluídas</option><option value="in_progress">Em andamento</option><option value="draft">Rascunhos</option></select></label></div><div id="history-items"></div>`;
 const draw=()=>{const search=container.querySelector('#history-search').value.trim().toLocaleLowerCase('pt-BR'),status=container.querySelector('#history-status').value;
 const found=ordered.filter(g=>(!status||g.status===status)&&(!search||(g.name+' '+(disciplines.find(d=>d.id===g.disciplineId)?.name||'')).toLocaleLowerCase('pt-BR').includes(search)));
 container.querySelector('#history-items').innerHTML=found.length?`<section class="cards">${found.map(g=>`<article class="card"><small>${esc(g.status==='completed'?'CONCLUÍDA':g.status==='in_progress'?'EM ANDAMENTO':'RASCUNHO')}</small><h3>${esc(g.name)}</h3><p>${esc(disciplines.find(d=>d.id===g.disciplineId)?.name||'Disciplina não encontrada')}</p><p>${gameTeams.filter(t=>t.gameId===g.id).length} equipes · ${historyDate(g.completedAt||g.createdAt)}</p><div class="actions"><a class="primary" href="/admin/history/${encodeURIComponent(g.id)}">Ver relatório</a><a class="secondary" href="/admin/games/${encodeURIComponent(g.id)}">Abrir partida</a></div></article>`).join('')}</section>`:'<div class="empty"><h3>Nenhuma partida encontrada</h3></div>';};
 container.querySelector('#history-search').oninput=draw;container.querySelector('#history-status').onchange=draw;draw();
}
async function renderHistoryDetail(container,db,gameId){
 const stores=['games','gameTeams','activities','encounters','responses','cardUsages','academicScores','competitionScores'];
 const [games,allTeams,allActivities,allEncounters,allResponses,allCards,allAcademic,allCompetitive]=await Promise.all(stores.map(x=>db.all(x)));
 const game=games.find(g=>g.id===gameId);
 if(!game){container.innerHTML='<div class="empty"><h3>Partida não encontrada</h3><a href="/admin/history">Voltar ao histórico</a></div>';return;}
 const teams=allTeams.filter(t=>t.gameId===gameId),activities=allActivities.filter(a=>a.gameId===gameId).sort((a,b)=>a.order-b.order),encounters=allEncounters.filter(e=>e.gameId===gameId),responses=allResponses.filter(r=>r.gameId===gameId),cards=allCards.filter(c=>c.gameId===gameId),academicAdjustments=allAcademic.filter(x=>x.gameId===gameId),competitionAdjustments=allCompetitive.filter(x=>x.gameId===gameId);
 const teamName=id=>teams.find(t=>t.id===id)?.nameSnapshot||'Equipe não identificada';
 const ranked=teams.map(t=>({...t,score:scoreForTeam(gameId,t.id,responses,academicAdjustments,competitionAdjustments)})).sort((a,b)=>b.score.competitive-a.score.competitive||b.score.academic-a.score.academic||a.nameSnapshot.localeCompare(b.nameSnapshot,'pt-BR'));
 const answerRows=activities.flatMap(a=>responses.filter(r=>r.activityId===a.id).map(r=>({activity:a,team:teamName(r.gameTeamId),response:r})));
 const rows=ranked.map((t,i)=>[i+1,t.nameSnapshot,t.score.academic,t.score.competitive,Math.max(0,10-t.score.academic)]);
 const table=(headers,values)=>`<div class="history-scroll"><table class="history-table"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${values.map(row=>`<tr>${row.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
 container.innerHTML=`<section class="intro"><div><small>RELATÓRIO DA PARTIDA</small><h2>${esc(game.name)}</h2><p>${esc(game.status==='completed'?'Concluída':game.status==='in_progress'?'Em andamento':'Rascunho')} · Criada em ${historyDate(game.createdAt)} · ${teams.length} equipes</p></div><a class="secondary" href="/admin/history">← Histórico</a></section><div class="actions"><button id="history-export-pdf" class="primary">Baixar relatório PDF</button><button id="history-export-csv" class="secondary">Exportar notas CSV</button><button id="history-export-json" class="secondary">Exportar relatório JSON</button></div>
 <section class="form-panel"><h3>Classificação e notas</h3><p class="muted">Ranking por pontuação competitiva; notas acadêmicas limitadas a 10.</p>${table(['Posição','Equipe','Nota / 10','Competição','Falta para 10'],rows)}</section>
 <section class="form-panel"><h3>Atividades (${activities.length})</h3>${table(['Ordem','Atividade','Modalidade','Situação','Participantes','Conclusão'],activities.map(a=>[a.order,a.titleSnapshot||a.activityTypeId,a.activityTypeId,a.status,(a.participants||[]).map(teamName).join(', '),historyDate(a.completedAt)]))}</section>
 <section class="form-panel"><h3>Respostas registradas (${answerRows.length})</h3>${answerRows.length?table(['Atividade','Equipe','Questão','Resposta','Gabarito','Resultado','Nota','Competição'],answerRows.map(({activity:a,team,response:r})=>[a.titleSnapshot||a.activityTypeId,team,a.questionSnapshot?.statement||'—',r.answer,a.questionSnapshot?.answer||'—',r.correct?'Correta':'Incorreta',r.academicPoints||0,r.competitionPoints||0])):'<p class="muted">Nenhuma resposta registrada.</p>'}</section>
 <section class="form-panel"><h3>Confrontos (${encounters.length})</h3>${encounters.length?table(['Rodada','Equipe A','Equipe B','Situação'],encounters.sort((a,b)=>a.round-b.round).map(e=>[e.round,teamName(e.teamAId),teamName(e.teamBId),e.status||'—'])):'<p class="muted">Nenhum confronto cadastrado.</p>'}</section>
 <section class="form-panel"><h3>Cartas utilizadas (${cards.length})</h3>${cards.length?table(['Equipe','Carta','Detalhes','Utilização'],cards.map(c=>[teamName(c.gameTeamId),historyLabel(c.cardType),c.detail||'—',historyDate(c.usedAt)])):'<p class="muted">Nenhuma carta utilizada.</p>'}</section>
 <section class="form-panel"><h3>Ajustes manuais</h3>${academicAdjustments.length+competitionAdjustments.length?table(['Equipe','Categoria','Pontos','Justificativa','Data'],[...academicAdjustments.map(x=>({...x,category:'Acadêmica'})),...competitionAdjustments.map(x=>({...x,category:'Competitiva'}))].map(x=>[teamName(x.gameTeamId),x.category,x.points,x.reason||'—',historyDate(x.createdAt)])):'<p class="muted">Nenhum ajuste manual.</p>'}</section>`;
 const base='class-arena-'+game.id.slice(0,8);
 container.querySelector('#history-export-pdf').onclick=async()=>{try{await exportGamePdf({game,teams,activities,encounters,responses,cards,academicAdjustments,competitionAdjustments,ranked,teamName});}catch(err){console.error(err);alert('Falha ao gerar PDF: '+err.message);}};
 container.querySelector('#history-export-csv').onclick=()=>downloadHistoryFile(base+'-notas.csv',csvHistory([['Posição','Equipe','Nota acadêmica','Pontos competitivos','Falta para 10'],...rows]),'text/csv;charset=utf-8');
 container.querySelector('#history-export-json').onclick=()=>downloadHistoryFile(base+'-relatorio.json',JSON.stringify({format:'class-arena-history',version:1,exportedAt:new Date().toISOString(),game,teams,activities,encounters,responses,cards,academicAdjustments,competitionAdjustments,ranking:ranked.map(t=>({teamId:t.id,name:t.nameSnapshot,...t.score}))},null,2),'application/json;charset=utf-8');
}
async function exportGamePdf({game,teams,activities,encounters,responses,cards,academicAdjustments,competitionAdjustments,ranked,teamName}){
 const {jsPDF}=await import('jspdf');
 const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
 // A mesma logo institucional utilizada no painel é incorporada ao PDF.
 let adsLogo=null;
 try{
  const response=await fetch('/assets/logo-ads.png');
  if(!response.ok)throw new Error('Logo não encontrada');
  const blob=await response.blob();
  adsLogo=await new Promise((resolve,reject)=>{
   const image=new Image();const url=URL.createObjectURL(blob);
   image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext('2d').drawImage(image,0,0);URL.revokeObjectURL(url);resolve(canvas.toDataURL('image/png'));};
   image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Falha ao ler a logo'));};image.src=url;
  });
 }catch(error){console.warn('Logo indisponível para o PDF:',error);}
 
 const W=210,H=297,L=17,R=193,usable=R-L;
 const green=[28,104,65],dark=[26,40,49],gray=[99,111,119];
 let page=1,y=0;
 const txt=(v)=>String(v??'—');
 const labelDate=v=>historyDate(v);
 const title=(t)=>{doc.setFont('helvetica','bold');doc.setFontSize(13);doc.setTextColor(...dark);doc.text(t,L,y);y+=9;};
 const line=()=>{doc.setDrawColor(215,224,218);doc.line(L,y,R,y);y+=6;};
 const footer=()=>{doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...gray);doc.text('CLASS ARENA  |  Relatório da partida',L,287);doc.text(String(page),R,287,{align:'right'});};
 const pageHeader=()=>{
  doc.setFillColor(...green);doc.rect(0,0,W,35,'F');
  if(adsLogo)doc.addImage(adsLogo,'PNG',L,5,24,24);
  doc.setFont('helvetica','bold');doc.setFontSize(13);doc.setTextColor(255,255,255);
  doc.text('ANÁLISE E DESENVOLVIMENTO DE SISTEMAS',adsLogo?L+29:L,15);
  doc.setFont('helvetica','normal');doc.setFontSize(9);
  doc.text('CLASS ARENA  |  RELATÓRIO DA PARTIDA',adsLogo?L+29:L,23);
 };
 const next=()=>{footer();doc.addPage();page++;pageHeader();y=45;};
 const ensure=h=>{if(y+h>277)next();};
 const para=(t,indent=0)=>{doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(...dark);const lines=doc.splitTextToSize(txt(t),usable-indent);ensure(lines.length*4.6+4);doc.text(lines,L+indent,y);y+=lines.length*4.6+4;};
 const row=(cells,widths,head=false)=>{
  doc.setFont('helvetica',head?'bold':'normal');doc.setFontSize(head?9:8.7);
  const cols=cells.map((v,i)=>doc.splitTextToSize(txt(v),widths[i]-4));
  const h=Math.max(9,...cols.map(a=>a.length*4.2+4));ensure(h);
  if(head){doc.setFillColor(231,241,233);doc.rect(L,y-5,usable,h,'F');}
  let x=L;cols.forEach((a,i)=>{doc.setTextColor(...dark);doc.text(a,x+2,y);x+=widths[i];});
  doc.setDrawColor(230,234,231);doc.line(L,y+h-5,R,y+h-5);y+=h;
 };
 const section=(heading,headers,widths,items)=>{
  ensure(23);title(heading);row(headers,widths,true);
  if(!items.length)para('Nenhum registro.');else items.forEach(r=>row(r,widths));
  y+=7;
 };
 // First page: executive ranking, always fully contained for up to six teams.
 pageHeader();
 y=48;title(txt(game.name));
 para('Disciplina: '+txt(game.disciplineSnapshot?.name||game.disciplineId));
 para('Situação: '+(game.status==='completed'?'Concluída':game.status==='in_progress'?'Em andamento':'Rascunho')+'   |   Criada em: '+labelDate(game.createdAt));
 para('Equipes: '+teams.length+'   |   Atividades: '+activities.length+'   |   Concluídas: '+activities.filter(a=>a.status==='completed').length);
 y+=6;title('Classificação geral');
 para('Ranking competitivo; nota acadêmica apresentada separadamente, com máximo de 10.');
 section('Resultado por equipe',['Pos.','Equipe','Competição','Nota / 10'],[18,91,37,30],ranked.map((t,i)=>[String(i+1)+'º',t.nameSnapshot,String(t.score.competitive)+' pts',t.score.academic.toFixed(1).replace('.',',')]));
 y+=6;line();para('Critério de classificação: maior pontuação competitiva, seguida da nota acadêmica e do nome da equipe.');
 para('Este relatório reflete os dados registrados no CLASS ARENA na data de sua geração.');
 // Page 2 onwards: details
 next();title('Detalhamento da partida');
 section('Atividades',['#','Atividade','Situação'],[13,117,46],activities.map(a=>[a.order,a.titleSnapshot||a.activityTypeId,a.status]));
 section('Respostas por equipe',['Atividade','Equipe','Resposta / Resultado'],[55,48,73],activities.flatMap(a=>responses.filter(r=>r.activityId===a.id).map(r=>[a.titleSnapshot||a.activityTypeId,teamName(r.gameTeamId),txt(r.answer)+' | '+(r.correct?'Correta':'Incorreta')])));
 section('Confrontos',['Rod.','Equipe A','Equipe B','Situação'],[20,58,58,40],encounters.map(e=>[e.round,teamName(e.teamAId),teamName(e.teamBId),e.status]));
 section('Cartas utilizadas',['Equipe','Carta','Detalhes'],[52,35,89],cards.map(c=>[teamName(c.gameTeamId),historyLabel(c.cardType),c.detail||'—']));
 section('Ajustes de pontuação',['Equipe','Tipo','Pontos / Motivo'],[51,36,89],[...academicAdjustments.map(a=>({...a,kind:'Acadêmica'})),...competitionAdjustments.map(a=>({...a,kind:'Competitiva'}))].map(a=>[teamName(a.gameTeamId),a.kind,txt(a.points)+' | '+txt(a.reason)]));
 // Relação de integrantes encerra o documento, mantendo os nomes históricos da partida.
 ensure(35);title('Integrantes das equipes');
 for(const team of teams){
  const members=Array.isArray(team.membersSnapshot)?team.membersSnapshot:[];
  ensure(14);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(...dark);
  doc.text(txt(team.nameSnapshot),L,y);y+=6;
  if(members.length)members.forEach((member,i)=>para((i+1)+'. '+txt(member),4));
  else para('Nenhum integrante cadastrado.',4);
  y+=3;
 }
 footer();doc.save('class-arena-'+txt(game.id).slice(0,8)+'-relatorio.pdf');
}

function scoreForTeam(gameId,teamId,responses,academicAdjustments,competitionAdjustments){
 const rs=responses.filter(r=>r.gameId===gameId&&r.gameTeamId===teamId);
 const acadBase=rs.reduce((n,r)=>n+(Number(r.academicPoints)||0),0);
 const compBase=rs.reduce((n,r)=>n+(Number(r.competitionPoints)||0),0);
 const acadDelta=academicAdjustments.filter(x=>x.gameId===gameId&&x.gameTeamId===teamId).reduce((n,x)=>n+Number(x.points||0),0);
 const compDelta=competitionAdjustments.filter(x=>x.gameId===gameId&&x.gameTeamId===teamId).reduce((n,x)=>n+Number(x.points||0),0);
 return {academic:Math.max(0,Math.min(10,acadBase+acadDelta)),competitive:compBase+compDelta,academicBase:acadBase,competitiveBase:compBase};
}
async function renderScorePanel(root,db,game,teams,activities){
 if(game.status==='draft')return;
 const [responses,academicAdjustments,competitionAdjustments]=await Promise.all(['responses','academicScores','competitionScores'].map(s=>db.all(s)));
 const ranking=teams.map(t=>({...t,score:scoreForTeam(game.id,t.id,responses,academicAdjustments,competitionAdjustments)}))
 .sort((a,b)=>b.score.competitive-a.score.competitive||b.score.academic-a.score.academic||a.nameSnapshot.localeCompare(b.nameSnapshot,'pt-BR'));
 const panel=document.createElement('section');
 panel.className='form-panel';
 panel.innerHTML=`<div class="section-heading"><div><h3>Notas acadêmicas e ranking competitivo</h3><p class="muted">Notas de 0 a 10; confrontos pontuam somente no ranking. Ajustes são auditáveis e não alteram as respostas originais.</p></div><span class="status">AVALIAÇÃO</span></div>
 <div class="scoreboard-table"><table><thead><tr><th>Pos.</th><th>Equipe</th><th>Nota / 10</th><th>Pontos competitivos</th><th>Falta para 10</th></tr></thead><tbody>${ranking.map((t,i)=>`<tr><td>${i+1}º</td><td>${esc(t.nameSnapshot)}</td><td><b>${t.score.academic.toFixed(1).replace('.',',')}</b></td><td>${t.score.competitive}</td><td>${Math.max(0,10-t.score.academic).toFixed(1).replace('.',',')}</td></tr>`).join('')}</tbody></table></div>
 <h4>Ajuste manual de pontuação</h4><div class="score-adjust"><label>Equipe<select id="score-team">${teams.map(t=>`<option value="${esc(t.id)}">${esc(t.nameSnapshot)}</option>`).join('')}</select></label><label>Tipo<select id="score-kind"><option value="academic">Acadêmica</option><option value="competitive">Competitiva</option></select></label><label>Ajuste (+ ou −)<input type="number" id="score-delta" step="0.5" value="0.5"></label><label>Justificativa<input id="score-reason" maxlength="160" placeholder="Ex.: correção de resposta"></label><button class="secondary" id="score-save">Aplicar ajuste</button></div>
 <div class="actions"><button class="secondary" id="score-export">Exportar placar CSV</button>${!activities.some(a=>a.status==='active')?'<button class="primary" id="recovery-add">＋ Rodada de recuperação</button>':''}</div>
 <p class="muted">Recuperação: atividade coletiva de 1 ponto por resposta correta, limitada à nota 10. Apenas equipes abaixo de 10 participam. Uma rodada não garante a recuperação integral.</p>`;
 const container=root.querySelector('#content');container.appendChild(panel);
 panel.querySelector('#score-save').onclick=async()=>{
  const id=panel.querySelector('#score-team').value,kind=panel.querySelector('#score-kind').value,points=Number(panel.querySelector('#score-delta').value),reason=panel.querySelector('#score-reason').value.trim();
  if(!Number.isFinite(points)||points===0||Math.abs(points)>10||!reason)return alert('Informe um ajuste não nulo de até 10 pontos e uma justificativa.');
  const store=kind==='academic'?'academicScores':'competitionScores';
  await db.put(store,{id:uid(),gameId:game.id,gameTeamId:id,points,reason,createdAt:new Date().toISOString(),kind:'manual'});
  channel.postMessage({type:'score:updated',gameId:game.id});location.reload();
 };
 panel.querySelector('#score-export').onclick=()=>{
  const csv=[['Posição','Equipe','Nota acadêmica','Pontos competitivos'],...ranking.map((t,i)=>[i+1,t.nameSnapshot,t.score.academic,t.score.competitive])].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(';')).join('\r\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='class-arena-placar.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
 };
 const recovery=panel.querySelector('#recovery-add');
 if(recovery)recovery.onclick=async()=>{
  const eligible=ranking.filter(t=>t.score.academic<10-0.001);
  if(!eligible.length)return alert('Todas as equipes já alcançaram nota 10.');
  if(!await arenaConfirm(`Criar rodada de recuperação para ${eligible.length} equipe(s) abaixo de 10?`))return;
  const now=new Date().toISOString(),order=Math.max(0,...activities.map(a=>a.order))+1;
  const type=game.config.academicActivities.find(a=>a.activityTypeId)?.activityTypeId||'base-conversion';
  const activity={id:uid(),gameId:game.id,order,activityTypeId:type,titleSnapshot:`Recuperação acadêmica ${activities.filter(a=>a.recovery).length+1}`,responseType:'pending',scope:'collective',status:'pending',participants:eligible.map(t=>t.id),academicWeight:1,recovery:true,encounterId:null,questionSnapshot:null,createdAt:now};
  const tx=db.raw.transaction(['games','activities'],'readwrite');
  tx.objectStore('activities').put(activity);
  tx.objectStore('games').put({...game,status:'in_progress',completedAt:null,updatedAt:now});
  await done(tx);channel.postMessage({type:'recovery:created',gameId:game.id});location.reload();
 };
}

function bindGameDetail(root,db,game,teams,encounters,activities){
  const startButton=root.querySelector('#start-game');
  if(startButton) startButton.onclick=async()=>{
    if(!await arenaConfirm('Iniciar esta partida? A configuração e a agenda serão consideradas definitivas.')) return;
    const now=new Date().toISOString(),queue=[];let order=1;const activityTypes=await db.all('activityTypes');
    for(const item of game.config.academicActivities){
      queue.push({id:uid(),gameId:game.id,order:order++,activityTypeId:item.activityTypeId,titleSnapshot:item.name,responseType:activityTypes.find(t=>t.id===item.activityTypeId)?.responseType||'pending',scope:'collective',status:'pending',participants:teams.map(t=>t.id),academicWeight:item.weight,encounterId:null,questionSnapshot:null,createdAt:now});
    }
    const sortedRounds=[...new Set(encounters.map(e=>e.round))].sort((a,b)=>a-b);
    for(const round of sortedRounds){
      for(const encounter of encounters.filter(e=>e.round===round)){
        const activity={id:uid(),gameId:game.id,order:order++,activityTypeId:'team-encounter',titleSnapshot:`Confronto · Rodada ${round}`,responseType:'pending',scope:'confrontation',status:'pending',participants:[encounter.teamAId,encounter.teamBId],academicWeight:0,encounterId:encounter.id,questionSnapshot:null,createdAt:now};
        encounter.activityId=activity.id;queue.push(activity);
      }
    }
    if(game.config.adsChallengeEnabled) queue.push({id:uid(),gameId:game.id,order:order++,activityTypeId:'ads-challenge',titleSnapshot:'ADS Challenge',responseType:'special',scope:'special',status:'pending',participants:teams.map(t=>t.id),academicWeight:0,encounterId:null,questionSnapshot:null,createdAt:now});
    const tx=db.raw.transaction(['games','activities','encounters'],'readwrite');
    tx.objectStore('games').put({...game,status:'in_progress',startedAt:now,updatedAt:now,activityCount:queue.length});
    queue.forEach(a=>tx.objectStore('activities').put(a));
    encounters.forEach(e=>tx.objectStore('encounters').put({...e,status:'pending'}));
    try{await done(tx);channel.postMessage({type:'game:started',gameId:game.id});await refresh(root,db);}catch(err){console.error(err);alert('Não foi possível iniciar a partida. Consulte o console.');}
  };
  root.querySelectorAll('[data-start-activity]').forEach(button=>button.onclick=async()=>{
    const activity=activities.find(a=>a.id===button.dataset.startActivity);
    if(!activity||game.status!=='in_progress'||activities.some(a=>a.status==='active')) return;
    // Consultas assíncronas devem ocorrer ANTES da abertura da transação IndexedDB.
    const question=activity.questionSnapshot||await pickQuestion(db,game,activity,activities)||sampleQuestions[activity.activityTypeId]||null;
    const now=new Date().toISOString(),tx=db.raw.transaction(['activities','encounters'],'readwrite');
    tx.objectStore('activities').put({...activity,status:'active',startedAt:now,updatedAt:now,timer:{durationSeconds:game.config.defaultTimeSeconds,remainingSeconds:game.config.defaultTimeSeconds,running:true,startedAt:now},questionSnapshot:question});
    if(activity.encounterId){const encounter=encounters.find(e=>e.id===activity.encounterId);if(encounter)tx.objectStore('encounters').put({...encounter,status:'active'});}
    try { await done(tx);channel.postMessage({type:'activity:started',gameId:game.id,activityId:activity.id});location.href=`/admin/games/${game.id}/arena`; } catch(err) { console.error(err);alert('Falha ao iniciar atividade: '+err.message); }
  });
  root.querySelectorAll('[data-complete-activity]').forEach(button=>button.onclick=async()=>{
    const activity=activities.find(a=>a.id===button.dataset.completeActivity);
    if(!activity||activity.status!=='active')return;
    if(!await arenaConfirm('Encerrar esta atividade e avançar na sequência?'))return;
    const now=new Date().toISOString(),tx=db.raw.transaction(['activities','encounters','games'],'readwrite');
    tx.objectStore('activities').put({...activity,status:'completed',completedAt:now,updatedAt:now});
    if(activity.encounterId){const encounter=encounters.find(e=>e.id===activity.encounterId);if(encounter)tx.objectStore('encounters').put({...encounter,status:'completed',completedAt:now});}
    const remaining=activities.filter(a=>a.id!==activity.id&&a.status!=='completed');
    if(remaining.length===0){tx.objectStore('games').put({...game,status:'completed',completedAt:now,updatedAt:now});}
    await done(tx);channel.postMessage({type:'activity:completed',gameId:game.id,activityId:activity.id});await refresh(root,db);
  });
}

function roundRobin(snapshots,gameId,createdAt,cycles=1){const list=snapshots.map(t=>t.id);if(list.length%2)list.push(null);const fixed=list[0],rot=list.slice(1),result=[];for(let r=0;r<list.length-1;r++){const line=[fixed,...rot];for(let i=0;i<line.length/2;i++){const a=line[i],b=line[line.length-1-i];if(a&&b)result.push({id:uid(),gameId,round:r+1,teamAId:a,teamBId:b,status:'pending',activityId:null,createdAt});}rot.unshift(rot.pop());}if(cycles>1){const first=result.map(x=>({...x}));const maxRound=Math.max(...first.map(x=>x.round));for(let cycle=1;cycle<cycles;cycle++){for(const e of first)result.push({...e,id:uid(),round:e.round+cycle*maxRound,teamAId:cycle%2?e.teamBId:e.teamAId,teamBId:cycle%2?e.teamAId:e.teamBId,activityId:null,cycle:cycle+1});}}return result;}


const fmtTime = seconds => {const n=Math.max(0,Math.ceil(seconds));return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;};
function teamTimeLeft(activity,teamId){
 const base=timeLeft(activity?.timer);
 const bonus=Number(activity?.teamExtraSeconds?.[teamId]||0);
 return Math.max(0,base+bonus);
}
function timeLeft(timer){if(!timer)return 0;return Math.max(0,(timer.remainingSeconds??timer.durationSeconds??0)-(timer.running&&timer.startedAt?(Date.now()-new Date(timer.startedAt).getTime())/1000:0));}
const sampleQuestions = {
 'base-conversion':{statement:'Converta o número binário 101101 para decimal.',options:['43','45','47','49'],answer:'B'},
 'word-decoding':{statement:'Decodifique a palavra ASCII: 01010011 01001111 01001100',options:[],answer:'SOL'},
 'base-operation':{statement:'Qual é o resultado de 1010₂ + 0011₂ em binário?',options:['1011','1101','1110','1001'],answer:'B'},
 'phrase-decoding':{statement:'Decodifique a frase ASCII: 01001111 01001001 00100000 01010100 01010101 01010010 01001101 01000001',options:[],answer:'OI TURMA'},
 'special-challenge':{statement:'Qual é a representação hexadecimal do número decimal 255?',options:['EF','FF','F0','FE'],answer:'B'},
 'team-encounter':{statement:'Quanto vale 1111₂ em decimal?',options:['14','15','16','17'],answer:'B'},
 'ads-challenge':{statement:'Qual estrutura de dados segue a regra FIFO?',options:['Pilha','Fila','Árvore binária','Grafo'],answer:'B'},
 'ads-challenge-2':{statement:'Qual componente armazena temporariamente dados em execução?',options:['SSD','RAM','Fonte de alimentação','Monitor'],answer:'B'},
 'ads-challenge-3':{statement:'Em programação, o que significa FIFO?',options:['Primeiro a entrar, primeiro a sair','Último a entrar, primeiro a sair','Primeiro a entrar, último a sair','Ordenação aleatória'],answer:'A'}
};
const normalizeAnswer = s => String(s??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ');
async function arena(root,db,gameId){
 const game=(await db.all('games')).find(g=>g.id===gameId);
 if(!game){root.innerHTML='<p>Partida não encontrada. <a href="/admin/games">Voltar</a></p>';return;}
 const activities=(await db.all('activities')).filter(a=>a.gameId===gameId).sort((a,b)=>a.order-b.order);
 const active=activities.find(a=>a.status==='active');
 const teams=(await db.all('gameTeams')).filter(t=>t.gameId===gameId);
 const responses=active?(await db.all('responses')).filter(r=>r.activityId===active.id):[];
 const bankQuestions=active?(await db.all('questions')).filter(q=>q.disciplineId===game.disciplineId&&q.active!==false&&(!q.activityTypeId||q.activityTypeId===active.activityTypeId||active.scope==='confrontation'||active.scope==='special')):[];
 const cardUsages=active?(await db.all('cardUsages')).filter(c=>c.gameId===gameId):[];
 const singleResponse=active?.scope==='confrontation'&&game.config.duelResponseMode==='first';
 const lockedTeam=singleResponse&&responses.length?responses[0].gameTeamId:null;
 const allGameResponses=(await db.all('responses')).filter(r=>r.gameId===gameId);
 const [academicAdjustments,competitionAdjustments]=await Promise.all([db.all('academicScores'),db.all('competitionScores')]);
 const competitionPoints=id=>allGameResponses.filter(r=>r.gameTeamId===id).reduce((n,r)=>n+(Number(r.competitionPoints)||0),0)+competitionAdjustments.filter(x=>x.gameId===gameId&&x.gameTeamId===id).reduce((n,x)=>n+Number(x.points||0),0);
 const academicPoints=id=>Math.max(0,Math.min(10,allGameResponses.filter(r=>r.gameTeamId===id).reduce((n,r)=>n+(Number(r.academicPoints)||0),0)+academicAdjustments.filter(x=>x.gameId===gameId&&x.gameTeamId===id).reduce((n,x)=>n+Number(x.points||0),0)));
 root.innerHTML=`<div class="arena-admin"><header class="arena-top"><div><a href="/admin/games/${gameId}">← Voltar à partida</a><h1>${esc(game.name)} <small>· Arena do professor</small></h1></div><a class="primary" href="/presentation" target="_blank" rel="noopener">Abrir projeção ↗</a></header>${active?`<section class="arena-grid"><div class="arena-editor"><div class="arena-panel"><small>ATIVIDADE ${active.order} / ${activities.length} · ${esc(active.titleSnapshot)}</small><h2>Questão apresentada</h2><label>Selecionar do banco<select id="bank-question"><option value="">— Escolha uma questão cadastrada —</option>${bankQuestions.map(q=>`<option value="${esc(q.id)}">${esc(q.statement.slice(0,100))}</option>`).join('')}</select></label><button class="secondary" id="load-bank-question">Carregar questão</button><label>Enunciado<textarea id="question-text" rows="3">${esc(active.questionSnapshot?.statement??sampleQuestions[active.activityTypeId]?.statement??'')}</textarea></label><label>Alternativas (uma por linha, deixe vazio para resposta aberta)<textarea id="question-options" rows="4">${esc((active.questionSnapshot?.options??sampleQuestions[active.activityTypeId]?.options??[]).join('\n'))}</textarea></label><label>Gabarito (A, B, C, D... ou texto da resposta)<input id="question-answer" value="${esc(active.questionSnapshot?.answer??sampleQuestions[active.activityTypeId]?.answer??'')}"></label><button class="primary" id="save-question">Salvar e projetar questão</button><p class="muted">Questões de demonstração podem ser substituídas antes de responder. O gabarito nunca aparece no projetor.</p></div><div class="arena-panel"><h2>Respostas e avaliação</h2><p class="muted">Registre manualmente a resposta apresentada por cada equipe. Confrontos e ADS Challenge: cada acerto rende 1 ponto competitivo. A nota acadêmica (máximo 10) é independente.</p>${singleResponse?`<div class="notice">⚡ Resposta única: ${lockedTeam?`direito de resposta utilizado por ${esc(teams.find(t=>t.id===lockedTeam)?.nameSnapshot||'Equipe')}.`:'a primeira resposta registrada bloqueia a outra equipe, mesmo se incorreta.'}</div>`:''}<div class="answer-grid">${active.participants.map(id=>{const t=teams.find(x=>x.id===id),r=responses.find(x=>x.gameTeamId===id);return `<div class="answer-row"><strong>${esc(t?.nameSnapshot??'Equipe')}</strong><small>Acadêmica: ${academicPoints(id).toLocaleString('pt-BR')}/10 · Competitiva: ${competitionPoints(id)}</small><input ${lockedTeam&&lockedTeam!==id?'disabled':''} data-answer="${id}" placeholder="Resposta" value="${esc(r?.answer??'')}"><button ${lockedTeam&&lockedTeam!==id?'disabled title="Resposta encerrada"':''} data-save-answer="${id}" class="secondary">Registrar</button><small>${r?(r.correct?'✓ Correta':'✕ Incorreta'):'Pendente'}<span class="team-time" data-team-time="${id}">${fmtTime(teamTimeLeft(active,id))}</span></small></div>`}).join('')}</div></div></div><aside class="arena-controls"><div class="arena-panel"><small>CRONÔMETRO</small><div class="big-timer" id="admin-timer">${fmtTime(timeLeft(active.timer))}</div><div class="control-row"><button class="primary" id="timer-toggle">${active.timer?.running?'Pausar':'Iniciar / Retomar'}</button><button class="secondary" id="timer-reset">Reiniciar</button></div><div class="control-row"><button class="secondary" id="timer-extra">+15 segundos</button></div><p class="muted">Ao zerar, a atividade permanece aberta até o encerramento manual.</p></div><div class="arena-panel"><h2>Cartas especiais</h2><p class="muted">Uma utilização por tipo de carta e por equipe na partida. A ativação é feita pelo professor.</p><label>Equipe<select id="card-team">${active.participants.map(id=>`<option value="${esc(id)}">${esc(teams.find(t=>t.id===id)?.nameSnapshot||'Equipe')}</option>`).join('')}</select></label><div class="control-row"><button class="secondary" data-card="extra">⏱ Tempo extra</button><button class="secondary" data-card="hint">💡 Dica</button></div><div class="control-row"><button class="secondary" data-card="swap">⇄ Troca</button><button class="secondary" data-card="duel">⚔ Duelo</button></div><p id="card-feedback" class="muted">Tempo extra: +15 segundos somente para a equipe escolhida. Dica: revela a dica cadastrada ao professor. Troca: registra somente o uso da carta (troca presencial). Duelo: cria uma atividade bônus entre duas equipes.</p><div class="card-history"><small>Cartas utilizadas nesta partida</small>${cardUsages.length?cardUsages.map(c=>`<p><b>${esc(teams.find(t=>t.id===c.gameTeamId)?.nameSnapshot||'Equipe')}</b> · ${esc({extra:'Tempo extra',hint:'Dica',swap:'Troca',duel:'Duelo'}[c.cardType]||c.cardType)}${c.detail?' · '+esc(c.detail):''}</p>`).join(''):'<p>Nenhuma carta utilizada.</p>'}</div></div><div class="arena-panel"><h2>Participantes</h2>${active.participants.map(id=>`<p>${esc(teams.find(t=>t.id===id)?.nameSnapshot??'Equipe')}</p>`).join('')}<button class="danger" id="finish-activity">Encerrar atividade</button></div></aside></section>`:`<section class="arena-panel"><h2>${game.status==='completed'?'Partida concluída':'Nenhuma atividade em execução'}</h2><p>Volte à partida para iniciar a próxima atividade.</p><a class="primary" href="/admin/games/${gameId}">Ver sequência de atividades</a></section>`}</div>`;
 if(!active)return;
 const update=async patch=>{const latest=(await db.all('activities')).find(a=>a.id===active.id);if(!latest||latest.status!=='active')return;await db.put('activities',{...latest,...patch,updatedAt:new Date().toISOString()});channel.postMessage({type:'arena:updated',gameId});};
 root.querySelector('#load-bank-question').onclick=async()=>{const q=bankQuestions.find(x=>x.id===root.querySelector('#bank-question').value);if(!q)return alert('Selecione uma questão.');if(responses.length)return alert('Não é possível substituir a questão depois do registro de respostas.');await update({questionSnapshot:{statement:q.statement,options:q.options||[],answer:q.answer,sourceQuestionId:q.id}});await arena(root,db,gameId);};
 root.querySelector('#save-question').onclick=async()=>{const statement=root.querySelector('#question-text').value.trim(),options=root.querySelector('#question-options').value.split('\n').map(x=>x.trim()).filter(Boolean),answer=root.querySelector('#question-answer').value.trim();if(!statement||!answer){alert('Preencha enunciado e gabarito.');return;}if(responses.length&&!await arenaConfirm('Já existem respostas. Alterar o gabarito não reavaliará os registros anteriores. Continuar?'))return;await update({questionSnapshot:{statement,options,answer}});alert('Questão salva e enviada à projeção.');};
 const timerUpdate=async action=>{const latest=(await db.all('activities')).find(a=>a.id===active.id);const old=latest.timer||{durationSeconds:game.config.defaultTimeSeconds,remainingSeconds:game.config.defaultTimeSeconds,running:false,startedAt:null};const remaining=timeLeft(old);let timer;
 if(action==='toggle')timer=old.running?{...old,remainingSeconds:remaining,running:false,startedAt:null}:{...old,remainingSeconds:remaining,running:true,startedAt:new Date().toISOString()};
 if(action==='reset')timer={durationSeconds:game.config.defaultTimeSeconds,remainingSeconds:game.config.defaultTimeSeconds,running:false,startedAt:null};
 if(action==='extra')timer={...old,remainingSeconds:remaining+15,startedAt:old.running?new Date().toISOString():null};
 await update({timer});root.querySelector('#timer-toggle').textContent=timer.running?'Pausar':'Iniciar / Retomar';};
 root.querySelectorAll('[data-card]').forEach(button=>button.onclick=async()=>{
   const type=button.dataset.card,teamId=root.querySelector('#card-team').value;
   const selectedTeam=teams.find(t=>t.id===teamId);
   const teamLabel=selectedTeam?.nameSnapshot||'Equipe selecionada';
   const prior=(await db.all('cardUsages')).find(c=>c.gameId===gameId&&c.gameTeamId===teamId&&c.cardType===type);
   if(prior)return alert(`A equipe ${teamLabel} já utilizou essa carta nesta partida.`);
   const latest=(await db.all('activities')).find(a=>a.id===active.id);
   if(!latest||latest.status!=='active')return alert('Atividade não está ativa.');
   let detail='',patch=null,bonusRivalId=null;
   if(type==='extra'){
     if(!await arenaConfirm(`Conceder 15 segundos adicionais para a equipe ${teamLabel}? O cronômetro geral não será alterado.`))return;
     const extra={...(latest.teamExtraSeconds||{})};
     extra[teamId]=(Number(extra[teamId])||0)+15;
     patch={teamExtraSeconds:extra};
     detail='+15 segundos individuais';
   }else if(type==='hint'){
     const q=latest.questionSnapshot||{};
     const bank=q.sourceQuestionId?(await db.all('questions')).find(x=>x.id===q.sourceQuestionId):null;
     const hint=bank?.hint||q.hint||'';
     if(!hint)return alert('Esta questão não possui dica cadastrada. Escolha outra questão ou cadastre uma dica no banco.');
     if(!await arenaConfirm(`Revelar a dica ao professor e registrar o uso da carta Dica pela equipe ${teamLabel}?`))return;
     detail=hint;
   }else if(type==='swap'){
     if(!await arenaConfirm(`Marcar a carta Troca como utilizada pela equipe ${teamLabel}? A substituição de participantes será realizada presencialmente.`))return;
     detail='Utilizada (troca realizada presencialmente)';
   }else if(type==='duel'){
     const rivals=teams.filter(t=>t.id!==teamId);
     if(!rivals.length)return alert('É necessária outra equipe para o duelo.');
     const choices=rivals.map((t,i)=>`${i+1} - ${t.nameSnapshot}`).join('\n');
     const selected=Number(prompt('Escolha o número da equipe adversária:\n'+choices));
     if(!Number.isInteger(selected)||selected<1||selected>rivals.length)return;
     const rival=rivals[selected-1];
     if(!await arenaConfirm(`A equipe ${teamLabel} utilizará a carta Duelo contra ${rival.nameSnapshot}. Confirmar? A atividade atual continuará aberta.`))return;
     detail=`Duelo bônus contra ${rival.nameSnapshot}`;
     bonusRivalId=rival.id;
   }
   const usage={id:uid(),gameId,activityId:active.id,gameTeamId:teamId,cardType:type,detail,usedAt:new Date().toISOString()};
   // Registra efeito e consumo em uma transação, evitando duplicações em caso de falha.
   let bonusActivity=null;
   if(type==='duel'&&bonusRivalId){
     const allActivities=(await db.all('activities')).filter(a=>a.gameId===gameId);
     const nextOrder=Math.max(0,...allActivities.map(a=>a.order||0))+1;
     bonusActivity={id:uid(),gameId,order:nextOrder,activityTypeId:'team-encounter',
       titleSnapshot:'Duelo bônus · Carta especial',responseType:'pending',scope:'confrontation',
       status:'pending',participants:[teamId,bonusRivalId],academicWeight:0,encounterId:null,
       questionSnapshot:null,bonusDuel:true,createdAt:new Date().toISOString()};
   }
   const tx=db.raw.transaction((patch||bonusActivity)?['cardUsages','activities']:['cardUsages'],'readwrite');
   tx.objectStore('cardUsages').put(usage);
   if(patch)tx.objectStore('activities').put({...latest,...patch,updatedAt:new Date().toISOString()});
   if(bonusActivity)tx.objectStore('activities').put(bonusActivity);
   try{await done(tx);channel.postMessage({type:'card:used',gameId});await arena(root,db,gameId);if(type==='hint')alert('DICA: '+detail);else alert('Carta utilizada pela equipe '+teamLabel+': '+detail+(bonusActivity?' — Duelo bônus adicionado ao final da sequência de atividades.':''));}catch(err){console.error(err);alert('Não foi possível utilizar a carta: '+err.message);}
 });
 root.querySelector('#timer-toggle').onclick=()=>timerUpdate('toggle');root.querySelector('#timer-reset').onclick=()=>timerUpdate('reset');root.querySelector('#timer-extra').onclick=()=>timerUpdate('extra');
 const tick=()=>{const el=root.querySelector('#admin-timer');if(el)el.textContent=fmtTime(timeLeft(activeTimer));};let activeTimer=active.timer;
 const interval=setInterval(async()=>{if(!root.isConnected){clearInterval(interval);return;}const latest=(await db.all('activities')).find(a=>a.id===active.id);activeTimer=latest?.timer;tick();
 if(latest)root.querySelectorAll('[data-team-time]').forEach(el=>{
   const sec=teamTimeLeft(latest,el.dataset.teamTime);
   el.textContent=fmtTime(sec)+(latest.teamExtraSeconds?.[el.dataset.teamTime]?' · bônus +'+latest.teamExtraSeconds[el.dataset.teamTime]+'s':'');
   el.classList.toggle('expired',sec===0);
 });},1000);
 root.querySelectorAll('[data-save-answer]').forEach(b=>b.onclick=async()=>{const id=b.dataset.saveAnswer,answer=root.querySelector(`[data-answer="${id}"]`).value.trim();if(!answer){alert('Informe a resposta da equipe.');return;}const registered=(await db.all('responses')).filter(r=>r.activityId===active.id);if(singleResponse&&registered.some(r=>r.gameTeamId!==id)){alert('Neste confronto apenas a primeira equipe pode responder.');return;}const latest=(await db.all('activities')).find(a=>a.id===active.id);const question=latest.questionSnapshot||sampleQuestions[active.activityTypeId];if(!question){alert('Salve uma questão antes de registrar respostas.');return;}const correct=normalizeAnswer(answer)===normalizeAnswer(question.answer);const previous=(await db.all('responses')).find(r=>r.activityId===active.id&&r.gameTeamId===id);await db.put('responses',{id:previous?.id||uid(),gameId,activityId:active.id,gameTeamId:id,answer,correct,academicPoints:correct?active.academicWeight:0,scope:active.scope,competitionPoints:(active.scope==='confrontation'||active.activityTypeId==='ads-challenge')&&correct?1:0,updatedAt:new Date().toISOString()});channel.postMessage({type:'response:updated',gameId});await arena(root,db,gameId);});
 root.querySelector('#finish-activity').onclick=async()=>{if(!await arenaConfirm('Encerrar a atividade? Respostas não registradas ficarão sem pontuação.'))return;const now=new Date().toISOString();const latestActivity=(await db.all('activities')).find(a=>a.id===active.id)||active;const encounter=active.encounterId?(await db.all('encounters')).find(e=>e.id===active.encounterId):null;const tx=db.raw.transaction(['activities','encounters','games'],'readwrite');tx.objectStore('activities').put({...latestActivity,status:'completed',completedAt:now,updatedAt:now,timer:{...latestActivity.timer,remainingSeconds:timeLeft(latestActivity.timer),running:false,startedAt:null}});if(encounter)tx.objectStore('encounters').put({...encounter,status:'completed',completedAt:now});if(activities.every(a=>a.id===active.id||a.status==='completed'))tx.objectStore('games').put({...game,status:'completed',completedAt:now,updatedAt:now});await done(tx);channel.postMessage({type:'activity:completed',gameId});location.href=`/admin/games/${gameId}`;};
}
// Identidade visual original por tema: sem imagens de franquias ou recursos externos.
const themeIdentity = [
 {match:'Piratas',key:'pirates',icon:'☠',label:'Piratas'},
 {match:'Samurais',key:'samurai',icon:'⚔',label:'Samurais'},
 {match:'Galáxia',key:'galaxy',icon:'✦',label:'Galáxia'},
 {match:'Ninjas',key:'ninja',icon:'✧',label:'Ninjas'},
 {match:'Deuses',key:'gods',icon:'⚡',label:'Deuses'},
 {match:'Jogos',key:'retro',icon:'◆',label:'Jogos'},
 {match:'Pokémon',key:'monsters',icon:'◉',label:'Criaturas'},
 {match:'Dinossauros',key:'dino',icon:'♣',label:'Dinossauros'}
];
function teamIdentity(team){
 const theme=String(team?.themeSnapshot||'');
 return themeIdentity.find(x=>theme.includes(x.match))||{key:'default',icon:'★',label:'Equipe'};
}
function teamProjectionCard(team,score,rank){
 const id=teamIdentity(team);
 return `<div class="team-visual theme-${id.key}" aria-label="${esc(team?.nameSnapshot||'Equipe')}"><span class="team-symbol" aria-hidden="true"><img src="/assets/teams/${id.key==='default'?'galaxy':id.key}.webp" alt="" loading="eager"></span><span class="team-info"><strong>${esc(team?.nameSnapshot||'Equipe')}</strong><small>${esc(id.label)}</small></span>${rank?`<span class="team-rank">${rank}º</span>`:''}${score?`<span class="team-score">${score}</span>`:''}</div>`;
}
let projectionClockInterval=null;
let lastProjectionActivityId=null;
let lastProjectionStatus=null;
let presentationSoundEnabled=false;
let presentationAudio=null;
function playPresentationTone(){
 if(!presentationSoundEnabled)return;
 try{
   const AudioContextCtor=window.AudioContext||window.webkitAudioContext;
   if(!AudioContextCtor)return;
   presentationAudio ||= new AudioContextCtor();
   if(presentationAudio.state==='suspended')presentationAudio.resume().catch(()=>{});
   const now=presentationAudio.currentTime;
   [523.25,659.25,783.99].forEach((frequency,index)=>{
     const oscillator=presentationAudio.createOscillator(),gain=presentationAudio.createGain();
     oscillator.type='sine';oscillator.frequency.value=frequency;
     gain.gain.setValueAtTime(0.0001,now+index*.11);
     gain.gain.exponentialRampToValueAtTime(.07,now+index*.11+.025);
     gain.gain.exponentialRampToValueAtTime(.0001,now+index*.11+.24);
     oscillator.connect(gain);gain.connect(presentationAudio.destination);
     oscillator.start(now+index*.11);oscillator.stop(now+index*.11+.25);
   });
 }catch(err){console.warn('Som da apresentação indisponível:',err);}
}
async function projection(root,db){
 if(projectionClockInterval!==null){clearInterval(projectionClockInterval);projectionClockInterval=null;}
 const games=(await db.all('games')).filter(g=>g.status==='in_progress'||g.status==='completed').sort((a,b)=>String(b.updatedAt||b.completedAt||b.createdAt).localeCompare(String(a.updatedAt||a.completedAt||a.createdAt)));
 const game=games.find(g=>g.status==='in_progress')||games[0];const activities=game?(await db.all('activities')).filter(a=>a.gameId===game.id):[];
 const active=activities.find(a=>a.status==='active');const teams=game?(await db.all('gameTeams')).filter(t=>t.gameId===game.id):[];
 const question=active?(active.questionSnapshot||sampleQuestions[active.activityTypeId]):null;
 let results='';
 if(game?.status==='completed'&&!active){
   const [responses,academicAdjustments,competitionAdjustments]=await Promise.all(['responses','academicScores','competitionScores'].map(x=>db.all(x)));
   const ranked=teams.map(t=>({...t,score:scoreForTeam(game.id,t.id,responses,academicAdjustments,competitionAdjustments)}))
     .sort((a,b)=>b.score.competitive-a.score.competitive||b.score.academic-a.score.academic||a.nameSnapshot.localeCompare(b.nameSnapshot,'pt-BR'));
   results=`<div class="projection-results"><small>PARTIDA CONCLUÍDA · RESULTADOS FINAIS</small><h1>${esc(game.name)}</h1><p>Classificação competitiva e notas acadêmicas</p><div class="projection-ranking"><div class="projection-rank-header"><span>Posição / Equipe</span><span>Competição</span><span>Nota / 10</span></div>${ranked.map((t,i)=>`<div class="projection-rank-row ${i===0?'winner':''}"><div>${teamProjectionCard(t,null,i+1)}</div><span>${t.score.competitive} pts</span><span>${t.score.academic.toFixed(1).replace('.',',')}</span></div>`).join('')}</div></div>`;
 }
 root.innerHTML=`<main class="projection live-projection ${results?'presentation-finale':active?'presentation-active':'presentation-waiting'}"><header><span class="brand"><img class="ads-logo" src="/assets/logo-ads.png" alt="Logo do curso de ADS"> CLASS ARENA</span><div class="projection-header-actions"><span>${esc(game?.name||'MODO DE PROJEÇÃO')}</span><button type="button" id="presentation-sound" aria-label="Alternar sons da projeção" title="Som depende de interação com o navegador">${presentationSoundEnabled?'♫ Som ligado':'♪ Som desligado'}</button><button type="button" id="presentation-fullscreen" aria-label="Alternar tela cheia">⛶ Tela cheia</button></div></header><section class="projection-stage">${results|| (active?`<small>${active.activityTypeId==='ads-challenge'?'⚡ ADS CHALLENGE · RODADA RELÂMPAGO':`ATIVIDADE ${active.order} / ${activities.length} · ${esc(active.titleSnapshot)}`}</small><h1>${esc(question?.statement||'Aguardando questão do professor')}</h1>${question?.options?.length?`<div class="projection-options">${question.options.map((o,i)=>`<div><b>${String.fromCharCode(65+i)})</b> ${esc(o)}</div>`).join('')}</div>`:''}<div class="projection-clock" id="projection-clock">${fmtTime(timeLeft(active.timer))}</div>${active.scope==='confrontation'?`<p>${game.config.duelResponseMode==='first'?'⚡ Somente a primeira equipe responde':'Ambas as equipes podem responder'}</p>`:''}${active.activityTypeId==='ads-challenge'?'<p>⚡ Todas as equipes participam · +1 ponto competitivo por acerto</p>':''}<div class="projection-teams visual-team-grid">${active.participants.map(id=>`<div class="projection-team-with-time">${teamProjectionCard(teams.find(t=>t.id===id))}<small class="team-time" data-team-time="${id}">${fmtTime(teamTimeLeft(active,id))}${active.teamExtraSeconds?.[id]?' · bônus +'+active.teamExtraSeconds[id]+'s':''}</small></div>`).join('')}</div>`:`<small>${game?'PARTIDA EM ANDAMENTO':'ARENA PRONTA'}</small><h1>${game?'Aguardando próxima atividade':'Conhecimento em jogo.'}</h1><p>${game?'O professor iniciará a próxima questão em breve.':'Inicie uma partida no painel do professor.'}</p>`)}</section><footer>CLASS ARENA <span>${game?.status==='completed'?'RESULTADOS FINAIS':active?'RESPONDAM À QUESTÃO':'APRESENTAÇÃO LOCAL'}</span></footer></main>`;
 const fullScreen=root.querySelector('#presentation-fullscreen');
 if(fullScreen)fullScreen.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await root.querySelector('main').requestFullscreen();}catch(err){console.warn('Tela cheia não disponível:',err);}};
 const sound=root.querySelector('#presentation-sound');
 if(sound)sound.onclick=()=>{presentationSoundEnabled=!presentationSoundEnabled;sound.textContent=presentationSoundEnabled?'♫ Som ligado':'♪ Som desligado';if(presentationSoundEnabled)playPresentationTone();};
 const currentId=active?.id||null;
 if(lastProjectionStatus!==null&&(currentId!==lastProjectionActivityId||game?.status!==lastProjectionStatus))playPresentationTone();
 lastProjectionActivityId=currentId;lastProjectionStatus=game?.status||null;
 if(active){const clock=root.querySelector('#projection-clock');projectionClockInterval=setInterval(()=>{if(!clock.isConnected){clearInterval(projectionClockInterval);projectionClockInterval=null;return;}clock.textContent=fmtTime(timeLeft(active.timer));
 root.querySelectorAll('[data-team-time]').forEach(el=>{
   const sec=teamTimeLeft(active,el.dataset.teamTime);
   el.textContent=fmtTime(sec)+(active.teamExtraSeconds?.[el.dataset.teamTime]?' · bônus +'+active.teamExtraSeconds[el.dataset.teamTime]+'s':'');
   el.classList.toggle('expired',sec===0);
 });},250);}
}
let projectionRefreshPending=false;
channel.addEventListener('message',()=>{if(location.pathname!=='/presentation'||projectionRefreshPending)return;projectionRefreshPending=true;setTimeout(async()=>{projectionRefreshPending=false;const root=document.querySelector('#app');if(root&&window.__classArenaDB){try{await projection(root,window.__classArenaDB);}catch(err){console.error('Falha ao atualizar a projeção:',err);}}},80);});

// Banco de questões v0.9.0. Os registros são independentes dos snapshots de partidas.
const questionTypes = ['multiple-choice','text','numeric'];
function questionPage(ds,types,items){
 return `<section class="intro"><div><small>CONTEÚDO PEDAGÓGICO</small><h2>Banco de questões</h2><p>Cadastre, filtre, importe e exporte questões. Partidas preservam cópias das questões utilizadas.</p></div><button class="primary" id="new-question">＋ Nova questão</button></section>
 <section class="form-panel"><div class="question-toolbar"><label>Disciplina<select id="q-filter-discipline"><option value="">Todas</option>${ds.map(d=>`<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('')}</select></label><label>Modalidade<select id="q-filter-type"><option value="">Todas</option>${types.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></label><label>Pesquisar<input id="q-search" placeholder="Enunciado ou tema"></label><label> Dificuldade<select id="q-filter-level"><option value="">Todas</option><option>Fácil</option><option>Média</option><option>Difícil</option></select></label></div><div class="question-toolbar"><button class="secondary" id="q-export">Exportar JSON</button><button class="secondary" id="q-import">Importar questões (Excel ou JSON)</button><a class="secondary" href="/class-arena-modelo-questoes.xlsx" download>Baixar modelo Excel</a><input type="file" id="q-file" accept=".xlsx,.xls,.json,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" hidden><span id="q-count" class="muted"></span></div></section>
 <section id="q-list" class="question-list"></section><div class="backdrop hidden" id="q-modal"><form class="modal question-modal" id="q-form"><div class="modalhead"><h3 id="q-modal-title">Nova questão</h3><button type="button" class="x" id="q-close">×</button></div><input type="hidden" id="q-id"><label>Disciplina<select id="q-discipline" required>${ds.map(d=>`<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('')}</select></label><label>Modalidade<select id="q-type" required></select></label><label>Enunciado<textarea id="q-statement" required rows="3" maxlength="2000"></textarea></label><label>Alternativas (uma por linha; vazio para resposta aberta)<textarea id="q-options" rows="4"></textarea></label><label>Gabarito (letra A–H para múltipla escolha ou resposta em texto)<input id="q-answer" required maxlength="500"></label><div class="question-toolbar"><label>Dificuldade<select id="q-level"><option>Fácil</option><option selected>Média</option><option>Difícil</option></select></label><label>Tema / tags<input id="q-tags" placeholder="binário, conversão"></label></div><label>Dica<textarea id="q-hint" rows="2"></textarea></label><label>Explicação<textarea id="q-explanation" rows="2"></textarea></label><label class="toggle"><input type="checkbox" id="q-active" checked> Questão ativa</label><div class="actions"><button type="button" id="q-cancel">Cancelar</button><button class="primary">Salvar questão</button></div></form></div>`;
}
function bindQuestions(root,db,ds,types){
 let items=[];const $=id=>root.querySelector('#'+id);const modal=$('q-modal');
 const typeOptions=()=>{$('q-type').innerHTML=types.filter(t=>t.disciplineId===$('q-discipline').value).map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')};
 const render=()=>{const d=$('q-filter-discipline').value,t=$('q-filter-type').value,l=$('q-filter-level').value,search=$('q-search').value.toLocaleLowerCase('pt-BR');const filtered=items.filter(q=>(!d||q.disciplineId===d)&&(!t||q.activityTypeId===t)&&(!l||q.difficulty===l)&&(!search||(q.statement+' '+(q.tags||[]).join(' ')).toLocaleLowerCase('pt-BR').includes(search)));$('q-count').textContent=`${filtered.length} de ${items.length} questões`; $('q-list').innerHTML=filtered.length?filtered.map(q=>`<article class="question-card"><div><small>${esc(ds.find(d=>d.id===q.disciplineId)?.name||'Disciplina')} · ${esc(types.find(t=>t.id===q.activityTypeId)?.name||'Modalidade')} · ${esc(q.difficulty||'Média')} ${q.active===false?'· INATIVA':''}</small><h3>${esc(q.statement)}</h3><p>${esc((q.options||[]).map((o,i)=>String.fromCharCode(65+i)+') '+o).join(' | '))}</p><small>${esc((q.tags||[]).join(', '))}</small></div><div class="actions"><button data-q-edit="${esc(q.id)}">Editar</button><button class="danger" data-q-delete="${esc(q.id)}">Excluir</button></div></article>`).join(''):'<div class="empty"><h3>Nenhuma questão encontrada</h3><p>Cadastre uma questão ou ajuste os filtros.</p></div>';
 root.querySelectorAll('[data-q-edit]').forEach(b=>b.onclick=()=>open(items.find(q=>q.id===b.dataset.qEdit)));root.querySelectorAll('[data-q-delete]').forEach(b=>b.onclick=async()=>{if(!await arenaConfirm('Excluir esta questão do banco? Partidas existentes não serão alteradas.'))return;await db.delete('questions',b.dataset.qDelete);await reload();});};
 const reload=async()=>{items=await db.all('questions');render();};
 const open=q=>{$('q-form').reset();$('q-id').value=q?.id||'';$('q-discipline').value=q?.disciplineId||ds[0]?.id||'';typeOptions();$('q-type').value=q?.activityTypeId||$('q-type').options[0]?.value||'';$('q-statement').value=q?.statement||'';$('q-options').value=(q?.options||[]).join('\n');$('q-answer').value=q?.answer||'';$('q-level').value=q?.difficulty||'Média';$('q-tags').value=(q?.tags||[]).join(', ');$('q-hint').value=q?.hint||'';$('q-explanation').value=q?.explanation||'';$('q-active').checked=q?.active!==false;$('q-modal-title').textContent=q?'Editar questão':'Nova questão';modal.classList.remove('hidden');};
 $('new-question').onclick=()=>{if(!ds.length||!types.length)return alert('Cadastre uma disciplina com modalidades antes.');open();};$('q-close').onclick=$('q-cancel').onclick=()=>modal.classList.add('hidden');$('q-discipline').onchange=typeOptions;
 ['q-filter-discipline','q-filter-type','q-filter-level','q-search'].forEach(id=>$(id).addEventListener('input',render));
 $('q-form').onsubmit=async e=>{e.preventDefault();const id=$('q-id').value,old=items.find(q=>q.id===id),options=$('q-options').value.split('\n').map(x=>x.trim()).filter(Boolean),answer=$('q-answer').value.trim().toUpperCase();if(options.length&&(options.length<2||options.length>8||!/^[A-H]$/.test(answer)||answer.charCodeAt(0)-65>=options.length))return alert('Questões objetivas precisam de 2 a 8 alternativas e gabarito por letra válida (A–H).');const q={id:id||uid(),disciplineId:$('q-discipline').value,activityTypeId:$('q-type').value,statement:$('q-statement').value.trim(),options,answer:options.length?answer:$('q-answer').value.trim(),difficulty:$('q-level').value,tags:$('q-tags').value.split(',').map(x=>x.trim()).filter(Boolean),hint:$('q-hint').value.trim(),explanation:$('q-explanation').value.trim(),active:$('q-active').checked,createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};if(!q.statement||!q.answer||!q.activityTypeId)return alert('Preencha os campos obrigatórios.');await db.put('questions',q);modal.classList.add('hidden');channel.postMessage({type:'catalog:updated'});await reload();};
 $('q-export').onclick=()=>{const blob=new Blob([JSON.stringify({format:'class-arena-questions',version:1,questions:items},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='class-arena-questoes.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);};
 const importExcel=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
   if(file.size>5_000_000)throw Error('O Excel excede o limite de 5 MB.');
   const XLSX=await import('xlsx');
   const book=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});
   const sheet=book.Sheets['Questoes']||book.Sheets[book.SheetNames[0]];
   if(!sheet)throw Error('A planilha não possui abas.');
   const rows=XLSX.utils.sheet_to_json(sheet,{defval:'',raw:false});
   if(rows.length>1000)throw Error('Máximo de 1000 linhas por importação.');
   const clean=v=>String(v??'').trim();
   const valid=[],errors=[];
   rows.forEach((row,i)=>{
    const line=i+2,disc=clean(row.disciplina),type=clean(row.modalidade),statement=clean(row.enunciado),answer=clean(row.gabarito);
    if(!Object.values(row).some(v=>clean(v)))return;
    const options='abcdefgh'.split('').map(l=>clean(row['alternativa_'+l]));
    const count=options.filter(Boolean).length;
    const errorsHere=[];
    if(!ds.some(d=>d.id===disc))errorsHere.push('disciplina desconhecida');
    if(!types.some(t=>t.id===type&&t.disciplineId===disc))errorsHere.push('modalidade inválida');
    if(!statement||statement.length>2000)errorsHere.push('enunciado ausente ou longo');
    if(!answer||answer.length>500)errorsHere.push('gabarito ausente ou longo');
    if(count&&((count<2)||options.slice(0,count).some(v=>!v)||!(/^[A-H]$/i.test(answer))||answer.toUpperCase().charCodeAt(0)-65>=count))errorsHere.push('alternativas ou letra do gabarito inválidas');
    if(errorsHere.length){errors.push(`Linha ${line}: ${errorsHere.join(', ')}`);return;}
    valid.push({id:clean(row.id)||uid(),disciplineId:disc,activityTypeId:type,statement,options:options.slice(0,count),answer:count?answer.toUpperCase():answer,difficulty:['Fácil','Média','Difícil'].includes(clean(row.dificuldade))?clean(row.dificuldade):'Média',tags:clean(row.tags).split(',').map(t=>t.trim()).filter(Boolean).slice(0,20),hint:clean(row.dica).slice(0,2000),explanation:clean(row.explicacao).slice(0,2000),active:!['não','nao','false','0','inativo'].includes(clean(row.ativo).toLowerCase()),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
   });
   if(errors.length)throw Error(`${errors.length} linha(s) inválida(s):\n${errors.slice(0,8).join('\n')}\nCorrija a planilha antes de importar.`);
   if(!valid.length)throw Error('Nenhuma questão válida encontrada.');
   if(new Set(valid.map(q=>q.id)).size!==valid.length)throw Error('Existem IDs duplicados no arquivo.');
   if(!await arenaConfirm(`Importar ${valid.length} questões do Excel? IDs já existentes serão atualizados.`))return;
   const tx=db.raw.transaction('questions','readwrite');
   valid.forEach(q=>tx.objectStore('questions').put(q));
   await done(tx);channel.postMessage({type:'catalog:updated'});await reload();alert(`${valid.length} questão(ões) importada(s) com sucesso.`);
  }catch(err){alert('Importação Excel não realizada: '+err.message);}finally{e.target.value='';}
 };
 const importJson=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2_000_000)throw Error('Arquivo maior que 2 MB.');const data=JSON.parse(await file.text());if(data.format!=='class-arena-questions'||!Array.isArray(data.questions)||data.questions.length>1000)throw Error('Formato de arquivo inválido.');const valid=data.questions.filter(q=>q&&typeof q.statement==='string'&&q.statement.trim()&&typeof q.answer==='string'&&q.answer.trim()&&ds.some(d=>d.id===q.disciplineId)&&types.some(t=>t.id===q.activityTypeId&&t.disciplineId===q.disciplineId)&&Array.isArray(q.options)&&q.options.length<=8&&q.options.every(x=>typeof x==='string')&&(!q.options.length||(/^[A-H]$/.test(q.answer)&&q.answer.charCodeAt(0)-65<q.options.length)));if(!valid.length)throw Error('Nenhuma questão válida para as disciplinas cadastradas.');if(!await arenaConfirm(`Importar ${valid.length} questão(ões)? IDs existentes serão substituídos.`))return;const tx=db.raw.transaction('questions','readwrite');valid.forEach(q=>tx.objectStore('questions').put({id:String(q.id||uid()),disciplineId:q.disciplineId,activityTypeId:q.activityTypeId,statement:q.statement.slice(0,2000),options:q.options,answer:q.answer.slice(0,500),difficulty:['Fácil','Média','Difícil'].includes(q.difficulty)?q.difficulty:'Média',tags:Array.isArray(q.tags)?q.tags.filter(x=>typeof x==='string').slice(0,20):[],hint:String(q.hint||'').slice(0,2000),explanation:String(q.explanation||'').slice(0,2000),active:q.active!==false,createdAt:q.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()}));await done(tx);await reload();alert(`${valid.length} questão(ões) importada(s).`);}catch(err){alert('Importação não realizada: '+err.message);}finally{e.target.value='';}};
 $('q-import').onclick=()=>$('q-file').click();
 $('q-file').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;const name=file.name.toLowerCase();if(name.endsWith('.json'))return importJson(e);if(name.endsWith('.xlsx')||name.endsWith('.xls'))return importExcel(e);alert('Selecione um arquivo .xlsx, .xls ou .json.');e.target.value='';};
 reload();
}
async function pickQuestion(db,game,activity,activities){
 const qs=(await db.all('questions')).filter(q=>q.disciplineId===game.disciplineId&&q.active!==false);
 const used=new Set(activities.filter(a=>a.id!==activity.id).map(a=>a.questionSnapshot?.sourceQuestionId).filter(Boolean));
 const exact=qs.filter(q=>q.activityTypeId===activity.activityTypeId&&!used.has(q.id));
 const fallback=(activity.scope==='confrontation'||activity.scope==='special')?qs.filter(q=>!used.has(q.id)):[];
 const candidates=exact.length?exact:fallback;
 if(!candidates.length)return null;
 const q=candidates[0];return {statement:q.statement,options:[...(q.options||[])],answer:q.answer,sourceQuestionId:q.id};
}
