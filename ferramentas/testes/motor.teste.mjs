// Testes da R1a (motor, luz, céu, neblina, sombra própria, câmera e sonda), sem navegador: o sol pela latitude e a
// lua pela fase; o modelo do céu na unidade do jogo (luz no chão, parte do céu, cor do sol, crepúsculo que cai sem
// voltar a subir, o anel do horizonte que a neblina e o céu dividem); a exposição; a luz do ar baixo da neblina (bem
// mais escura que o horizonte, indo até ele quando o caminho satura); a câmera à CS2 (limites, inércia, zoom com
// âncora, colisão, voo em arco); o raio contra o terreno; a sombra própria (encaixe no texel nas duas cascatas, a
// profundidade invertida, a cascata encolhida pelo sol baixo, a cidade instanciada compactada na cascata e o foco
// puxado para a câmera nas vistas rasantes); a contagem do GLSL contra a guarda do Mali; perfis e resolução
// dinâmica; quadros-chave da luz do ambiente; ruído das nuvens; e os ganchos publicados. Roda sozinho:
//   node --test ferramentas/testes/motor.teste.mjs (o simular --testes descobre)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { posicaoSol, posicaoLua, nascerEPor, faseDaLua, astros } from '../../fonte/render/ambiente/astro.js';
import * as C from '../../fonte/render/ambiente/ceu.js';
import { exposicaoAlvo, Exposicao, EXPOSICAO } from '../../fonte/render/ambiente/exposicao.js';
import { umidadeManha, luzDoAr, luzNoCaminho, henyeyGreenstein } from '../../fonte/render/ambiente/neblina.js';
import { ruidoNuvem, Nuvens } from '../../fonte/render/ambiente/nuvens.js';
import { horasChave, trecho } from '../../fonte/render/ambiente/ibl.js';
import { criarCamera, LIMITES_CAMERA } from '../../fonte/render/camera/camera.js';
import { raioNoTerreno, raioDaTela, projetarNaTela } from '../../fonte/render/camera/raio.js';
import { SombraPropria, COMPACTAR_ACIMA } from '../../fonte/render/sombra/mapa.js';
import { contarPrograma, preprocessar } from '../../fonte/render/motor/capacidades.js';
import { PERFIS, degrausDoPerfil } from '../../fonte/render/motor/perfis.js';
import { Resolucao } from '../../fonte/render/motor/resolucao.js';
import { lookNoAgxDoThree } from '../../fonte/render/motor/renderizador.js';
import { LOOK } from '../../fonte/render/motor/pos.js';
import { ehDeLonge, Faixas, CAMADA_LONGE } from '../../fonte/render/motor/faixas.js';
import { Sol } from '../../fonte/render/ambiente/sol.js';
import { registrar as registrarBancada } from '../../fonte/render/motor/bancada.js';
import { ganchos } from '../../fonte/render/motor/ganchos.js';
import { ALBEDOS, ALBEDO_MAXIMO, luminanciaAlbedo } from '../../fonte/render/materiais/biblioteca.js';
import { fragmentoCeu } from '../../fonte/render/materiais/shaders/ceu.glsl.js';
import { terrenoPlano } from '../../fonte/sim/substitutos.js';

const RAD = Math.PI / 180;
const astroEl = (grau, lua = { dir: [-0.3, -0.8, 0.3], elevacao: -0.9, iluminada: 0.9, fase: 0.42 }) => {
  const e = grau * RAD;
  return { sol: { dir: [Math.cos(e), Math.sin(e), 0], elevacao: e }, lua };
};

// ------------------------------------------------------------------------------------------------ astros

test('astro: sol pela latitude e pela hora; nascer e pôr; lua anda um oitavo por mês', () => {
  assert.ok(posicaoSol(12, 355, -23.5).dir[1] > 0.99, 'meio-dia no solstício de verão do sul: quase a pino');
  const manha = posicaoSol(7, 80, -23.5).dir;
  assert.ok(manha[0] > 0.5 && manha[1] > 0 && manha[1] < 0.4, 'às 7 h baixo a leste');
  assert.ok(posicaoSol(17, 80, -23.5).dir[0] < -0.5, 'às 17 h a oeste');
  assert.ok(posicaoSol(12, 172, -23.5).dir[2] < 0, 'no inverno do sul o sol fica ao norte (-z)');
  const { nascer, por } = nascerEPor(0, -23.5);
  assert.ok(nascer > 5 && nascer < 5.8 && por > 18.3 && por < 19, `verão: ${nascer.toFixed(2)} a ${por.toFixed(2)}`);
  const inv = nascerEPor(172, -23.5);
  assert.ok(inv.por - inv.nascer < por - nascer - 2, 'noites mais longas no inverno');
  assert.ok(Math.abs(posicaoSol(nascer, 0, -23.5).elevacao + 0.833 * RAD) < 0.2 * RAD, 'elevação no nascer');
  assert.ok(Math.abs(faseDaLua(1) - faseDaLua(0) - 0.125) < 1e-9);
  const cheia = posicaoLua(18.7, 0, 0, -23.5);
  assert.ok(cheia.iluminada > 0.9, 'perto da cheia no primeiro mês');
  const a = astros(21, { diaDoAno: 0, mes: 1, ano: 1 }, { latitude: -23.5 });
  assert.ok(a.dia === 0 && a.lua.dir[1] > 0.3, 'às 21 h: noite com a lua alta');
});

// ------------------------------------------------------------------------------------------------ céu

test('céu: a unidade do jogo (luz no chão = pi com o sol a 45 graus) e a parte do céu num dia limpo', () => {
  const est = C.estadoCeu(astroEl(45), { nuvens: 0.3 }, 0.6);
  assert.ok(Math.abs(est.eChao / Math.PI - 1) < 0.05, `eChao ${est.eChao}`);
  const ceu = C.luma(est.ceuIrr) / est.eChao;
  assert.ok(ceu > 0.12 && ceu < 0.3, `parte do céu ${ceu}`);
  for (const k of ['zenite', 'solIrr', 'luaIrr', 'ceuIrr']) assert.ok(est[k].every(Number.isFinite), k);
  assert.ok(Array.from(est.anel).every((x) => Number.isFinite(x) && x >= 0), 'anel');
});

test('céu: o sol esquenta ao baixar; o alto é azul; o crepúsculo cai sem voltar a subir', () => {
  const quente = (g) => {
    const s = C.estadoCeu(astroEl(g)).solIrr;
    return s[0] / s[2];
  };
  assert.ok(quente(8) > quente(25) && quente(25) > quente(60), 'vermelho/azul do sol cresce com o sol baixo');
  const z = C.estadoCeu(astroEl(45)).zenite;
  assert.ok(z[2] > z[1] && z[1] > z[0], 'zênite azul');
  let ant = Infinity;
  for (let g = 30; g >= -4; g -= 1) {
    const zl = C.luma(C.estadoCeu(astroEl(g)).zenite);
    assert.ok(zl <= ant * 1.02, `zênite subiu a ${g} graus: ${zl} depois de ${ant}`);
    ant = zl;
  }
  const noite = C.estadoCeu(astroEl(-30));
  assert.ok(noite.noite > 0.99 && C.luma(noite.zenite) > 0 && C.luma(noite.zenite) < 0.01, 'noite escura mas não preta');
  assert.ok(C.luma(noite.solIrr) === 0, 'sem sol de noite');
});

test('céu: o anel do horizonte acerta o céu (a neblina e o fundo se encontram, sem costura)', () => {
  for (const g of [70, 45, 25, 15]) {
    const est = C.estadoCeu({ ...astroEl(g), sol: { dir: [0.6 * Math.cos(g * RAD), Math.sin(g * RAD), 0.8 * Math.cos(g * RAD)], elevacao: g * RAD } });
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * 2 * Math.PI;
      const d = [Math.cos(a), 0.02, Math.sin(a)];
      const c = C.luma(C.corVista(d, est));
      const r = C.luma(C.radiancia(d, est.P));
      assert.ok(Math.abs(c - r) / r < 0.08, `sol a ${g} graus, azimute ${k * 10}: neblina ${c} contra céu ${r}`);
    }
  }
});

test('céu: as constantes do crepúsculo e da noite entram iguais no GLSL', () => {
  const f = fragmentoCeu({ K_CEU: C.K_CEU, CREPUSCULO: C.CREPUSCULO, NOITE: C.NOITE, LUA: C.LUA });
  assert.match(f, new RegExp(`K_CEU = ${C.K_CEU}`));
  assert.match(f, new RegExp(`min\\( e, 0.0 \\) \\* ${C.CREPUSCULO.queda}`));
  for (const v of [...C.CREPUSCULO.zenite, ...C.NOITE.zenite, ...C.LUA.ceu]) assert.ok(f.includes(String(v)), `constante ${v}`);
  assert.doesNotMatch(f, new RegExp('\\bmed' + 'iump\\b'));
});

// ------------------------------------------------------------------------------------------------ exposição

test('exposição: a chave com o sol a 45 graus, mais aberta no fim de tarde, teto de noite, troca suave', () => {
  assert.ok(Math.abs(exposicaoAlvo(Math.PI) - EXPOSICAO.chave) < 1e-9);
  const e45 = exposicaoAlvo(C.estadoCeu(astroEl(45)).eChao);
  const e10 = exposicaoAlvo(C.estadoCeu(astroEl(10)).eChao);
  const n = exposicaoAlvo(C.estadoCeu(astroEl(-30)).eChao);
  assert.ok(e10 > e45 && n >= e10, `${e45} ${e10} ${n}`);
  assert.equal(n, EXPOSICAO.maxima, 'a noite usa a exposição mínima legível (o teto)');
  // o fim de tarde fica mais escuro que o meio-dia na tela: a exposição não compensa toda a luz
  const eChao10 = C.estadoCeu(astroEl(10)).eChao;
  assert.ok(eChao10 * e10 < Math.PI * e45 * 0.7);
  const x = new Exposicao();
  x.atualizar({ eChao: Math.PI, noite: 0 }, 0);
  x.atualizar({ eChao: Math.PI * 0.8, noite: 0 }, 0.1);
  assert.ok(x.valor > EXPOSICAO.chave && x.valor < exposicaoAlvo(Math.PI * 0.8), 'suave');
  x.atualizar({ eChao: 0.001, noite: 1 }, 0.1);
  assert.equal(x.valor, EXPOSICAO.maxima, 'salto grande vai direto');
  assert.ok(x.limiarBloom < 1, 'limiar do bloom mais baixo de noite');
});

test('neblina: umidade da manhã sobe no nascer e some em ~3 h', () => {
  assert.ok(umidadeManha(5.6, 5.5) > 0.9);
  assert.equal(umidadeManha(12, 5.5), 0);
  assert.equal(umidadeManha(2, 5.5), 0);
});

test('neblina: a luz do ar baixo é bem mais escura que o horizonte e vai até ele quando o caminho satura', () => {
  const est = C.estadoCeu(astroEl(60), { nuvens: 0.3 }, 0.6);
  const ar = luzDoAr(est);
  const sol = est.P.sol;
  const lado = [-sol[2], 0.02, sol[0]]; // 90 graus do sol, rente ao chão
  const n = Math.hypot(...lado);
  const d = lado.map((x) => x / n);
  const hz = C.corVista(d, est);
  const perto = luzNoCaminho(d, [0.95, 0.95, 0.95], ar, sol, hz);
  assert.ok(C.luma(perto) < 0.5 * C.luma(hz), `perto ${C.luma(perto)} contra horizonte ${C.luma(hz)} (sem véu claro)`);
  const longe = luzNoCaminho(d, [0, 0, 0], ar, sol, hz);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(longe[i] - hz[i]) < 1e-9, 'caminho saturado: a cor do horizonte (sem costura)');
  assert.ok(henyeyGreenstein(0.95) > 10 * henyeyGreenstein(-0.95), 'claro na direção do sol, escuro de costas');
  assert.ok(ar.amb[2] > ar.amb[0], 'a parte ambiente é azulada (luz do céu)');
  const noite = luzDoAr(C.estadoCeu(astroEl(-30), { nuvens: 0.3 }, 0.6));
  assert.ok(C.luma(noite.sol) === 0 && noite.amb[0] > noite.amb[2] * 0.8, `de noite o ar leva o brilho da cidade: ${noite.amb}`);
});

// ------------------------------------------------------------------------------------------------ câmera e raio

function ctxCamera(T = terrenoPlano()) {
  return { camera: new THREE.PerspectiveCamera(40, 16 / 9, 0.5, 20000), sim: { espelho: { terreno: T, mapa: { tam: 8192 } } }, semClip: false };
}

test('câmera: limites do contrato (10 m a 9 km, 3 a 88 graus) e o mapa', () => {
  const cam = criarCamera(ctxCamera(), { dist: 500 });
  cam.definir({ dist: 1, inclinacao: -5, x: 1e6 });
  assert.deepEqual([cam.estado().dist, cam.estado().inclinacao, cam.estado().x], [LIMITES_CAMERA.distMin, LIMITES_CAMERA.incMin, 4096]);
  cam.definir({ dist: 1e6, inclinacao: 120 });
  assert.deepEqual([cam.estado().dist, cam.estado().inclinacao], [LIMITES_CAMERA.distMax, LIMITES_CAMERA.incMax]);
  cam.definir({ guinada: -30 });
  assert.equal(cam.estado().guinada, 330);
});

test('câmera: a inércia desliza e para; o zoom deixa a âncora parada', () => {
  const ctx = ctxCamera();
  const cam = criarCamera(ctx, { x: 0, z: 0, dist: 800, guinada: 0, inclinacao: 40 });
  cam.atualizar(0);
  cam.impulso({ vx: 100, vz: 0 });
  let t = 0;
  for (let i = 0; i < 200; i++) cam.atualizar((t += 16));
  const x1 = cam.estado().x;
  assert.ok(x1 > 20 && x1 < 40, `deslizou ${x1} m (100 m/s com amortecimento de 0,32 s)`);
  for (let i = 0; i < 60; i++) cam.atualizar((t += 16));
  assert.ok(Math.abs(cam.estado().x - x1) < 1e-6, 'parou');
  // zoom pela metade em volta de um ponto: ele fica onde estava em relação ao alvo, na mesma proporção
  cam.zoom(0.5, [200, 0, 100]);
  for (let i = 0; i < 200; i++) cam.atualizar((t += 16));
  const e = cam.estado();
  assert.ok(Math.abs(e.dist - 400) < 0.5, `dist ${e.dist}`);
  assert.ok(Math.abs(e.x - (200 + (x1 - 200) * 0.5)) < 0.5 && Math.abs(e.z - (100 + (0 - 100) * 0.5)) < 0.5, `alvo ${e.x}, ${e.z}`);
});

test('câmera: colisão com o chão e voo em arco que resolve', async () => {
  const T = terrenoPlano({ cota: 50 });
  const ctx = ctxCamera(T);
  const cam = criarCamera(ctx, { x: 0, z: 0, dist: 10, inclinacao: 3 });
  cam.atualizar(0);
  assert.ok(ctx.camera.position.y >= 52 - 1e-6, `acima do chão: ${ctx.camera.position.y}`);
  ctx.alturaCidade = () => 120; // a R1b põe o campo de alturas da cidade
  cam.atualizar(16);
  assert.ok(ctx.camera.position.y >= 122 - 1e-6, 'acima da cidade');
  delete ctx.alturaCidade;
  const antigo = globalThis.performance.now;
  let agora = 1000;
  globalThis.performance.now = () => agora;
  try {
    cam.definir({ x: 0, z: 0, dist: 400 });
    let chegou = false;
    cam.irPara({ x: 3000, z: 0, dist: 400 }, 1000).then(() => (chegou = true));
    agora = 1500;
    cam.atualizar(agora);
    assert.ok(cam.estado().dist > 400 + 500, `sobe em arco no meio do voo: ${cam.estado().dist}`);
    agora = 2100;
    cam.atualizar(agora);
    await Promise.resolve();
    assert.equal(chegou, true);
    assert.ok(Math.abs(cam.estado().x - 3000) < 1e-6 && Math.abs(cam.estado().dist - 400) < 1e-6);
  } finally {
    globalThis.performance.now = antigo;
  }
});

test('câmera: sobre o mar o alvo fica na água e a câmera não mergulha', () => {
  const T = terrenoPlano({ cota: -25 }); // baía de 25 m de fundo
  const ctx = ctxCamera(T);
  ctx.sim.espelho.mapa.nivelMar = 0;
  const cam = criarCamera(ctx, { x: 0, z: 0, dist: 10, inclinacao: 3 });
  cam.atualizar(0);
  assert.equal(cam.alvo().y, 0, 'alvo na superfície da água');
  assert.ok(ctx.camera.position.y >= 2 - 1e-6, `acima da água: ${ctx.camera.position.y}`);
  // sem o alvo HDR em ponto flutuante (testes, Leve, duas faixas) o plano próximo cresce com a altura
  assert.ok(ctx.camera.near >= 0.2 - 1e-9, `plano próximo ${ctx.camera.near}`);
});

test('câmera: fator de zoom ou impulso torto não trava a vista; o alvo fica no mapa pela origem', () => {
  const ctx = ctxCamera();
  const cam = criarCamera(ctx, { dist: 1800 });
  cam.atualizar(1000);
  cam.zoom(NaN);
  cam.zoom(0);
  cam.zoom(Infinity);
  cam.atualizar(1016);
  assert.equal(cam.estado().dist, 1800, 'o fator torto é ignorado');
  cam.zoom(0.5);
  for (let t = 1032; t < 4000; t += 16) cam.atualizar(t);
  assert.ok(Math.abs(cam.estado().dist - 900) < 1, `o zoom seguinte ainda funciona: ${cam.estado().dist}`);
  cam.impulso({ vx: NaN, vz: 5 });
  cam.mover(NaN, 3);
  cam.girar(Infinity);
  cam.atualizar(4016);
  const e = cam.estado();
  assert.ok(Number.isFinite(e.x) && Number.isFinite(e.z) && Number.isFinite(e.guinada) && e.x === 0, JSON.stringify(e));
  // mapa fora do centro: o alvo fica entre a origem e a origem mais o lado
  ctx.sim.espelho.mapa = { tam: 4096, origem: [0, -1000] };
  cam.definir({ x: -50, z: 5000 });
  assert.deepEqual([cam.estado().x, cam.estado().z], [0, 3096]);
});

test('raio: acerta o chão plano, a encosta e não acerta subindo', () => {
  const T = terrenoPlano({ cota: 5 });
  const p = raioNoTerreno(T, { origem: [0, 105, 0], dir: [0.6, -0.8, 0] });
  assert.ok(Math.abs(p[1] - 5) < 1e-3 && Math.abs(p[0] - 75) < 0.01, JSON.stringify(p));
  assert.equal(raioNoTerreno(T, { origem: [0, 105, 0], dir: [0, 1, 0] }, { maxDist: 2000 }), null);
  // rampa de 30% para leste: z = 0,3 x
  const R = terrenoPlano();
  for (let j = 0; j < R.n; j++) for (let i = 0; i < R.n; i++) R.altura[j * R.n + i] = Math.max(0, 0.3 * (R.origem[0] + i * R.passo));
  const d = new THREE.Vector3(1, -0.1, 0.2).normalize();
  const q = raioNoTerreno(R, { origem: [-200, 60, 0], dir: [d.x, d.y, d.z] });
  assert.ok(q && Math.abs(q[1] - Math.max(0, 0.3 * q[0])) < 0.05, `na rampa: ${q}`);
  const cam = new THREE.PerspectiveCamera(40, 2, 1, 1000);
  cam.position.set(0, 100, 0);
  cam.lookAt(0, 0, -100);
  cam.updateMatrixWorld();
  const r = raioDaTela(cam, 1000, 500, 500, 250);
  assert.ok(Math.abs(Math.hypot(...r.dir) - 1) < 1e-9 && r.dir[1] < 0 && r.dir[2] < 0);
});

test('projetar: com a profundidade invertida um ponto atrás da câmera não passa por visível', () => {
  const cam = new THREE.PerspectiveCamera(40, 2, 0.1, 100000);
  cam.position.set(0, 100, 0);
  cam.lookAt(0, 100, -100);
  cam.updateMatrixWorld();
  cam._reversedDepth = true; // o three liga isto no primeiro desenho com EXT_clip_control
  cam.updateProjectionMatrix();
  const atras = new THREE.Vector3(0, 100, 50).project(cam);
  assert.ok(atras.z > -1 && atras.z < 1, 'o z da tela sozinho não separa frente e trás (o erro do teste antigo)');
  assert.equal(projetarNaTela(cam, 1000, 500, [0, 100, 50]).visivel, false);
  const frente = projetarNaTela(cam, 1000, 500, [0, 100, -50]);
  assert.ok(frente.visivel && Math.abs(frente.x - 500) < 1e-6 && Math.abs(frente.y - 250) < 1e-6 && Math.abs(frente.dist - 50) < 1e-9);
});

// ------------------------------------------------------------------------------------------------ sombra própria

test('sombra: encaixe no texel nas duas cascatas, atlas e profundidade invertida', () => {
  const s = new SombraPropria({ tam: 1024, cascatas: 2 });
  assert.equal(s.alvo.width, 2048);
  assert.equal(s.alvo.height, 1024);
  const sol = new THREE.Vector3(-0.3, 0.7, 0.6).normalize();
  const fase = (m) => {
    const p = new THREE.Vector3(0, 0, 0).applyMatrix4(m);
    return [p.x * s.tam, p.y * s.tam].map((v) => v - Math.floor(v));
  };
  s.acompanhar(new THREE.Vector3(0, 0, 0), 600, sol);
  const f0 = [fase(s.matriz), fase(s.matriz1)];
  assert.ok(s.raioPerto < 600 && s.raioPerto >= 40, 'cascata de perto menor');
  s.acompanhar(new THREE.Vector3(133.37, 0, -71.9), 600, sol);
  const f1 = [fase(s.matriz), fase(s.matriz1)];
  for (let c = 0; c < 2; c++) for (let k = 0; k < 2; k++) {
    const d = Math.abs(f1[c][k] - f0[c][k]);
    assert.ok(d < 1e-3 || Math.abs(d - 1) < 1e-3, `cascata ${c}: ${f0[c]} contra ${f1[c]}`);
  }
  // o sol dentro do degrau não refaz; passando dele, refaz
  s.sujo = false;
  const girado = sol.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.5 * s.degrau);
  assert.equal(s.acompanhar(new THREE.Vector3(133.37, 0, -71.9), 600, girado), false);
  const passou = sol.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 2 * s.degrau); // em volta do eixo vertical o ângulo real é menor (cos da elevação)
  assert.equal(s.acompanhar(new THREE.Vector3(133.37, 0, -71.9), 600, passou), true);
  // profundidade invertida: um ponto no plano perto da luz vai a z = 1 (a comparação troca, o viés troca de sinal)
  const alvos = [];
  const renderer = { state: { buffers: { depth: { getReversed: () => true } } }, getRenderTarget: () => null, setRenderTarget: (a) => alvos.push(a), clear() {} };
  const u = Object.fromEntries(Object.entries(ganchos.uniformes).map(([k, v]) => [k, { value: v.value?.clone ? v.value.clone() : v.value }]));
  // sem sombra (Leve) o gSombraMapa ainda recebe uma textura de profundidade já criada na GPU: um sampler2DShadow
  // ligado a nada faz o WebGL recusar todas as chamadas dos materiais com o gancho
  s.ligada = false;
  s.desenhar(renderer, null, u);
  assert.equal(u.gSombraMapa.value, s.alvo.depthTexture);
  assert.equal(u.gSombraLigada.value, 0);
  assert.ok(alvos.includes(s.alvo), 'o alvo foi limpo uma vez (a DepthTexture existe antes de ser lida)');
  s.ligada = true;
  s.desenhar(renderer, null, u);
  assert.equal(s.invertida, true);
  assert.equal(s.alvo.depthTexture.compareFunction, THREE.GreaterEqualCompare);
  assert.ok(u.gSombraVies.value < 0);
  const cam = s.cams[0];
  const perto = new THREE.Vector3(0, 0, -cam.near).applyMatrix4(cam.matrixWorld).applyMatrix4(s.matriz);
  assert.ok(Math.abs(perto.z - 1) < 1e-4, `z do plano perto: ${perto.z}`);
  s.descartar();
});

test('sombra: a cidade instanciada projeta só a vizinhança da cascata, e com o sol baixo a cascata encolhe na direção dele', () => {
  const s = new SombraPropria({ tam: 1024, cascatas: 1 });
  const n = 4000;
  const cidade = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshBasicMaterial(), n);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    const x = ((i % 64) - 32) * 60 + 7;
    const z = (Math.floor(i / 64) - 31) * 60 + 11;
    cidade.setMatrixAt(i, m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(20, 10 + (i % 7) * 15, 20)));
  }
  const g = s.projetor(cidade, { compactar: true });
  assert.notEqual(g.instanceMatrix, cidade.instanceMatrix, 'buffer próprio na compactada');
  const falso = { state: { buffers: { depth: { getReversed: () => false } } }, autoClear: true, getRenderTarget: () => null, setRenderTarget() {}, render() {}, clear() {} };
  const alto = new THREE.Vector3(0.2, 0.95, 0.1).normalize();
  s.acompanhar(new THREE.Vector3(0, 0, 0), 600, alto);
  s.desenhar(falso, null, null);
  const cam = s.cams[0];
  assert.ok(g.count > 100 && g.count < 0.25 * n, `sol alto: ${g.count} de ${n} projetam`);
  // toda instância copiada está perto do quadrado da cascata no chão
  const v = new THREE.Vector3();
  for (let i = 0; i < g.count; i++) {
    v.setFromMatrixPosition(m.fromArray(g.instanceMatrix.array, i * 16));
    assert.ok(Math.hypot(v.x, v.z) < 600 * 1.5 + 200, `instância longe demais: ${v.x}, ${v.z}`);
  }
  const baixo = new THREE.Vector3(0.95, Math.sin(12 * RAD), 0.2).normalize();
  s.acompanhar(new THREE.Vector3(0, 0, 0), 600, baixo);
  s.desenhar(falso, null, null);
  assert.ok(cam.top - cam.bottom < 0.6 * (cam.right - cam.left), `sol a 12 graus: ${cam.top - cam.bottom} por ${cam.right - cam.left}`);
  assert.ok(g.count < 0.3 * n, `sol baixo: ${g.count} projetam (a faixa comprida no chão ficou de fora)`);
  const pequeno = new THREE.InstancedMesh(cidade.geometry, cidade.material, 3);
  assert.equal(s.projetor(pequeno).instanceMatrix, pequeno.instanceMatrix, 'a pequena compartilha o buffer');
  const enorme = new THREE.InstancedMesh(cidade.geometry, cidade.material, COMPACTAR_ACIMA + 1);
  assert.notEqual(s.projetor(enorme).instanceMatrix, enorme.instanceMatrix, 'acima do limite compacta sozinha');
  s.descartar();
});

test('sombra: nas vistas rasantes o foco anda para baixo da câmera sem tirar o alvo da cascata; de cima fica no alvo', () => {
  const s = new SombraPropria({ tam: 1024, cascatas: 1 });
  const alvo = new THREE.Vector3(100, 10, 200);
  s.vista = { position: new THREE.Vector3(100, 10 + 1800 * Math.sin(3 * RAD), 200 + 1800 * Math.cos(3 * RAD)) };
  const raio = 1080;
  const f = s.foco(alvo, raio, new THREE.Vector3());
  const andou = f.z - alvo.z;
  assert.ok(andou > 500 && andou <= 0.7 * raio + 1e-6 && Math.abs(f.x - alvo.x) < 1e-9, `rasante: ${andou} m para a câmera`);
  s.vista.position.set(100, 10 + 1800, 200 + 1800 * Math.cos(88 * RAD));
  assert.ok(s.foco(alvo, raio, new THREE.Vector3()).distanceTo(alvo) < 1, 'de cima o foco é o alvo');
  s.vista = null;
  assert.ok(s.foco(alvo, raio, new THREE.Vector3()).equals(alvo), 'sem a câmera da vista, o alvo');
  // a região publicada aos domínios (projetores) é o foco e o raio do mapa, e só existe depois do primeiro acompanhar
  assert.equal(s.regiao, null, 'sem mapa, sem região');
  s.vista = { position: new THREE.Vector3(100, 10 + 1800 * Math.sin(3 * RAD), 200 + 1800 * Math.cos(3 * RAD)) };
  s.acompanhar(alvo, raio, new THREE.Vector3(-0.9, 0.3, 0.3));
  const r = s.regiao;
  assert.ok(r && r.raio === raio && r.z - alvo.z > 500 && Math.abs(r.x - alvo.x) < 1e-9, `região ${JSON.stringify(r)}`);
  s.descartar();
});

test('sombra: a instanciada pequena (buffer compartilhado) refaz o mapa quando as instâncias mudam, sem marcar()', () => {
  const s = new SombraPropria({ tam: 256, cascatas: 1 });
  const lista = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 8);
  s.projetor(lista);
  let passes = 0;
  const falso = { state: { buffers: { depth: { getReversed: () => false } } }, autoClear: true, getRenderTarget: () => null, setRenderTarget() {}, render: () => passes++, clear() {} };
  s.acompanhar(new THREE.Vector3(), 300, new THREE.Vector3(0.3, 0.8, 0.2));
  s.desenhar(falso, null, null);
  const p0 = passes;
  s.desenhar(falso, null, null);
  assert.equal(passes, p0, 'parado: nenhum passe novo');
  lista.setMatrixAt(3, new THREE.Matrix4().makeTranslation(40, 0, 0));
  lista.instanceMatrix.needsUpdate = true; // a versão do buffer sobe
  s.desenhar(falso, null, null);
  assert.equal(passes, p0 + 1, 'instância mexida: um passe novo');
  s.desenhar(falso, null, null);
  assert.equal(passes, p0 + 1);
  s.descartar();
});

// ------------------------------------------------------------------------------------------------ sonda e guarda

test('guarda do Mali: conta amostradores por estágio, varyings, uniformes e atributos no GLSL ativo', () => {
  const vs = `#version 300 es
#define SHADER_NAME prova
#define N 4
in vec3 position;
in vec2 uv;
#ifdef NAO
in vec4 extra;
#endif
uniform mat4 m;
uniform vec3 v[N];
out vec2 vUv;
out vec3 vPos;
void main() { vUv = uv; vPos = position; gl_Position = m * vec4( position, 1.0 ); }`;
  const fs = `#version 300 es
precision highp float;
#define SHADER_NAME prova
uniform sampler2D a;
uniform sampler2D b[3];
uniform highp sampler2DShadow s;
uniform mat3 k;
uniform vec4 c;
in vec2 vUv;
in vec3 vPos;
out vec4 cor;
void main() { cor = texture( a, vUv ) * c; }`;
  const r = contarPrograma(vs, fs);
  assert.equal(r.nome, 'prova');
  assert.deepEqual(r.amostradores, { v: 0, f: 5 });
  assert.equal(r.varyings, 2);
  assert.equal(r.atributos, 2, 'o atributo dentro do #ifdef inativo não conta');
  assert.equal(r.uniformesF, 4);
  assert.equal(r.uniformesV, 8);
  assert.deepEqual(r.falhas, []);
  const muitos = fs.replace('uniform sampler2D b[3];', 'uniform sampler2D b[12];');
  assert.match(contarPrograma(vs, muitos).falhas.join(), /amostradores no fragmento/);
  const media = fs.replace('precision highp float;', 'precision ' + 'med' + 'iump float;');
  assert.match(contarPrograma(vs, media).falhas.join(), /precisão média/);
  const pmrem = contarPrograma(vs.replace('SHADER_NAME prova', 'SHADER_NAME PMREMGGXConvolution'), media.replace('SHADER_NAME prova', 'SHADER_NAME PMREMGGXConvolution'));
  assert.ok(pmrem.precisaoMedia && pmrem.falhas.length === 0, 'o PMREM do three fica anotado, sem falha (a D44 vale para os shaders próprios)');
  assert.equal(contarPrograma('#define SHADER_TYPE MeshStandardMaterial\n#define SHADER_NAME \n' + vs.replace('#define SHADER_NAME prova\n', ''), fs.replace('#define SHADER_NAME prova\n', '')).nome, 'MeshStandardMaterial');
  assert.equal(preprocessar('#if defined(A) && B > 2\nx\n#else\ny\n#endif').texto.trim(), 'y');
});

test('perfis: Média com cubo do céu, 1 cascata e degrau de 1,5 grau; PC com céu direto e 2 cascatas', () => {
  assert.equal(PERFIS.media.ceu.modo, 'cubo');
  assert.equal(PERFIS.media.ceu.cubo, 256);
  assert.equal(PERFIS.media.sombra.cascatas, 1);
  assert.equal(PERFIS.media.sombra.degrau, 1.5);
  assert.equal(PERFIS.ultra.ceu.modo, 'direto');
  assert.equal(PERFIS.ultra.sombra.cascatas, 2);
  assert.equal(PERFIS.ultra.sombra.degrau, 1);
  assert.equal(PERFIS.leve.pos, false);
  assert.deepEqual(degrausDoPerfil(PERFIS.media, 2.75), [0.85, 1, 1.15, 1.3]);
  assert.deepEqual(degrausDoPerfil(PERFIS.media, 1), [0.85, 1]);
});

test('look: o AgX do three (Leve, sem pós) ganha a mesma curva da composição, uma vez, antes da matriz de saída', () => {
  const puro = THREE.ShaderChunk.tonemapping_pars_fragment.replace(/\n\t\/\/ look da Holding\n[^\n]*\n[^\n]*/, '');
  const copia = { tonemapping_pars_fragment: puro };
  assert.ok(!puro.includes('look da Holding') && puro.includes('agxDefaultContrastApprox( color )'), 'o AgX puro do three');
  assert.equal(lookNoAgxDoThree(copia), true);
  const src = copia.tonemapping_pars_fragment;
  assert.ok(src.includes(`vec3( ${LOOK.potencia} )`) && src.includes(`color, ${LOOK.saturacao} )`), 'potência e saturação do LOOK');
  const agx = src.slice(src.indexOf('vec3 AgXToneMapping'));
  assert.ok(agx.indexOf('look da Holding') > agx.indexOf('color = agxDefaultContrastApprox( color )'), 'depois da sigmoide');
  assert.ok(agx.indexOf('look da Holding') < agx.indexOf('color = AgXOutsetMatrix * color'), 'antes da saída');
  assert.equal(lookNoAgxDoThree(copia), true);
  assert.equal(copia.tonemapping_pars_fragment, src, 'idempotente');
  assert.equal(lookNoAgxDoThree({ tonemapping_pars_fragment: 'vec3 AgXToneMapping( vec3 c ) { return c; }' }), false, 'sem o lugar, fica o AgX puro');
});

test('resolução dinâmica: desce depois de 2 janelas lentas e sobe depois de 5 boas e 10 s', () => {
  const ctx = { perfil: PERFIS.media, pr: 1.3 };
  const r = new Resolucao(ctx, { fixa: false });
  Object.defineProperty(r, 'dpr', { value: 2.75 });
  assert.equal(r.ajustar(50, 33.3, 1000), false);
  assert.equal(r.ajustar(50, 33.3, 2000), true);
  assert.equal(ctx.pr, 1.15);
  assert.ok(r.cas > 0, 'CAS liga abaixo do nominal');
  for (let i = 0; i < 4; i++) assert.equal(r.ajustar(20, 33.3, 3000 + i * 1000), false);
  assert.equal(r.ajustar(20, 33.3, 7000), false, 'antes de 10 s da descida não sobe');
  for (let i = 0; i < 5; i++) r.ajustar(20, 33.3, 13000 + i * 1000);
  assert.equal(ctx.pr, 1.3);
  assert.equal(r.cas, 0);
});

test('luz do ambiente: 8 quadros-chave em ordem e o trecho cíclico da hora', () => {
  const h = horasChave(nascerEPor(0, -23.5));
  assert.equal(h.length, 8);
  for (let i = 1; i < 8; i++) assert.ok(h[i] > h[i - 1]);
  const tr = trecho(h, 12.01);
  assert.ok(tr.t >= 0 && tr.t < 1 && h[tr.i] <= 12.01);
  const noite = trecho(h, 23.9);
  assert.ok(noite.t >= 0 && noite.t <= 1);
  const madrugada = trecho(h, h[0] - 0.01 < 0 ? 23.99 : h[0] - 0.01);
  assert.equal(madrugada.j, 0, 'a hora antes do primeiro quadro-chave cai no trecho que dá a volta');
});

test('nuvens: ruído azulejável e na faixa inteira', () => {
  const n = 64;
  const r = ruidoNuvem(n, 4, 3);
  assert.equal(r.length, n * n);
  assert.equal(Math.min(...r), 0);
  assert.equal(Math.max(...r), 255);
  let borda = 0;
  for (let y = 0; y < n; y++) borda = Math.max(borda, Math.abs(r[y * n] - r[y * n + n - 1]));
  assert.ok(borda < 40, `emenda na borda: ${borda}`);
});

test('nuvens: a deriva soma o vento de cada quadro (trocar o vento não teleporta as nuvens) e fica na fração da textura', () => {
  let hora = 10;
  const u = { gNuvemMapa: { value: null }, gNuvemParams: { value: new THREE.Vector4() }, gNuvemDesloc: { value: new THREE.Vector4() } };
  const n = new Nuvens({ ganchos: { uniformes: u }, horaDoCeu: () => hora });
  const ceu = { nuvem: new THREE.Vector4(), nuvemPasso: new THREE.Vector2() };
  const est = { P: { sol: [0.3, 0.9, 0.1] } };
  n.atualizar(0, { nuvens: 0.4, vento: [1, 0] }, est, ceu);
  for (let k = 0; k < 400; k++) {
    hora = (hora + 0.25) % 24;
    n.atualizar(0, { nuvens: 0.4, vento: [1, 0] }, est, ceu);
  }
  const antes = [u.gNuvemDesloc.value.x, u.gNuvemDesloc.value.y, ceu.nuvemPasso.x, ceu.nuvemPasso.y];
  hora = (hora + 0.25) % 24;
  n.atualizar(0, { nuvens: 0.4, vento: [0, 1] }, est, ceu);
  const depois = [u.gNuvemDesloc.value.x, u.gNuvemDesloc.value.y, ceu.nuvemPasso.x, ceu.nuvemPasso.y];
  assert.ok(Math.abs(depois[0] - antes[0]) < 1e-9 && Math.abs(depois[1] - antes[1]) < 0.05, `sombra no chão: ${antes} para ${depois}`);
  assert.ok(Math.abs(depois[2] - antes[2]) < 1e-9 && Math.abs(depois[3] - antes[3]) < 0.01, `céu: ${antes} para ${depois}`);
  assert.ok(Math.abs(antes[0]) < 1 && Math.abs(depois[1]) < 1, 'deriva do chão dentro da fração da textura');
  n.descartar();
});

// ------------------------------------------------------------------------------------------------ ganchos e materiais

test('ganchos: sombra com cascatas e nuvens, neblina com o anel do horizonte, nomes estáveis', () => {
  for (const u of ['gSombraMapa', 'gSombraMatriz', 'gSombraMatriz1', 'gSombraCascatas', 'gSombraAmostras', 'gSombraForca', 'gNuvemMapa', 'gNuvemParams', 'gNuvemDesloc', 'gNeblinaBeta', 'gNeblinaQueda', 'gNeblinaAnel', 'gNeblinaZenite', 'gNeblinaSolDir', 'gNeblinaSolCor', 'gNeblinaAmb', 'gNeblinaG', 'gNeblinaCor']) {
    assert.ok(u in ganchos.uniformes, u);
  }
  assert.equal(ganchos.uniformes.gNeblinaAnel.value.length, C.ANEL);
  const t = ganchos.trechos(['sombra', 'neblina']);
  assert.match(t.fragmentoPars, /uniform highp sampler2DShadow gSombraMapa/);
  assert.match(t.fragmentoPars, /gNeblinaCorVista/);
  assert.match(t.fragmentoPars, /gNeblinaLuz/);
  assert.ok(ganchos.uniformes.gNeblinaCor.value.isColor, 'gNeblinaCor (nome da F0) segue uma cor do three para os shaders próprios');
  assert.match(t.sol, /gNuvemSombra/);
  assert.ok(ehDeLonge({ userData: { familia: 'terreno' } }) && !ehDeLonge({ userData: { familia: 'predios' } }));
});

test('faixas: a camada de longe desce pela árvore inteira e sai de quem deixa de ser de longe', () => {
  const cena = new THREE.Scene();
  const grupo = new THREE.Group();
  grupo.userData.faixa = 'longe';
  const sub = new THREE.Group();
  const malha = new THREE.Mesh(new THREE.BufferGeometry());
  sub.add(malha);
  grupo.add(sub);
  const perto = new THREE.Mesh(new THREE.BufferGeometry());
  const luz = new THREE.DirectionalLight();
  const outro = new THREE.Group();
  outro.add(luz); // luz dentro de um grupo: entra nas duas faixas (a mesma contagem de luzes nos dois passes)
  cena.add(grupo, perto, outro);
  const f = new Faixas({ semClip: true });
  f.marcar(cena);
  const longe = (o) => o.layers.isEnabled(CAMADA_LONGE);
  assert.ok(longe(malha) && longe(sub) && longe(grupo), 'as malhas dentro do grupo de longe vão para a faixa de longe');
  assert.ok(!longe(perto), 'o resto fica só na de perto');
  assert.ok(longe(luz), 'a luz aninhada vai para as duas faixas');
  grupo.userData.faixa = null;
  f.marcar(cena);
  assert.ok(!longe(malha) && !longe(grupo), 'saiu da faixa de longe');
});

test('faixas: sem EXT_clip_control, o que passa do corte da faixa de perto entra também na de longe (o mar e a cidade não somem num risco)', () => {
  const cena = new THREE.Scene();
  const caixa = new THREE.BoxGeometry(10, 10, 10);
  const perto = new THREE.Mesh(caixa, new THREE.MeshBasicMaterial());
  perto.position.set(0, 0, -500);
  const alem = new THREE.Mesh(caixa, new THREE.MeshBasicMaterial());
  alem.position.set(0, 0, -5000);
  const mar = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
  mar.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7); // extensão desconhecida, como o mar
  const cidade = new THREE.InstancedMesh(caixa, new THREE.MeshBasicMaterial(), 4); // sem esfera das instâncias
  const vidro = new THREE.Mesh(caixa, new THREE.MeshBasicMaterial({ transparent: true }));
  vidro.position.set(0, 0, -5000);
  const fixo = new THREE.Mesh(caixa, new THREE.MeshBasicMaterial());
  fixo.position.set(0, 0, -5000);
  fixo.userData.faixa = 'perto';
  cena.add(perto, alem, mar, cidade, vidro, fixo);
  cena.updateMatrixWorld(true);
  const cam = new THREE.PerspectiveCamera();
  const f = new Faixas({ semClip: true });
  f.marcar(cena, cam, 3060);
  const longe = (o) => o.layers.isEnabled(CAMADA_LONGE);
  assert.ok(!longe(perto), 'a malha perto fica só na de perto');
  assert.ok(longe(alem) && longe(mar) && longe(cidade), 'além do corte, o mar e a lista da cidade inteira vão também para a de longe');
  assert.ok(!longe(vidro), 'a transparente não entra duas vezes (a cor somaria na sobreposição)');
  assert.ok(!longe(fixo), "userData.faixa = 'perto' fica só na de perto");
  alem.position.set(0, 0, -100);
  alem.updateMatrixWorld();
  f.marcar(cena, cam, 3060);
  assert.ok(!longe(alem), 'voltou para perto: sai da de longe');
});

test('sol: a luz direcional nunca some (o número de luzes não muda entre o dia e a noite sem lua)', () => {
  const cena = new THREE.Scene();
  const ctx = { cena, camera: new THREE.PerspectiveCamera(), sol: { dir: new THREE.Vector3() }, sombra: null };
  const sol = new Sol(ctx);
  const dia = astroEl(40);
  sol.atualizar(dia, { solIrr: [3, 3, 3], luaIrr: [0, 0, 0] });
  assert.ok(sol.luz.visible && sol.luz.intensity > 1);
  const noiteSemLua = astroEl(-30, { dir: [0, -1, 0], elevacao: -1.5, iluminada: 0, fase: 0 });
  sol.atualizar(noiteSemLua, { solIrr: [0, 0, 0], luaIrr: [0, 0, 0] });
  assert.equal(sol.luz.visible, true, 'visível com intensidade 0: esconder trocaria o programa de todo material');
  assert.equal(sol.luz.intensity, 0);
  sol.descartar();
});

test('bancada: a medida trava a resolução só enquanto mede e devolve o relatório do contrato', async () => {
  let fabrica = null;
  registrarBancada({ registrarDominio: (nome, f) => (fabrica = f) });
  const stats = { calls: 120, tris: 400000, callsSombra: 3, trisSombra: 20000, msaa: 2, alvo: 'r11g11b10', familias: {}, gpuMs: 0, gpuMsTimer: 0 };
  const ctx = {
    gpu: 'Mali-G615 MC2', perfil: { id: 'media', nome: 'Média' }, pr: 1, medidas: { stats },
    capac: { programas: { lista: [] }, clipControl: true, invertida: true, multiDraw: false, timer: false, limites: {}, sonda: {} },
    quadro: { resolucao: { fixa: false } },
  };
  const dom = fabrica(ctx);
  const p = ctx.bancada({ quadros: 3 });
  assert.equal(ctx.quadro.resolucao.fixa, true, 'travada durante a medida');
  for (let t = 0; t <= 80; t += 20) dom.quadro(t);
  const rel = await p;
  assert.equal(ctx.quadro.resolucao.fixa, false, 'a resolução dinâmica volta depois da medida');
  assert.equal(ctx.medirGpu, false);
  for (const k of ['perfil', 'sugerido', 'msMedio', 'p95', 'qps', 'calls', 'tris', 'pior', 'gpuMs', 'familias', 'programas', 'capac']) assert.ok(k in rel, k);
  assert.equal(rel.sugerido, 'media');
  assert.equal(rel.pior.calls, 120);
  dom.descartar();
  assert.equal(ctx.bancada, undefined);
});

test('biblioteca: albedos reais, nada acima de 0,80, grama oliva', () => {
  for (const [k, a] of Object.entries(ALBEDOS)) {
    if (a.metal) continue;
    assert.ok(Math.max(...a.cor) <= ALBEDO_MAXIMO, `${k} acima do teto`);
  }
  const g = ALBEDOS.grama.cor;
  assert.ok(luminanciaAlbedo(g) < 0.2 && g[1] > g[0] && g[0] > g[2], 'grama escura e oliva');
  assert.ok(luminanciaAlbedo(ALBEDOS.asfaltoNovo.cor) > 0.03, 'asfalto nunca preto');
});
