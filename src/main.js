import './style.css';
import { DB } from './storage.js';
import { start } from './ui.js';

async function initializeApp() {
  const db = await DB.open();
  await seed(db);
  window.__classArenaDB=db;
  await start(document.querySelector('#app'), db);
}

initializeApp().catch((error) => {
  console.error('Erro ao inicializar o CLASS ARENA:', error);
  const root = document.querySelector('#app');
  if (root) root.innerHTML = '<main class="error-screen"><h1>Não foi possível iniciar o CLASS ARENA</h1><p>Verifique o console do navegador para identificar o erro.</p></main>';
});

async function seed(db) {
  if ((await db.all('disciplines')).length) return;
  const modules = await Promise.all(['architecture', 'mathematics'].map(async (id) => {
    const response = await fetch(`/modules/${id}/module.json`);
    if (!response.ok) throw new Error(`Falha ao carregar módulo ${id}`);
    return response.json();
  }));
  const tx = db.raw.transaction(['disciplines', 'activityTypes'], 'readwrite');
  for (const module of modules) {
    tx.objectStore('disciplines').put({ ...module, source: 'module', createdAt: new Date().toISOString() });
    for (const activity of module.activityTypes) tx.objectStore('activityTypes').put({ ...activity, disciplineId: module.id });
  }
  await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
}
