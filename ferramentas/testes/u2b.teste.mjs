// Testes da U2b (abertura, modo foto, som e Mural), sem navegador nem áudio de verdade:
//  - sons do mundo: a mistura pela altura (vento sobe, cidade e água descem, gaivotas só de dia e perto da água), a
//    água em volta pelo relevo, o grafo de áudio num contexto falso (sem exceção, nós contados, sem estalo no laço);
//  - música: o plano de acordes é reproduzível, nunca repete o mesmo acorde em seguida, não cai num laço de ordem fixa,
//    desce uma oitava à noite, agenda à frente do relógio e para limpo;
//  - Mural: o assunto de cada chave, as notícias do mais novo ao mais velho e que cada chave do Mural da simulação
//    (s3, s3b e x1) tem texto; a abertura soma 40 s e acaba na câmera da partida; o modo foto (luzes sem hora em número,
//    nome do arquivo, tamanho); a nova partida tem o Modo livre e o texto dele;
//  - os textos da U2b: nada proibido pela D42 (guarda de texto) e nenhum travessão.
// Roda sozinho: node ferramentas/testes/u2b.teste.mjs (o simular --testes descobre).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fonte = (p) => join(RAIZ, 'fonte', p);

// ------------------------------------------------------------------------------------------------ contexto de áudio falso

function contextoFalso() {
  const nos = [];
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime() {},
  });
  const no = (tipo, extra = {}) => {
    const n = { tipo, connect() {}, disconnect() {}, start() {}, stop() {}, ...extra };
    nos.push(n);
    return n;
  };
  return {
    nos,
    sampleRate: 8000,
    currentTime: 0,
    destination: no('destino'),
    createBuffer: (c, n) => ({ n, getChannelData: () => new Float32Array(n) }),
    createBufferSource: () => no('fonte', { playbackRate: param(), loop: false, buffer: null }),
    createBiquadFilter: () => no('filtro', { frequency: param(), Q: param(), type: '' }),
    createGain: () => no('ganho', { gain: param() }),
    createOscillator: () => no('osc', { frequency: param(), detune: param(), type: '', onended: null }),
    createDelay: () => no('atraso', { delayTime: param() }),
    createConvolver: () => no('convolver', { buffer: null }),
  };
}

// ------------------------------------------------------------------------------------------------ mundo

test('mundo: a mistura segue a altura da câmera', async () => {
  const { mistura, fracaoDeAltura } = await import(join(fonte('som/mundo.js')));
  const perto = mistura({ altura: 40, costa: 0, noite: 0, populacao: 5000 });
  const meio = mistura({ altura: 500, costa: 0, noite: 0, populacao: 5000 });
  const longe = mistura({ altura: 4000, costa: 0, noite: 0, populacao: 5000 });
  assert.ok(perto.vento < meio.vento && meio.vento < longe.vento, 'o vento sobe com a altura');
  assert.ok(perto.cidade > meio.cidade && meio.cidade > longe.cidade, 'a cidade some com a altura');
  assert.ok(longe.cidade < 0.02, 'lá em cima quase não há cidade');
  assert.equal(fracaoDeAltura(10), 0);
  assert.equal(fracaoDeAltura(99999), 1);
  for (const v of Object.values(perto)) assert.ok(v >= 0 && v <= 1);
});

test('mundo: a cidade pede população, a água pede costa, as gaivotas pedem dia e costa', async () => {
  const { mistura } = await import(join(fonte('som/mundo.js')));
  const vazia = mistura({ altura: 100, populacao: 0 });
  const cheia = mistura({ altura: 100, populacao: 5000 });
  assert.ok(cheia.cidade > 3 * vazia.cidade && vazia.cidade > 0, 'o canteiro soa, a cidade cheia soa mais');
  const seco = mistura({ altura: 100, costa: 0 });
  const orla = mistura({ altura: 100, costa: 1 });
  assert.equal(seco.agua, 0);
  assert.equal(seco.gaivotas, 0);
  assert.ok(orla.agua > 0.3 && orla.gaivotas > 0.3);
  const noite = mistura({ altura: 100, costa: 1, noite: 1 });
  assert.equal(noite.gaivotas, 0, 'sem gaivotas à noite');
  assert.ok(mistura({ altura: 100, populacao: 5000, noite: 1 }).cidade < mistura({ altura: 100, populacao: 5000, noite: 0 }).cidade, 'a cidade é mais baixa à noite');
  assert.equal(mistura({ altura: 4000, costa: 1 }).gaivotas, 0, 'sem gaivotas de muito alto');
});

test('mundo: a água em volta sai do relevo (nível do mar e abaixo)', async () => {
  const { fracaoDeAgua, alturaDaCamera } = await import(join(fonte('som/mundo.js')));
  const n = 64;
  const mar = { n, passo: 50, origem: [0, 0], altura: new Float32Array(n * n).fill(-5) };
  const terra = { n, passo: 50, origem: [0, 0], altura: new Float32Array(n * n).fill(20) };
  assert.equal(fracaoDeAgua(mar, 1600, 1600), 1);
  assert.equal(fracaoDeAgua(terra, 1600, 1600), 0);
  assert.equal(fracaoDeAgua(null, 0, 0), 0);
  // metade da grade em mar: o ponto na borda tem água em parte dos vizinhos
  const meio = { n, passo: 50, origem: [0, 0], altura: new Float32Array(n * n).map((_, k) => ((k % n) < n / 2 ? -5 : 20)) };
  const f = fracaoDeAgua(meio, 1600, 1600);
  assert.ok(f > 0 && f < 1, `meio a meio deu ${f}`);
  assert.ok(Math.abs(alturaDaCamera({ dist: 1000, inclinacao: 30 }) - 500) < 1e-9);
});

test('mundo: o grafo de áudio monta, atualiza, grita e para sem erro', async () => {
  const { criarMundo } = await import(join(fonte('som/mundo.js')));
  const ctx = contextoFalso();
  const dest = ctx.destination;
  const m = criarMundo(ctx, dest);
  const antes = m.nos;
  assert.ok(antes >= 12 && antes < 40, `nós fixos: ${antes}`);
  m.atualizar({ vento: 0.5, cidade: 0.4, agua: 0.3, gaivotas: 0.2 });
  m.gaivota(0, 1800);
  assert.ok(m.nos > antes, 'a gaivota acrescenta osciladores');
  m.parar();
});

// ------------------------------------------------------------------------------------------------ música

test('música: o plano de acordes é reproduzível e nunca repete em seguida', async () => {
  const { proximoAcorde, geradorMusical, ACORDES, TRANSICOES } = await import(join(fonte('som/musica.js')));
  for (const t of TRANSICOES) assert.ok(t.length >= 3 && t.every((i) => i >= 0 && i < ACORDES.length));
  TRANSICOES.forEach((t, i) => assert.ok(!t.includes(i), `o acorde ${i} não vai para si mesmo`));
  const a = geradorMusical(5);
  const b = geradorMusical(5);
  const roda = (rng, n, noite) => {
    const seq = [];
    let ant = null;
    for (let i = 0; i < n; i++) {
      const p = proximoAcorde({ anterior: ant, noite, rng });
      seq.push(p);
      ant = p.indice;
    }
    return seq;
  };
  const s1 = roda(a, 40, 0);
  const s2 = roda(b, 40, 0);
  assert.deepEqual(s1.map((p) => p.nome), s2.map((p) => p.nome), 'mesma semente, mesma música');
  for (let i = 1; i < s1.length; i++) assert.notEqual(s1[i].indice, s1[i - 1].indice);
  // sem laço audível: nenhuma janela de 6 acordes se repete na sequência de 40
  const nomes = s1.map((p) => p.nome);
  const janelas = new Set();
  for (let i = 0; i + 6 <= nomes.length; i++) janelas.add(nomes.slice(i, i + 6).join('>'));
  assert.equal(janelas.size, nomes.length - 5, 'as janelas de 6 acordes não se repetem');
  // semente diferente, caminho diferente
  assert.notDeepEqual(roda(geradorMusical(6), 40, 0).map((p) => p.nome), nomes);
});

test('música: a noite desce uma oitava, fecha o filtro e rareia os sinos', async () => {
  const { proximoAcorde, geradorMusical } = await import(join(fonte('som/musica.js')));
  let sinosDia = 0;
  let sinosNoite = 0;
  let corteDia = 0;
  let corteNoite = 0;
  for (let i = 0; i < 30; i++) {
    const d = proximoAcorde({ anterior: 0, noite: 0, rng: geradorMusical(100 + i) });
    const n = proximoAcorde({ anterior: 0, noite: 1, rng: geradorMusical(100 + i) });
    sinosDia += d.sinos.length;
    sinosNoite += n.sinos.length;
    corteDia += d.corte;
    corteNoite += n.corte;
    for (const s of d.sinos) assert.ok(s.f > 400 && s.f < 4000, `sino fora da faixa: ${s.f}`);
    for (const v of d.pad) assert.ok(v.vol > 0 && v.vol < 0.1 && v.f > 30 && v.f < 1000);
    assert.ok(d.dur >= 15 && d.dur <= 24);
  }
  assert.ok(sinosNoite < sinosDia * 0.6, `sinos: dia ${sinosDia}, noite ${sinosNoite}`);
  assert.ok(corteNoite < corteDia * 0.75);
});

test('música: agenda à frente do relógio do áudio e para limpo', async () => {
  const { criarMusica } = await import(join(fonte('som/musica.js')));
  const ctx = contextoFalso();
  const m = criarMusica(ctx, ctx.destination, { semente: 3 });
  m.agendar(0);
  const n1 = ctx.nos.length;
  assert.ok(m.acordes.length >= 1 && m.acordes.length <= 3, `acordes à frente: ${m.acordes.length}`);
  assert.ok(n1 > 20, 'o primeiro acorde cria as vozes');
  m.agendar(0);
  assert.equal(ctx.nos.length, n1, 'nada novo enquanto o relógio não andou');
  ctx.currentTime = 60; // a aba ficou parada um minuto: recomeça de agora, sem despejar o atraso
  m.agendar(1);
  assert.ok(m.acordes.length <= 6, `sem despejo: ${m.acordes.length}`);
  m.parar();
  const n2 = ctx.nos.length;
  m.agendar(0);
  assert.equal(ctx.nos.length, n2, 'parada, não agenda mais');
});

// ------------------------------------------------------------------------------------------------ interface

let pacote = null;
async function ui() {
  if (pacote) return pacote;
  const { build } = await import('esbuild');
  const abs = (p) => JSON.stringify(fonte(p));
  const entrada = `
    export * as mural from ${abs('ui/telas/corpo/Mural.jsx')};
    export * as foto from ${abs('ui/telas/Foto.jsx')};
    export * as abertura from ${abs('ui/inicio/Abertura.jsx')};
    export * as nova from ${abs('ui/inicio/NovaPartida.jsx')};
    export * as textos from ${abs('ui/textos.js')};
    export * as u2b from ${abs('ui/textos/u2b.js')};
    export * as s3 from ${abs('ui/textos/s3.js')};
    export * as s3b from ${abs('ui/textos/s3b.js')};
    export * as x1 from ${abs('ui/textos/x1.js')};
    export * as glifos from ${abs('ui/glifos/glifos.js')};
  `;
  const r = await build({
    stdin: { contents: entrada, resolveDir: RAIZ, loader: 'js' }, bundle: true, write: false, format: 'esm', platform: 'node',
    logLevel: 'silent', jsx: 'automatic', jsxImportSource: 'preact', nodePaths: [join(RAIZ, 'node_modules')],
  });
  pacote = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
  pacote.u2b.registrar(pacote.textos.registrarTextos);
  return pacote;
}

test('Mural: assunto por chave, ordem das notícias e texto de cada chave do Mural', async () => {
  const { mural, textos } = await ui();
  assert.equal(mural.assuntoDe('s3.mural.decisao.vila.agua.captacao'), 'decisoes');
  assert.equal(mural.assuntoDe('s3.mural.marco'), 'marcos');
  assert.equal(mural.assuntoDe('x1.mural.torre.e2'), 'arcologia');
  assert.equal(mural.assuntoDe('s3.mural.evento.rivais'), 'mundo');
  assert.equal(mural.assuntoDe('s3.mural.vilaNova.reformar'), 'vila');
  const l = mural.noticias([
    { id: 1, tique: 100, autor: 'iris', texto: 's3.mural.marco', params: { n: 1, nome: 'Vila' }, alvo: null, data: { mes: 1, ano: 2020 } },
    { id: 2, tique: 900, autor: 'cida', texto: 's3.mural.evento.rivais', params: {}, alvo: { x: 1, z: 2 } },
    { id: 3, tique: 900, autor: 'tome', texto: 'chave.que.nao.existe', params: {} },
  ]);
  assert.deepEqual(l.map((n) => n.id), [3, 2, 1], 'do mais novo ao mais velho, o empate pelo id');
  assert.ok(l[0].frase.startsWith('Notícia sem texto'));
  assert.ok(l[2].frase.includes('Marco 1'));
  assert.equal(mural.autorDe('cida'), 'Dona Cida (Aparecida Moura)');
  assert.equal(mural.autorDe(null), 'Heldópolis');
  // toda chave de Mural que as partes da simulação postam tem texto
  const postadas = new Set();
  for (const arq of ['sim/historia.js', 'sim/progresso.js', 'sim/arcologia.js', 'sim/holding/vila.js', 'data/historia.js']) {
    const src = readFileSync(fonte(arq), 'utf8');
    for (const m of src.matchAll(/['"`]((?:s3|x1)\.mural\.[\w.]+)['"`]/g)) postadas.add(m[1]);
  }
  assert.ok(postadas.size >= 10, `chaves achadas: ${postadas.size}`);
  const faltam = [...postadas].filter((k) => !textos.temTexto(k) && !/\.$/.test(k));
  assert.deepEqual(faltam, [], 'toda chave do Mural postada tem texto');
});

test('Abertura: 40 s, quatro tempos e o fim na câmera da partida', async () => {
  const { abertura } = await ui();
  assert.equal(abertura.DURACAO_MS, 40000);
  assert.equal(abertura.CENAS.length, 4);
  assert.equal(abertura.cenaNoTempo(0), 0);
  assert.equal(abertura.cenaNoTempo(9999), 0);
  assert.equal(abertura.cenaNoTempo(10000), 1);
  assert.equal(abertura.cenaNoTempo(33999), 2);
  assert.equal(abertura.cenaNoTempo(34000), 3);
  assert.equal(abertura.cenaNoTempo(40000), -1);
  const ultima = abertura.CENAS[3].para([0, 0]);
  assert.deepEqual(ultima, abertura.CAMERA_PARTIDA);
  // a câmera da partida é a de app/controle.js (CAMERAS.partida)
  const ctl = readFileSync(fonte('app/controle.js'), 'utf8');
  const m = ctl.match(/partida:\s*\{\s*x:\s*(-?\d+),\s*z:\s*(-?\d+),\s*dist:\s*(\d+),\s*guinada:\s*(-?\d+),\s*inclinacao:\s*(\d+)/);
  assert.ok(m, 'CAMERAS.partida achada');
  assert.deepEqual([abertura.CAMERA_PARTIDA.x, abertura.CAMERA_PARTIDA.z, abertura.CAMERA_PARTIDA.dist, abertura.CAMERA_PARTIDA.guinada, abertura.CAMERA_PARTIDA.inclinacao], m.slice(1).map(Number));
  for (const c of abertura.CENAS) {
    const cam = c.para([100, 200]);
    assert.ok(cam.dist >= 10 && cam.dist <= 9000 && cam.inclinacao >= 3 && cam.inclinacao <= 88, 'dentro dos limites da câmera');
  }
});

test('Modo foto: luzes por fase sem hora em número, nome do arquivo e tamanho', async () => {
  const { foto, textos } = await ui();
  assert.deepEqual(foto.LUZES.map((l) => l.v), ['jogo', 'manha', 'tarde', 'fimDeTarde', 'noite']);
  for (const l of foto.LUZES) {
    assert.ok(textos.temTexto(l.rotulo), l.rotulo);
    assert.ok(!/\d/.test(textos.t(l.rotulo)), 'nenhuma hora em número');
  }
  assert.equal(foto.nomeDoArquivo(new Date(2026, 9, 17, 8, 5, 9)), 'heldopolis-foto-20261017-080509.jpg');
  assert.deepEqual(foto.tamanhoDaFoto('hd', { width: 1366, height: 768 }), { w: 1920, h: 1080 });
  assert.deepEqual(foto.tamanhoDaFoto('tela', { width: 1366, height: 768 }), { w: 1366, h: 768 });
  assert.deepEqual(foto.tamanhoDaFoto('tela', null), { w: 1920, h: 1080 });
  // as fases existem no render
  const dep = readFileSync(fonte('render/depuracao.js'), 'utf8');
  for (const f of ['manha', 'tarde', 'fimDeTarde', 'noite']) assert.ok(new RegExp(`\\b${f}\\b`).test(dep.match(/HORA_DA_FASE[^;]*;/)[0]), f);
});

test('Nova partida: o Modo livre tem interruptor, texto e vai no modo da partida', async () => {
  const { nova, textos } = await ui();
  assert.equal(nova.PARTIDA_PADRAO.modo, 'normal', 'o padrão é o modo normal');
  assert.ok(textos.temTexto('u2b.nova.livre') && textos.temTexto('u2b.nova.livreExp'));
  assert.ok(textos.t('u2b.nova.livreExp', { caixa: 'US$ 600 bi' }).includes('US$ 600 bi'));
  const src = readFileSync(fonte('ui/inicio/corpo/Inicio.jsx'), 'utf8');
  assert.ok(/modo:\s*livre \? 'livre' : 'normal'/.test(src), 'a nova partida manda o modo');
  assert.ok(/data-a|a="nova\.livre"/.test(src));
});

test('Textos da U2b: nada proibido (D42) e todo texto usado existe', async () => {
  const { textos, glifos } = await ui();
  const { verificarConteudo } = await import(join(RAIZ, 'ferramentas/guarda-texto.mjs'));
  const src = readFileSync(fonte('ui/textos/u2b.js'), 'utf8');
  const falhas = verificarConteudo(src, ['travessao', 'aluguel', 'porDia', 'dia'], { js: true });
  assert.deepEqual(falhas, []);
  const faltam = [];
  for (const arq of ['ui/telas/Foto.jsx', 'ui/telas/Mural.jsx', 'ui/telas/corpo/Mural.jsx', 'ui/inicio/Abertura.jsx', 'ui/inicio/corpo/Inicio.jsx', 'ui/inicio/corpo/Configuracoes.jsx']) {
    for (const m of readFileSync(fonte(arq), 'utf8').matchAll(/\bt\(\s*'([^']+)'/g)) if (!textos.temTexto(m[1]) && m[1].startsWith('u2b.')) faltam.push(`${arq}: ${m[1]}`);
  }
  assert.deepEqual(faltam, []);
  // glifos usados existem
  const usados = new Set();
  for (const arq of ['ui/telas/Foto.jsx', 'ui/telas/corpo/Mural.jsx', 'ui/inicio/Abertura.jsx']) {
    for (const m of readFileSync(fonte(arq), 'utf8').matchAll(/(?:glifo:\s*|Glifo n=)["']([a-zA-Z0-9]+)["']/g)) usados.add(m[1]);
  }
  const sem = [...usados].filter((g) => !glifos.nomesGlifos().includes(g));
  assert.deepEqual(sem, [], 'glifos que não existem');
});
