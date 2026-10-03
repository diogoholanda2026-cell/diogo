// Testes da R1a (motor, luz, céu, neblina, sombra própria, câmera e sonda), sem navegador: o sol pela latitude e a
// lua pela fase; o modelo do céu na unidade do jogo (luz no chão, parte do céu, cor do sol, crepúsculo que cai sem
// voltar a subir, o anel do horizonte que a neblina e o céu dividem); a exposição; a luz do ar baixo da neblina (bem
// mais escura que o horizonte, indo até ele quando o caminho satura); a câmera à CS2 (limites, inércia, zoom com
// âncora, colisão, voo em arco); o raio contra o terreno; a sombra própria (encaixe no texel nas duas cascatas, a
// profundidade invertida, a cascata encolhida pelo sol baixo, a cidade instanciada compactada na cascata e o foco
// puxado para a câmera nas vistas rasantes); a contagem do GLSL contra a guarda do Mali; perfis e resolução
// dinâmica; quadros-chave da luz do ambiente; ruído das nuvens; e os ganchos publicados. Da PC1 (D66): a escolha do
// perfil pelo nome da placa (a RX 550 do dono no 'pc'), o perfil 'pc' e os tetos dele, o controle da resolução pelo
// cronômetro da placa (desce, sobe, não oscila, trava a subida desfeita), o teto de 60 qps, o cronômetro por passe, a
// memória de vídeo estimada, o aquecimento dos programas e a vigia das compilações depois de pronto. Roda sozinho:
//   node --test ferramentas/testes/motor.teste.mjs (o simular --testes descobre)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
import {
  contarPrograma, preprocessar, vigiarProgramas, marcarPronto, desmarcarPronto, compilacoesDepois, bytesDoNivel,
  bytesDoArmazenamento, vigiarMemoria,
} from '../../fonte/render/motor/capacidades.js';
import {
  PERFIS, degrausDoPerfil, escolherPerfil, sugerirPerfil, nomeDaPlaca, razaoDePixels, porPerfil, orcamentoDoPerfil,
  ORDEM_PERFIS,
} from '../../fonte/render/motor/perfis.js';
import { Resolucao, ControleResolucao } from '../../fonte/render/motor/resolucao.js';
import { Aquecimento, Ritmo, AQUECER } from '../../fonte/render/motor/quadro.js';
import { Cronometro, Medidas, classeDoDesenho, PASSES_GPU } from '../../fonte/render/motor/medidas.js';
import { FAMILIAS } from '../../fonte/contratos/render.js';
import { lookNoAgxDoThree } from '../../fonte/render/motor/renderizador.js';
import { LOOK, forcaCas } from '../../fonte/render/motor/pos.js';
import { Quadro } from '../../fonte/render/motor/quadro.js';
import { ehDeLonge, Faixas, CAMADA_LONGE } from '../../fonte/render/motor/faixas.js';
import { Sol } from '../../fonte/render/ambiente/sol.js';
import { registrar as registrarBancada, ligacao } from '../../fonte/render/motor/bancada.js';
import { ganchos } from '../../fonte/render/motor/ganchos.js';
import { ALBEDOS, ALBEDO_MAXIMO, luminanciaAlbedo } from '../../fonte/render/materiais/biblioteca.js';
import { fragmentoCeu, CEU_VERTICE } from '../../fonte/render/materiais/shaders/ceu.glsl.js';
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
  // frente e prof (C1b): o traçado sugerido corta no plano próximo pela prof, que é afim no mundo
  const tras = projetarNaTela(cam, 1000, 500, [0, 100, 50]);
  assert.equal(tras.frente, false);
  assert.ok(Math.abs(tras.prof + 50) < 1e-9 && Math.abs(frente.prof - 50) < 1e-9 && frente.frente);
  const fora = projetarNaTela(cam, 1000, 500, [5000, 100, -50]);
  assert.ok(fora.frente && !fora.visivel, 'fora da tela mas na frente');
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

test('perfis: Média com cubo do céu, 1 cascata e degrau de 1,5 grau; Ultra com céu direto e 2 cascatas', () => {
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
  // o que a PC1 acrescentou para a medida no PC do dono
  for (const k of ['motivo', 'resolucao', 'gpuPasses', 'memoria', 'aquecimento', 'compilacoes']) assert.ok(k in rel, k);
  assert.equal(rel.sugerido, 'media');
  assert.match(rel.motivo, /Mali-G615 MC2/);
  assert.deepEqual(rel.compilacoes.depois, []);
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

// ------------------------------------------------------------------------------------------------ PC do dono (PC1)

test('perfis: a escolha pelo nome da placa põe a RX 550 do dono no PC, não no Ultra', () => {
  const casos = [
    ['ANGLE (AMD, Radeon RX 550 Series (0x000067FF) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'pc'],
    ['ANGLE (AMD, AMD Radeon RX 550 / 550 Series (polaris12, LLVM 15.0.7, DRM 3.49, 6.1.0), OpenGL 4.6)', 'pc'],
    ['ANGLE (NVIDIA, NVIDIA GeForce GTX 1050 Ti (0x00001C82) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'pc'],
    ['ANGLE (NVIDIA, NVIDIA GeForce GTX 750 Ti (0x00001380) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'pc'],
    ['ANGLE (AMD, Radeon RX 560 Series (0x000067EF) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'pc'],
    ['ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 (0x00001F82) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'alta'],
    ['ANGLE (AMD, Radeon RX 580 Series (0x000067DF) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'alta'],
    ['ANGLE (AMD, AMD Radeon RX 5500 XT (0x00007340) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'alta'],
    ['ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'ultra'],
    ['ANGLE (Intel, Intel(R) UHD Graphics 630 (0x00003E92) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'media'],
    ['ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'pc'],
    ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)', 'leve'],
    ['ANGLE (Unknown, Placa Qualquer 9000)', 'pc'],
  ];
  for (const [gpu, id] of casos) assert.equal(sugerirPerfil({ gpu }), id, gpu);
  // o celular do dono continua no Média (D33), no celular e fora dele; um celular desconhecido cai no Leve
  assert.equal(sugerirPerfil({ gpu: 'Mali-G615 MC2', movel: true }), 'media');
  assert.equal(sugerirPerfil({ gpu: 'ANGLE (ARM, Mali-G615 MC2, OpenGL ES 3.2)', movel: true }), 'media');
  assert.equal(sugerirPerfil({ gpu: 'Mali-G78 MP14', movel: true }), 'alta');
  assert.equal(sugerirPerfil({ gpu: 'PowerVR Rogue GE8320', movel: true }), 'leve');
  const e = escolherPerfil({ gpu: casos[0][0] });
  assert.equal(e.placa, 'Radeon RX 550 Series');
  assert.match(e.motivo, /^Radeon RX 550 Series: placa de entrada do PC/);
  assert.equal(nomeDaPlaca('ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)'), 'Apple M1');
  assert.equal(nomeDaPlaca('Mali-G615 MC2'), 'Mali-G615 MC2');
  assert.equal(nomeDaPlaca('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)'), 'SwiftShader');
  assert.deepEqual(ORDEM_PERFIS, ['leve', 'media', 'pc', 'alta', 'ultra']);
});

test('perfis: o PC em 1080p nativo com MSAA 2x, sombra do Alta, céu do cubo de 512, alvo de 15,5 ms e teto de 60 qps', () => {
  const P = PERFIS.pc;
  assert.equal(P.msaa, 2);
  assert.deepEqual(P.sombra, PERFIS.alta.sombra, 'sombra como no Alta');
  // o céu direto por pixel custava 5 ms de placa na RX 550 (PC2): cubo de 512 em meias faces, 12 quadros por cubo
  assert.deepEqual(P.ceu, { modo: 'cubo', cubo: 512, nuvens: true, fatias: 2 });
  assert.equal(P.ibl, PERFIS.alta.ibl);
  assert.equal(P.lod0, PERFIS.alta.lod0);
  assert.equal(P.alvoGpu, 15.5);
  assert.deepEqual([P.qps, P.qpsPiso, P.tetoQps], [60, 30, 60]);
  // Windows com escala de 150%: 1280 x 720 CSS com dpr 1,5 é a tela de 1080p nativa
  const tela = { w: 1280, h: 720 };
  assert.equal(razaoDePixels(P, 1.5, 0, tela), 1.5);
  assert.deepEqual(degrausDoPerfil(P, 1.5, tela), [1.05, 1.2, 1.35, 1.5], '70% a 100% da nativa');
  // numa tela de 4K fica o teto de pixels de 1080p
  const pr4k = razaoDePixels(P, 1.5, 0, { w: 2560, h: 1440 });
  assert.equal(Math.round(2560 * pr4k) * Math.round(1440 * pr4k), 1920 * 1080);
  assert.equal(razaoDePixels(P, 1.5, 1, tela), 1, '?pr= fixa manda');
  // os perfis antigos seguem, e o nominal é sempre um degrau (o Alta a 1,5 não cai para 1,45)
  assert.deepEqual(degrausDoPerfil(PERFIS.alta, 1.5), [1, 1.15, 1.3, 1.5]);
  assert.deepEqual(degrausDoPerfil(PERFIS.media, 2.75), [0.85, 1, 1.15, 1.3]);
  // as tabelas dos domínios dão ao PC o que dão ao Alta (HAO, LOD) até ganharem a linha dele
  assert.equal(porPerfil({ ultra: 2048, alta: 2048, media: 1024 }, P), 2048);
  assert.equal(porPerfil({ pc: 3, alta: 2, media: 1 }, P), 3);
  assert.equal(porPerfil({ alta: 2, media: 1 }, PERFIS.leve), 1);
});

test('perfis: tetos do PC (800 chamadas, 2,5 milhões de triângulos, 2,5 GB de vídeo) com as famílias somando dentro', () => {
  const O = orcamentoDoPerfil('pc');
  assert.deepEqual([O.calls, O.tris, O.videoMB], [800, 2500000, 2560]);
  assert.deepEqual(Object.keys(O.familias).sort(), [...FAMILIAS].sort());
  const soma = (k) => Object.values(O.familias).reduce((s, f) => s + f[k], 0);
  assert.ok(soma('teto') <= O.tris, `tetos ${soma('teto')}`);
  assert.equal(soma('alvo'), O.alvoTris);
  assert.ok(Object.values(O.familias).reduce((s, f) => s + f.calls[1], 0) <= O.calls);
  assert.equal(orcamentoDoPerfil('media').calls, 300, 'o Média segue no contrato');
});

// o custo medido no PC do dono é de pixel: ms = fixo + pixel x escala²; ruído determinístico de ±8%
function placa({ fixo, pixel, ruido = 0.08, semente = 7 }) {
  let x = semente;
  return (escala) => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return (fixo + pixel * escala * escala) * (1 + ruido * (2 * (x / 2147483648) - 1));
  };
}

test('resolução pelo cronômetro: desce direto ao degrau que cabe no alvo de 15,5 ms', () => {
  const E = [0.7, 0.8, 0.9, 1];
  const c = new ControleResolucao({ escalas: E, alvo: 15.5 });
  const ms = placa({ fixo: 4, pixel: 20, ruido: 0 }); // 24 ms na nativa, como o Alta no PC do dono
  const trocas = [];
  for (let t = 0; t < 3000; t += 16.7) {
    const j = c.amostra(ms(E[c.i]), t);
    if (j >= 0) trocas.push([Math.round(t), j]);
  }
  // 2 janelas lentas: pula de 100% para 80% (24 x 0,64 cabe), mede 16,8 e desce a 70% (13,8 ms)
  assert.deepEqual(trocas.map(([, j]) => j), [1, 0]);
  assert.ok(trocas[0][0] < 700, 'na segunda janela');
  assert.equal(c.i, 0);
  // e fica: a previsão de 80% (18 ms) não cabe com a folga
  for (let t = 3000; t < 60000; t += 16.7) assert.equal(c.amostra(ms(E[c.i]), t), -1);
});

test('resolução pelo cronômetro: sobe um degrau por vez com folga, 3 janelas e 3 s depois de descer', () => {
  const E = [0.7, 0.8, 0.9, 1];
  const c = new ControleResolucao({ escalas: E, alvo: 15.5 });
  c.definir(0);
  const ms = placa({ fixo: 2, pixel: 10 }); // placa folgada: 12 ms na nativa
  const trocas = [];
  for (let t = 0; t < 10000; t += 16.7) {
    const j = c.amostra(ms(E[c.i]), t);
    if (j >= 0) trocas.push([t, j]);
  }
  assert.deepEqual(trocas.map(([, j]) => j), [1, 2, 3]);
  for (let k = 1; k < trocas.length; k++) assert.ok(trocas[k][0] - trocas[k - 1][0] >= 3 * 20 * 16.7 - 1, 'três janelas por degrau');
  // depois de uma descida, espera 3 s para subir
  const d = new ControleResolucao({ escalas: E, alvo: 15.5 });
  d.decidir(30, 0);
  assert.equal(d.decidir(30, 100), 0, 'desce (ao menor que cabe)');
  for (let k = 0; k < 3; k++) assert.equal(d.decidir(6, 200 + k * 100), -1, 'antes de 3 s não sobe');
  assert.equal(d.decidir(6, 3200), 1);
});

test('resolução pelo cronômetro: com ruído na beira do alvo não oscila em 10 minutos', () => {
  const E = [0.7, 0.8, 0.9, 1];
  for (const [fixo, pixel] of [[4, 13], [3, 12.6], [5, 14], [2, 17.5], [4, 9]]) {
    const c = new ControleResolucao({ escalas: E, alvo: 15.5 });
    const ms = placa({ fixo, pixel, semente: fixo * 100 + pixel });
    let trocas = 0;
    let depoisDe20s = 0;
    for (let t = 0; t < 600000; t += 16.7) {
      if (c.amostra(ms(E[c.i]), t) >= 0) {
        trocas++;
        if (t > 20000) depoisDe20s++;
      }
    }
    assert.ok(trocas <= 3, `${fixo} + ${pixel}: ${trocas} trocas`);
    assert.equal(depoisDe20s, 0, `${fixo} + ${pixel}: trocou depois de assentar`);
    // o degrau em que assentou cabe no alvo
    assert.ok(fixo + pixel * E[c.i] ** 2 <= 15.5 * 1.06 || c.i === 0, `${fixo} + ${pixel} no degrau ${c.i}`);
  }
});

test('resolução pelo cronômetro: uma subida desfeita duas vezes trava o degrau de cima por 1 min', () => {
  const c = new ControleResolucao({ escalas: [0.7, 0.8, 0.9, 1], alvo: 15.5 });
  c.definir(2);
  const sobe = (t0) => {
    let j = -1;
    for (let k = 0; k < 3; k++) j = Math.max(j, c.decidir(10, t0 + k * 100));
    return j;
  };
  const desce = (t0) => (c.decidir(17, t0), c.decidir(17, t0 + 100));
  assert.equal(sobe(0), 3);
  assert.equal(desce(1000), 2, 'a cena ficou pesada logo depois: desfaz');
  assert.equal(sobe(4200), 3);
  assert.equal(desce(5500), 2, 'desfaz de novo: trava');
  assert.equal(sobe(9000), -1, 'travado');
  assert.equal(sobe(40000), -1, 'ainda travado');
  assert.equal(sobe(66000), 3, 'passou 1 min');
});

test('resolução: o PC acerta os degraus pela tela, começa na nativa e troca pelo cronômetro com o CAS', () => {
  const ctx = { perfil: PERFIS.pc, pr: 1.5, tela: { w: 1280, h: 720 } };
  const r = new Resolucao(ctx, { fixa: false });
  Object.defineProperty(r, 'dpr', { value: 1.5 });
  r.conferir();
  assert.equal(ctx.pr, 1.5);
  // a tela de 4K: o mesmo degrau (o nominal), com o teto de 1080p
  ctx.tela = { w: 2560, h: 1440 };
  assert.equal(r.conferir(), true);
  assert.equal(ctx.pr, 0.75);
  ctx.tela = { w: 1280, h: 720 };
  r.conferir();
  assert.equal(ctx.pr, 1.5);
  // nos 3 primeiros segundos não mexe (compilação); depois 24 ms na nativa descem a 80% (1,2)
  let t = 0;
  for (; t < 3000; t += 16.7) assert.equal(r.amostraGpu(24, 1.5, t), false);
  let trocou = false;
  for (let k = 0; k < 60 && !trocou; k++, t += 16.7) trocou = r.amostraGpu(24, 1.5, t);
  assert.ok(trocou);
  assert.equal(ctx.pr, 1.2);
  assert.equal(r.ultimaTroca.modo, 'cronometro');
  assert.ok(r.cas > 0.5, 'CAS abaixo da nativa');
  // amostra de um quadro de antes da troca não vale
  assert.equal(r.amostraGpu(40, 1.5, t), false);
  // com o cronômetro vivo, o tempo de quadro não manda (a CPU lenta não derruba a resolução à toa)
  for (let k = 0; k < 200; k++, t += 40) {
    assert.equal(r.amostraGpu(12, 1.2, t), false);
    assert.equal(r.medir(t, 'livre'), false);
    assert.equal(r.modo, 'cronometro');
  }
  assert.equal(ctx.pr, 1.2);
  // 30 quadros sem resultado do cronômetro: o tempo de quadro assume
  let pelaCpu = false;
  for (let k = 0; k < 150 && !pelaCpu; k++, t += 40) pelaCpu = r.medir(t, 'livre');
  assert.ok(pelaCpu);
  assert.equal(r.ultimaTroca.modo, 'quadro');
  // estado 'teste' e ?pr= travam
  assert.equal(r.amostraGpu(40, 1.2, t + 9000, 'teste'), false);
  const fixa = new Resolucao({ perfil: PERFIS.pc, pr: 1, tela: { w: 1280, h: 720 } }, { fixa: true });
  fixa.conferir();
  assert.equal(fixa.ctx.pr, 1);
});

test('resolução: a preferência do jogador (R.resolucao) trava no nominal e tira o CAS; a bancada não a apaga', () => {
  const ctx = { perfil: PERFIS.pc, pr: 1.5, tela: { w: 1280, h: 720 } };
  const r = new Resolucao(ctx, { fixa: false });
  Object.defineProperty(r, 'dpr', { value: 1.5 });
  r.conferir();
  let t = 0;
  for (; t < 3000; t += 16.7) r.amostraGpu(24, 1.5, t);
  let trocou = false;
  for (let k = 0; k < 60 && !trocou; k++, t += 16.7) trocou = r.amostraGpu(24, ctx.pr, t);
  assert.ok(trocou && ctx.pr < 1.5, 'desceu pela placa');
  assert.ok(r.cas > 0.5);
  // desligada: volta ao nominal, fica 'fixa' e não desce mais
  assert.equal(r.preferir({ dinamica: false }), true);
  assert.equal(ctx.pr, 1.5);
  assert.equal(r.modo, 'fixa');
  for (let k = 0; k < 200; k++, t += 16.7) assert.equal(r.amostraGpu(40, 1.5, t), false);
  assert.equal(ctx.pr, 1.5);
  // a troca de tela mantém o nominal
  ctx.tela = { w: 2560, h: 1440 };
  r.conferir();
  assert.equal(ctx.pr, 0.75);
  ctx.tela = { w: 1280, h: 720 };
  r.conferir();
  // a medida da bancada trava e destrava pela consulta sem religar a dinâmica do jogador
  const antes = r.travada ?? r.fixa;
  r.fixa = true;
  r.fixa = antes;
  assert.equal(r.fixa, true, 'continua desligada pelo jogador');
  assert.equal(r.travada, false);
  // religada: espera 3 s de novo e volta a agir
  assert.equal(r.preferir({ dinamica: true }), false);
  assert.equal(r.modo, 'cronometro');
  for (let k = 0; k < 400 && ctx.pr === 1.5; k++, t += 16.7) r.amostraGpu(24, ctx.pr, t);
  assert.ok(ctx.pr < 1.5, 'desce de novo');
  // nitidez desligada: sem CAS, mesmo abaixo do nominal, também no quadro
  r.preferir({ nitidez: 'desligada' });
  assert.equal(r.cas, 0);
  const cas = Object.getOwnPropertyDescriptor(Quadro.prototype, 'cas').get;
  assert.equal(cas.call({ ctx: { perfil: PERFIS.pc, pr: 1 }, resolucao: { dpr: 2.5, cas: 0, semCas: true } }), 0);
  assert.ok(cas.call({ ctx: { perfil: PERFIS.pc, pr: 1 }, resolucao: { dpr: 2.5, cas: 0, semCas: false } }) > 0.5);
  r.preferir({ nitidez: 'auto' });
  assert.ok(r.cas > 0.5);
});

test('teto de qps: 60 na média num monitor de 144 Hz; a 60 Hz nunca pula um quadro', () => {
  const contar = (hz, s, teto, jitter = 0) => {
    const r = new Ritmo();
    let n = 0;
    for (let k = 0; k < hz * s; k++) {
      const t = (k * 1000) / hz + (k % 2 ? jitter : -jitter);
      if (r.vez(t, teto)) {
        r.desenhou(t, teto);
        n++;
      }
    }
    return n;
  };
  assert.ok(Math.abs(contar(144, 10, 60) - 600) <= 12, `${contar(144, 10, 60)} quadros em 10 s a 144 Hz`);
  assert.ok(Math.abs(contar(120, 10, 60) - 600) <= 2);
  assert.equal(contar(60, 10, 60, 0.4), 600, '60 Hz com o rAF oscilando');
  assert.equal(contar(60.6, 10, 60), 606, 'monitor um pouco acima de 60 Hz');
  assert.equal(contar(144, 10, 0), 1440, 'sem teto');
  assert.ok(Math.abs(contar(60, 10, 10) - 100) <= 2, 'tela coberta a 10 qps');
});

test('cronômetro: trechos por passe (a água pelo nome, o resto pela família) e o quadro inteiro para a resolução', () => {
  // placa falsa: cada consulta dura o que o rótulo dela manda
  const ms = { outros: 0.2, ceu: 1, sombra: 2, terreno: 3, agua: 4, predios: 5, pos: 1.5 };
  const ext = { TIME_ELAPSED_EXT: 0x88bf, GPU_DISJOINT_EXT: 0x8fbb };
  let ativa = null;
  let criadas = 0;
  const gl = {
    QUERY_RESULT: 0x8866, QUERY_RESULT_AVAILABLE: 0x8867,
    rotulo: '',
    createQuery: () => ({ id: ++criadas }),
    deleteQuery() {},
    beginQuery(alvo, q) {
      assert.equal(ativa, null, 'uma consulta por vez');
      ativa = q;
      q.ns = ms[gl.rotulo] * 1e6;
    },
    endQuery() {
      ativa = null;
    },
    getQueryParameter: (q, k) => (k === gl.QUERY_RESULT_AVAILABLE ? true : q.ns),
    getParameter: () => false,
  };
  const c = new Cronometro(gl, ext);
  const marcar = (r) => ((gl.rotulo = r), c.marcar(r));
  gl.rotulo = 'outros';
  c.comecar({ pr: 1.2, tMs: 0 });
  for (const r of ['ceu', 'sombra', 'terreno', 'agua', 'terreno', 'predios', 'pos']) marcar(r);
  c.terminar();
  const [q] = c.colher();
  assert.equal(q.info.pr, 1.2);
  assert.deepEqual(q.porRotulo, { outros: 0.2, ceu: 1, sombra: 2, terreno: 6, agua: 4, predios: 5, pos: 1.5 });
  assert.ok(Math.abs(q.total - 19.7) < 1e-9);
  assert.equal(c.livres.length, criadas, 'as consultas voltam para o reuso');
  // um GPU_DISJOINT joga fora o que estava no ar
  c.comecar({ pr: 1, tMs: 16 });
  c.terminar();
  gl.getParameter = () => true;
  assert.deepEqual(c.colher(), []);
  // classificação dos desenhos
  const grupo = { userData: { familia: 'predios' }, parent: null };
  assert.equal(classeDoDesenho({ name: '', userData: {}, parent: grupo }, { name: 'edificio' }), 'predios');
  assert.equal(classeDoDesenho({ name: 'agua', userData: { familia: 'resto' } }, { name: 'agua' }), 'agua');
  assert.equal(classeDoDesenho({ userData: { familia: 'arcologia' } }, { name: 'arcologia:agua' }), 'agua');
  assert.equal(classeDoDesenho({ userData: { familia: 'arcologia' } }, { name: 'arcologia:vidro' }), 'arcologia');
  assert.equal(classeDoDesenho({ name: 'aguape', userData: {} }, { name: 'folha' }), 'resto');
  assert.ok(PASSES_GPU.includes('agua') && PASSES_GPU.includes('pos') && PASSES_GPU.includes('sombra'));
});

test('medidas: com o cronômetro ligado, o tempo por passe entra em R.stats e o do quadro vai para a resolução', () => {
  const ext = { TIME_ELAPSED_EXT: 0x88bf, GPU_DISJOINT_EXT: 0x8fbb };
  const gl = {
    QUERY_RESULT: 0x8866, QUERY_RESULT_AVAILABLE: 0x8867, rotulo: 'outros',
    createQuery: () => ({}), deleteQuery() {}, beginQuery(a, q) { q.ns = (gl.rotulo === 'terreno' ? 3 : 1) * 1e6; }, endQuery() {},
    getQueryParameter: (q, k) => (k === gl.QUERY_RESULT_AVAILABLE ? true : q.ns), getParameter: () => false,
  };
  const renderer = {
    info: { render: { calls: 0, triangles: 0 }, memory: { textures: 0, geometries: 0 }, programs: [], reset() {} },
    extensions: { get: (n) => (n === 'EXT_disjoint_timer_query_webgl2' ? ext : null) },
    getContext: () => gl,
    getPixelRatio: () => 1.35,
  };
  const m = new Medidas(renderer, { perfil: 'pc', capac: { programas: { lista: [{}, {}], depois: [{ nome: 'arcologia:vidro' }] } } });
  const recebidos = [];
  m.aoCronometro = (ms, info) => recebidos.push([ms, info.pr]);
  m.cronometrar = true;
  m.porPasse = true;
  for (let k = 0; k < 3; k++) {
    m.inicio(k * 16);
    gl.rotulo = 'terreno';
    m.marcar('terreno');
    gl.rotulo = 'pos';
    m.marcar('pos');
    m.fim(k * 16 + 10);
  }
  assert.equal(recebidos.length, 3);
  assert.deepEqual(recebidos[0], [5, 1.35], 'outros 1 + terreno 3 + pós 1');
  assert.equal(m.stats.gpuMsTimer, 5);
  assert.deepEqual(m.stats.gpuPasses, { terreno: 3, pos: 1, outros: 1 });
  assert.equal(m.stats.gpuQuadros, 3);
  assert.deepEqual(m.stats.compilacoes, { programas: 2, depois: 1, nomes: ['arcologia:vidro'] });
  // sem cronômetro nem página de teste, nada de consulta
  const n = new Medidas({ ...renderer, extensions: { get: () => null } }, {});
  n.cronometrar = true;
  n.inicio(0);
  n.fim(16);
  assert.equal(n.stats.gpuMsTimer, 0);
});

test('memória de vídeo: bytes por formato e o que o jogo aloca e solta no WebGL', () => {
  const RGBA8 = 0x8058;
  assert.equal(bytesDoNivel(RGBA8, 4, 4), 64);
  assert.equal(bytesDoNivel(0x8c3a, 1920, 1080), 1920 * 1080 * 4, 'R11F_G11F_B10F');
  assert.equal(bytesDoNivel(0x881a, 2, 2), 32, 'RGBA16F');
  assert.equal(bytesDoNivel(0x83f0, 5, 5), 32, 'DXT1 em blocos de 4');
  assert.equal(bytesDoNivel(0x1908, 2, 2, 1, 0x1908, 0x1401), 16, 'RGBA sem tamanho, byte');
  assert.equal(bytesDoNivel(0x1907, 2, 2, 1, 0x1907, 0x1401), 16, 'RGB completa para RGBA');
  assert.equal(bytesDoNivel(0x1908, 2, 2, 1, 0x1908, 0x140b), 32, 'RGBA em meia precisão');
  assert.equal(bytesDoArmazenamento(RGBA8, 3, 4, 4), 64 + 16 + 4);
  assert.equal(bytesDoArmazenamento(RGBA8, 1, 4, 4, { faces: 6 }), 6 * 64);
  assert.equal(bytesDoArmazenamento(RGBA8, 1, 4, 4, { camadas: 3 }), 3 * 64);
  const lig = {};
  const gl = {
    TEXTURE_2D: 0x0de1, TEXTURE_CUBE_MAP: 0x8513, TEXTURE_3D: 0x806f, TEXTURE_2D_ARRAY: 0x8c1a,
    TEXTURE_BINDING_2D: 0x8069, TEXTURE_BINDING_CUBE_MAP: 0x8514, TEXTURE_BINDING_3D: 0x806a, TEXTURE_BINDING_2D_ARRAY: 0x8c1d,
    TEXTURE_CUBE_MAP_POSITIVE_X: 0x8515, TEXTURE_CUBE_MAP_NEGATIVE_Z: 0x851a, RENDERBUFFER_BINDING: 0x8ca7,
    ARRAY_BUFFER: 0x8892, ARRAY_BUFFER_BINDING: 0x8894, ELEMENT_ARRAY_BUFFER: 0x8893, ELEMENT_ARRAY_BUFFER_BINDING: 0x8895,
    drawingBufferWidth: 100, drawingBufferHeight: 50,
    getParameter: (p) => {
      assert.ok(p !== undefined, 'nunca um enum desconhecido (deixaria erro do GL)');
      return lig[p] ?? null;
    },
    texStorage2D() {}, texImage2D() {}, generateMipmap() {}, deleteTexture() {},
    renderbufferStorageMultisample() {}, deleteRenderbuffer() {}, bufferData() {}, deleteBuffer() {},
  };
  const m = vigiarMemoria(gl);
  assert.equal(vigiarMemoria(gl), m, 'uma vez por contexto');
  const tex = {};
  lig[gl.TEXTURE_BINDING_2D] = tex;
  gl.texStorage2D(gl.TEXTURE_2D, 1, 0x8c3a, 1024, 1024);
  assert.equal(m.texturas, 4 * 1048576);
  const img = {};
  lig[gl.TEXTURE_BINDING_2D] = img;
  gl.texImage2D(gl.TEXTURE_2D, 0, 0x1908, 0x1908, 0x1401, { width: 256, height: 256 });
  gl.generateMipmap(gl.TEXTURE_2D);
  assert.equal(m.texturas, 4 * 1048576 + Math.round((256 * 256 * 4 * 4) / 3));
  const rb = {};
  lig[gl.RENDERBUFFER_BINDING] = rb;
  gl.renderbufferStorageMultisample(0x8d41, 2, 0x8c3a, 1920, 1080);
  assert.equal(m.alvos, 1920 * 1080 * 4 * 2, 'MSAA 2x');
  const buf = {};
  lig[gl.ARRAY_BUFFER_BINDING] = buf;
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(1000), 0x88e4);
  gl.bufferData(gl.ARRAY_BUFFER, 8000, 0x88e4);
  assert.equal(m.buffers, 8000, 'o mesmo buffer realocado não soma duas vezes');
  gl.bufferData(0x8a11, 64, 0x88e4); // um alvo sem ligação conhecida (UNIFORM_BUFFER aqui) não conta
  assert.equal(m.mb().telaMB, +((100 * 50 * 12) / 1048576).toFixed(1));
  gl.deleteTexture(tex);
  gl.deleteTexture(img);
  gl.deleteRenderbuffer(rb);
  gl.deleteBuffer(buf);
  assert.deepEqual([m.texturas, m.alvos, m.buffers], [0, 0, 0]);
});

// contexto falso do WebGL só com o que o vigia dos programas usa
function glDeProgramas() {
  const gl = {
    VERTEX_SHADER: 0x8b31, FRAGMENT_SHADER: 0x8b30, LINK_STATUS: 0x8b82,
    createShader: (t) => ({ t }), shaderSource() {}, attachShader() {}, linkProgram() {},
    getProgramParameter: () => true,
  };
  const ligar = (nome) => {
    const p = {};
    for (const t of [gl.VERTEX_SHADER, gl.FRAGMENT_SHADER]) {
      const sh = gl.createShader(t);
      gl.shaderSource(sh, `#define SHADER_NAME ${nome}\nvoid main() {}`);
      gl.attachShader(p, sh);
    }
    gl.linkProgram(p);
    return p;
  };
  return { gl, ligar };
}

test('vigia: conta e registra cada programa compilado depois de pronto, com o bloqueio da thread', () => {
  const { gl, ligar } = glDeProgramas();
  const v = vigiarProgramas(gl, { fontes: false });
  const avisos = [];
  const warn = console.warn;
  console.warn = (m) => avisos.push(String(m));
  try {
    for (const n of ['terreno', 'agua']) gl.getProgramParameter(ligar(n), gl.LINK_STATUS);
    assert.equal(v.depois.length, 0);
    // pronto em paralelo (KHR_parallel_shader_compile): a compilação fecha sem bloqueio; a ligação lida depois bloqueia ~0
    const p = ligar('fachada');
    assert.equal(gl.getProgramParameter(p, 0x91b1), true);
    const reg = v.lista.at(-1);
    assert.ok(reg.msCompilar >= 0 && reg.msBloqueio === null);
    gl.getProgramParameter(p, gl.LINK_STATUS);
    assert.ok(reg.msBloqueio >= 0 && reg.link === true);
    v.quadro = 812;
    marcarPronto(v, 800);
    assert.deepEqual([v.pronto, v.quadroPronto, v.antes], [true, 800, 3]);
    gl.getProgramParameter(ligar('arcologia:vidro'), gl.LINK_STATUS);
    assert.equal(v.depois.length, 1);
    assert.deepEqual(compilacoesDepois(v).map((d) => [d.nome, d.quadro]), [['arcologia:vidro', 812]]);
    assert.ok(Number.isFinite(compilacoesDepois(v)[0].msBloqueio));
    assert.match(avisos[0], /depois de pronto: arcologia:vidro/);
    // troca de perfil: volta a aquecer e não conta
    desmarcarPronto(v);
    ligar('terreno');
    assert.equal(v.depois.length, 1);
    assert.equal(vigiarProgramas(gl), v, 'uma vez por contexto');
  } finally {
    console.warn = warn;
  }
});

test('aquecimento: compila domínio por domínio no alvo de cada cena e marca pronto depois da rodada final', async () => {
  const { gl, ligar } = glDeProgramas();
  const vigia = vigiarProgramas(gl, { fontes: false });
  const chamadas = [];
  const renderer = {
    alvo: null,
    toneMapping: 'agx',
    getRenderTarget() {
      return this.alvo;
    },
    setRenderTarget(a) {
      this.alvo = a;
    },
    compileAsync(obj, cam, destino) {
      chamadas.push({ nome: obj.name, alvo: this.alvo, tom: this.toneMapping, cam, destino });
      ligar(obj.name);
      return Promise.resolve(obj);
    },
  };
  const obj = (name) => ({ isObject3D: true, name, userData: {} });
  const cena = { isObject3D: true, children: [obj('terreno'), obj('predios'), obj('arcologia')] };
  let prontos = false;
  const emitidos = [];
  const ctx = {
    renderer, cena, camera: 'camera', perfil: PERFIS.pc, capac: { programas: vigia }, medidas: { stats: {} },
    sombra: { cena: obj('sombra'), alvo: 'alvoSombra', cams: ['camSombra'], ligada: true },
    dominio: (n) => (n === 'predios' || n === 'vias' ? { pronto: () => prontos } : null),
    emitir: (n) => emitidos.push(n),
    quadro: { desenhados: 57 },
  };
  // um quadro com tudo carregado basta aqui; a espera dos quadros e dos sob demanda tem o teste dela (C1b)
  const a = new Aquecimento(ctx, { minQuadros: 1 });
  const alvo = { alvo: 'alvoHdr', tom: 'nenhum' };
  assert.equal(a.quadro(0, alvo), true, 'primeira rodada no primeiro quadro');
  assert.deepEqual(chamadas.map((c) => [c.nome, c.alvo, c.tom]), [
    ['sombra', 'alvoSombra', 'agx'], ['terreno', 'alvoHdr', 'nenhum'], ['predios', 'alvoHdr', 'nenhum'], ['arcologia', 'alvoHdr', 'nenhum'],
  ]);
  assert.equal(chamadas[0].cam, 'camSombra');
  assert.ok(chamadas.slice(1).every((c) => c.destino === cena), 'luzes da cena inteira');
  assert.deepEqual([renderer.alvo, renderer.toneMapping], [null, 'agx'], 'o estado do renderer volta');
  await a._pendente;
  assert.equal(a.estado, 'aquecendo');
  assert.equal(a.quadro(1000, alvo), false);
  assert.equal(a.quadro(AQUECER.esperaMs + 100, alvo), false, 'prédios e vias ainda carregando');
  prontos = true;
  // um domínio pede o que ainda não está na cena (a etapa seguinte da Arcologia)
  ctx.quadro.aquecer = a;
  a.add(() => [obj('arcologia:etapa2')]);
  // e um passe numa cena à parte (a suavização da luz da noite): compila com as luzes dela, não com as da principal
  const cenaSuave = { isObject3D: true, isScene: true, name: 'noite-suave', userData: {} };
  a.add(() => cenaSuave);
  assert.equal(a.quadro(AQUECER.esperaMs + 200, alvo), true, 'rodada final');
  assert.ok(chamadas.some((c) => c.nome === 'arcologia:etapa2' && c.alvo === 'alvoHdr' && c.destino === cena));
  assert.ok(chamadas.some((c) => c.nome === 'noite-suave' && c.destino === cenaSuave), 'cena à parte com as luzes dela');
  assert.equal(vigia.pronto, false, 'só depois de a rodada terminar');
  await a._pendente;
  assert.equal(a.estado, 'pronto');
  assert.equal(vigia.pronto, true);
  assert.equal(vigia.quadroPronto, 57);
  assert.deepEqual(emitidos, ['aquecido']);
  assert.equal(ctx.medidas.stats.aquecimento.estado, 'pronto');
  assert.ok(ctx.medidas.stats.aquecimento.programas >= 9);
  assert.equal((await a.promessa).estado, 'pronto');
  // fonte nova depois de pronto: uma rodada a mais (o que ligar aí conta como depois de pronto)
  const n = chamadas.length;
  a.add(obj('obra'));
  assert.equal(a.quadro(20000, alvo), true);
  assert.ok(chamadas.slice(n).some((c) => c.nome === 'obra'));
  await a._pendente;
  // troca de perfil: aquece de novo sem contar
  ctx.perfil = PERFIS.alta;
  a.quadro(21000, alvo);
  assert.equal(vigia.pronto, false);
  assert.equal(a.estado, 'aquecendo');
  // sem compileAsync (render falso) fica pronto na rodada final, sem quebrar
  const b = new Aquecimento({ ...ctx, renderer: {}, perfil: PERFIS.pc, capac: {} }, { esperaMs: 0, minQuadros: 1 });
  b.quadro(0, alvo);
  await b._pendente;
  b.quadro(10, alvo);
  await b._pendente;
  assert.equal(b.estado, 'pronto');
});

test('vigia: o bloqueio sai da primeira leitura que espera a ligação (o three lê o registro antes do LINK_STATUS)', () => {
  const { gl, ligar } = glDeProgramas();
  // um driver sem compilação em paralelo: a primeira leitura do programa espera a compilação inteira
  const espera = (ms) => {
    const t = performance.now();
    while (performance.now() - t < ms);
  };
  const esperando = new Set();
  const gp = gl.getProgramParameter;
  gl.linkProgram = (p) => esperando.add(p);
  gl.getProgramInfoLog = (p) => (esperando.delete(p) && espera(6), '');
  gl.getProgramParameter = (p, k) => (k !== 0x91b1 && esperando.delete(p) && espera(6), gp(p, k));
  const v = vigiarProgramas(gl, { fontes: false });
  // a ordem do onFirstUse do three r186: registro do programa, registros dos shaders, LINK_STATUS
  const p = ligar('arcologia:vidro');
  gl.getProgramInfoLog(p);
  gl.getProgramParameter(p, gl.LINK_STATUS);
  const reg = v.lista.at(-1);
  assert.ok(reg.msBloqueio >= 5, `bloqueio ${reg.msBloqueio} ms`);
  assert.equal(reg.link, true);
  // sem a checagem de erros do three, a primeira leitura é a dos uniformes ativos (0x8b86)
  const q = ligar('fachada');
  gl.getProgramParameter(q, 0x8b86);
  gl.getProgramParameter(q, gl.LINK_STATUS);
  assert.ok(v.lista.at(-1).msBloqueio >= 5);
  assert.equal(v.lista.at(-1).link, true);
  // pronto em paralelo antes do primeiro uso: bloqueio perto de zero
  const r = ligar('terreno');
  esperando.delete(r);
  assert.equal(gl.getProgramParameter(r, 0x91b1), true);
  gl.getProgramInfoLog(r);
  assert.ok(v.lista.at(-1).msBloqueio < 5 && v.lista.at(-1).msCompilar !== null);
});

test('aquecimento: trocar o perfil no meio da rodada final não marca pronto com os programas do perfil de antes', async () => {
  const { gl, ligar } = glDeProgramas();
  const vigia = vigiarProgramas(gl, { fontes: false });
  const soltar = [];
  const renderer = {
    getRenderTarget: () => null,
    setRenderTarget() {},
    toneMapping: 0,
    // a compilação só termina quando o teste solta
    compileAsync(obj) {
      ligar(obj.name);
      return new Promise((ok) => soltar.push(ok));
    },
  };
  const obj = (name) => ({ isObject3D: true, name, userData: {} });
  const ctx = { renderer, cena: { isObject3D: true, children: [obj('predios')] }, camera: {}, perfil: PERFIS.pc, capac: { programas: vigia }, medidas: { stats: {} } };
  const a = new Aquecimento(ctx, { esperaMs: 0, minQuadros: 1 });
  const promessa = a.promessa;
  a.quadro(0, {});
  soltar.splice(0).forEach((ok) => ok());
  await a._pendente;
  assert.equal(a.quadro(10, {}), true, 'rodada final no ar');
  const velha = a._pendente;
  // R.qualidade no meio da rodada final
  ctx.perfil = PERFIS.alta;
  a.quadro(20, {});
  soltar.splice(0).forEach((ok) => ok());
  await velha;
  assert.equal(vigia.pronto, false, 'a rodada velha não marca pronto');
  assert.notEqual(a.estado, 'pronto');
  // o aquecimento do perfil novo termina e resolve a promessa que o app já esperava
  await a._pendente;
  a.quadro(30, {});
  soltar.splice(0).forEach((ok) => ok());
  await a._pendente;
  assert.equal(a.estado, 'pronto');
  assert.equal(vigia.pronto, true);
  assert.equal(a.promessa, promessa, 'a promessa de antes da troca é a mesma');
  assert.equal((await promessa).estado, 'pronto');
  assert.ok(Number.isFinite(a.relatorio().msThread));
});

test('aquecimento (C1b): a final espera os domínios sob demanda e um mínimo de quadros; os setores só até o teto', async () => {
  const renderer = { getRenderTarget: () => null, setRenderTarget() {}, toneMapping: 0, compileAsync: (o) => Promise.resolve(o) };
  const obj = (name) => ({ isObject3D: true, name, userData: {} });
  const estado = { predios: false, vegetacao: false, pedestres: false };
  const ctx = {
    renderer, cena: { isObject3D: true, children: [obj('terreno')] }, camera: {}, perfil: PERFIS.pc, capac: {}, medidas: { stats: {} },
    // 'caminhoes' sem pronto() e 'obras' ausente: nada a esperar deles
    dominio: (n) => (n in estado ? { pronto: () => estado[n] } : n === 'caminhoes' ? {} : null),
  };
  const a = new Aquecimento(ctx);
  assert.deepEqual([AQUECER.minQuadros >= 3, AQUECER.tetoSobDemandaMs > AQUECER.tetoMs], [true, true]);
  assert.ok(['vegetacao', 'pedestres', 'caminhoes', 'colocaveis', 'obras', 'marcadores'].every((n) => AQUECER.sobDemanda.includes(n)));
  a.quadro(0, {});
  await a._pendente;
  // o código sob demanda ainda não chegou: nada de final, nem depois do teto dos setores
  let t = 0;
  for (; t < AQUECER.tetoMs + 1000; t += 100) assert.equal(a.quadro(t, {}), false);
  assert.deepEqual(ctx.medidas.stats.aquecimento.esperando, ['vegetacao', 'pedestres']);
  // chegou: os prédios ainda carregando já não seguram (passou do teto), mas a final pede minQuadros seguidos
  estado.vegetacao = estado.pedestres = true;
  let k = 0;
  while (!a.quadro((t += 100), {})) k++;
  assert.equal(k, AQUECER.minQuadros - 1, 'quadros seguidos com tudo carregado');
  await a._pendente;
  assert.equal(a.estado, 'pronto');
  // antes do teto dos setores, prédios carregando seguram a final; um quadro sem eles zera a contagem
  const b = new Aquecimento({ ...ctx, medidas: { stats: {} } }, { minQuadros: 3 });
  estado.predios = false;
  b.quadro(0, {});
  await b._pendente;
  assert.equal(b.quadro(AQUECER.esperaMs, {}), false);
  estado.predios = true;
  assert.equal(b.quadro(AQUECER.esperaMs + 10, {}), false);
  assert.equal(b.quadro(AQUECER.esperaMs + 20, {}), false);
  estado.predios = false;
  assert.equal(b.quadro(AQUECER.esperaMs + 30, {}), false, 'zerou');
  estado.predios = true;
  for (let q = 1; q <= 2; q++) assert.equal(b.quadro(AQUECER.esperaMs + 30 + q * 10, {}), false);
  assert.equal(b.quadro(AQUECER.esperaMs + 60, {}), true, 'três seguidos');
  // o que nunca chega não prende o jogo: com tetoSobDemandaMs e tetoSobDemandaQuadros desenhados, a final sai de
  // qualquer jeito; com a thread presa (poucos quadros), o relógio sozinho não solta
  const c = new Aquecimento({ ...ctx, medidas: { stats: {} }, dominio: (n) => (n === 'marcadores' ? { pronto: () => false } : null) });
  c.quadro(0, {});
  await c._pendente;
  for (let q = 1; q < 4; q++) assert.equal(c.quadro(AQUECER.tetoSobDemandaMs * q, {}), false, 'poucos quadros: espera');
  let tc = AQUECER.tetoSobDemandaMs * 4;
  let n = 3;
  while (!c.quadro((tc += 16), {})) n++;
  assert.equal(n + 1, AQUECER.tetoSobDemandaQuadros);
  assert.deepEqual(c.relatorio().final, { motivo: 'teto', ms: tc, quadros: AQUECER.tetoSobDemandaQuadros, faltavam: ['marcadores'] });
  // a troca de perfil recomeça a carga: nem o motivo nem a espera de antes ficam no relatório, e o teto conta de novo
  await c._pendente;
  c.ctx.perfil = PERFIS.alta;
  assert.equal(c.quadro((tc += 16), {}), true, 'primeira rodada do perfil novo');
  assert.equal(c.relatorio().final, null);
  assert.deepEqual(c.relatorio().esperando, []);
  await c._pendente;
  assert.equal(c.quadro(tc + AQUECER.tetoSobDemandaMs, {}), false, 'o teto conta os quadros do perfil novo');
  assert.deepEqual(c.relatorio().esperando, ['marcadores']);
});

test('resolução: a troca de perfil recomeça a espera de 3 s e o controle acompanha os degraus da tela', () => {
  const ctx = { perfil: PERFIS.alta, pr: 1.5, tela: { w: 1280, h: 720 } };
  const r = new Resolucao(ctx, { fixa: false });
  let dpr = 1.5;
  Object.defineProperty(r, 'dpr', { get: () => dpr });
  r.conferir();
  let t = 0;
  for (; t < 4000; t += 16.7) r.amostraGpu(10, ctx.pr, t);
  assert.deepEqual(r.controle.escalas.map((e) => +e.toFixed(3)), [0.667, 0.767, 0.867, 1]);
  // o dpr muda (zoom, outro monitor): os degraus relativos do Alta mudam (o mesmo número deles) e o controle recomeça
  dpr = 1.45;
  ctx.tela = { w: 1281, h: 720 };
  r.conferir();
  r.amostraGpu(10, ctx.pr, t);
  assert.deepEqual(r.controle.escalas.map((e) => +e.toFixed(3)), [0.69, 0.793, 0.897, 1]);
  // troca para o 'pc': os primeiros 3 s depois dela não mexem (a compilação do perfil novo)
  ctx.perfil = PERFIS.pc;
  r.conferir();
  const t0 = t + 100;
  for (let k = 0; k < 150; k++) assert.equal(r.amostraGpu(40, ctx.pr, t0 + k * 16.7), false, 'dentro dos 3 s');
  let trocou = false;
  for (let k = 0; k < 60 && !trocou; k++) trocou = r.amostraGpu(40, ctx.pr, t0 + 3100 + k * 16.7);
  assert.ok(trocou, 'depois dos 3 s desce');
});

test('página de teste: as ligações entre as cenas medem no mesmo perfil (a estresse fixa o Média sem ?q=)', () => {
  const p = (l) => Object.fromEntries(new URLSearchParams(l.slice(1)));
  assert.deepEqual(p(ligacao('estresse', 'pc', '?cena=aberta&painel=1')), { cena: 'estresse', painel: '1', q: 'pc' });
  assert.deepEqual(p(ligacao('aberta', 'pc', '?cena=estresse&painel=1&q=alta&quadros=30')), { cena: 'aberta', painel: '1', q: 'alta', quadros: '30' });
  assert.deepEqual(p(ligacao('aberta', null, '')), { cena: 'aberta', painel: '1' });
});

// ------------------------------------------------------------------------------------------------ PC2 (custo por pixel)

test('céu do PC: cubo de 512 assado em meias faces (12 quadros por cubo), sem sobra nem sobreposição', () => {
  for (const [lado, n] of [[512, 2], [256, 1], [384, 3]]) {
    let y = 0;
    for (let k = 0; k < n; k++) {
      const f = C.faixaDaFatia(lado, k, n);
      assert.equal(f.y0, y, `fatia ${k} de ${n} começa onde a outra acabou`);
      y += f.h;
    }
    assert.equal(y, lado);
  }
  // um renderer de mentira: guarda cada desenho (face e recorte) no alvo
  const desenhos = [];
  let alvo = null;
  let face = 0;
  const renderer = {
    getRenderTarget: () => alvo,
    getActiveCubeFace: () => face,
    getActiveMipmapLevel: () => 0,
    setRenderTarget: (rt, f = 0) => ((alvo = rt), (face = f)),
    render: () => desenhos.push({ alvo, face, recorte: alvo?.scissorTest ? alvo.scissor.clone() : null }),
    state: { buffers: { depth: { getReversed: () => true } } },
  };
  const ceu = new C.Ceu({ perfil: PERFIS.pc });
  assert.equal(ceu.direto, false);
  assert.equal(ceu.fatias, 2);
  assert.equal(ceu.cubos[0].width, 512);
  // o primeiro cubo sai inteiro; depois meia face por quadro no cubo de trás, e a troca depois das 6 faces
  assert.equal(ceu.assar(renderer, null), 6);
  assert.equal(desenhos.length, 6);
  const frente0 = ceu.frente;
  desenhos.length = 0;
  for (let q = 0; q < 12; q++) assert.equal(ceu.assar(renderer, null), 0.5);
  assert.equal(desenhos.length, 12);
  assert.notEqual(ceu.frente, frente0, 'o cubo novo vai para a frente depois de 12 quadros');
  assert.ok(desenhos.every((d) => d.alvo === ceu.cubos[frente0 === 0 ? 1 : 0]), 'sempre no cubo de trás');
  assert.deepEqual(desenhos.slice(0, 2).map((d) => [d.face, d.recorte.y, d.recorte.w]), [[0, 0, 256], [0, 256, 256]]);
  assert.equal(ceu.cubos[0].scissorTest || ceu.cubos[1].scissorTest, false, 'o recorte volta ao normal');
  // o Média segue com uma face por quadro no cubo de 256
  const media = new C.Ceu({ perfil: PERFIS.media });
  assert.equal(media.fatias, 1);
  media.assar(renderer, null);
  assert.equal(media.assar(renderer, null), 1);
  // estrelas só de noite (desvio pelo uniforme)
  assert.match(fragmentoCeu({ K_CEU: C.K_CEU, CREPUSCULO: C.CREPUSCULO, NOITE: C.NOITE, LUA: C.LUA }), /if \( uEstrelas > 0\.0 \) cor \+= gcEstrelas\( d \);/);
});

test('céu na cena: depois dos opacos, no plano distante (só custa onde aparece), na faixa de longe sem clip control', () => {
  assert.match(CEU_VERTICE, /gl_Position = vec4\( position\.xy, uFundoZ, 1\.0 \);/);
  assert.equal(C.criarMaterialCeu('fundo').depthTest, true);
  assert.equal(C.criarMaterialCeu('fundo').depthWrite, false);
  assert.equal(C.criarMaterialCeu('cubo').depthTest, false);
  assert.equal(C.criarMaterialCeu('ibl').depthTest, false);
  const ceu = new C.Ceu({ perfil: PERFIS.pc });
  const m = ceu.naCena;
  assert.equal(m.renderOrder, C.ORDEM_FUNDO);
  assert.ok(C.ORDEM_FUNDO > 0 && m.frustumCulled === false);
  assert.equal(m.userData.familia, 'ceu', 'o cronômetro põe o desenho no passe do céu');
  assert.equal(classeDoDesenho(m, m.material), 'ceu');
  assert.equal(m.material, ceu.fundo);
  // o plano distante pela profundidade em uso; câmera ortográfica fora do recorte
  let invertida = true;
  const r = { state: { buffers: { depth: { getReversed: () => invertida } } } };
  const cam = new THREE.PerspectiveCamera(40, 1.8, 1, 1000);
  ceu.prepararFundo(r, cam);
  assert.equal(ceu.fundo.uniforms.uFundoZ.value, 0);
  invertida = false;
  ceu.prepararFundo(r, cam);
  assert.equal(ceu.fundo.uniforms.uFundoZ.value, 1);
  ceu.prepararFundo(r, new THREE.OrthographicCamera());
  assert.equal(ceu.fundo.uniforms.uFundoZ.value, 2);
  // duas faixas: só na de longe (na de perto a profundidade foi limpa e o céu cobriria o longe)
  const c2 = new C.Ceu({ perfil: PERFIS.pc, semClip: true });
  assert.equal(c2.naCena.layers.mask, 1 << CAMADA_LONGE);
  assert.ok(ehDeLonge(c2.naCena));
  assert.equal(m.layers.mask, 1, 'com clip control, na camada de sempre');
});

test('CAS: ligada sempre que o desenho interno é menor que a tela, na medida da ampliação', () => {
  assert.equal(forcaCas(1), 0);
  assert.equal(forcaCas(1.01), 0);
  assert.equal(forcaCas(0.8), 0, 'desenho maior que a tela não pede nitidez');
  let ant = 0;
  for (let a = 1.05; a <= 3; a += 0.05) {
    const f = forcaCas(a);
    assert.ok(f >= ant && f <= 0.85, `ampliação ${a.toFixed(2)}: ${f}`);
    ant = f;
  }
  // o PC do dono (medido em 29/09/2026): tela de 4K a 2,5 de escala, desenho de 2070 x 1001 -> 1,85 vez
  const dono = forcaCas(3840 / 2070);
  assert.ok(dono > 0.65 && dono < 0.8, `CAS ${dono}`);
  // no quadro: pela razão de pixels contra o dpr, e nunca abaixo do CAS da resolução dinâmica
  const cas = Object.getOwnPropertyDescriptor(Quadro.prototype, 'cas').get;
  const q = (perfil, pr, dpr, casRes = 0) => cas.call({ ctx: { perfil, pr }, resolucao: { dpr, cas: casRes } });
  assert.ok(Math.abs(q(PERFIS.pc, 1.3479, 2.5) - forcaCas(2.5 / 1.3479)) < 1e-9);
  assert.ok(q(PERFIS.pc, 1.3479, 2.5) > 0.65, 'a bancada de 29/09 mostrava CAS 0 com a tela ampliada 1,85 vez');
  assert.equal(q(PERFIS.pc, 1.5, 1.5), 0, '1080p nativo: sem ampliação, sem CAS');
  assert.equal(q(PERFIS.pc, 1.5, 1.5, 0.6), 0.6, 'a queda da resolução dinâmica segue ligando o CAS');
  assert.equal(q(PERFIS.leve, 0.7, 2), 0, 'o Leve não tem pós');
});

test('resolução no jogo: o PC do dono (4K a 2,5 de escala) liga pelo cronômetro e segura os 15,5 ms de placa', () => {
  const ctx = { perfil: PERFIS.pc, pr: 1, tela: { w: 1536, h: 743 } };
  const r = new Resolucao(ctx, { fixa: false });
  Object.defineProperty(r, 'dpr', { value: 2.5 });
  r.conferir();
  assert.ok(Math.abs(ctx.pr - 1.3479) < 1e-3, `nominal ${ctx.pr} (o teto de 1080p em pixels)`);
  const nominal = ctx.pr;
  // o custo de placa vai com a área: 19 ms na nativa (acima da mira) desce a 90% e fica abaixo de 15,5 x 1,06
  const ms = (pr) => 2 + 17 * (pr / nominal) ** 2;
  let t = 0;
  const vistos = [];
  for (; t < 120000; t += 16.7) {
    r.amostraGpu(ms(ctx.pr), ctx.pr, t);
    r.medir(t, 'livre');
    if (t > 20000) vistos.push(ms(ctx.pr));
  }
  assert.equal(r.modo, 'cronometro', 'no jogo quem manda é o cronômetro da placa');
  assert.ok(ctx.pr < nominal && ctx.pr > nominal * 0.85, `degrau ${ctx.pr / nominal}`);
  assert.ok(Math.max(...vistos) <= 15.5 * 1.06, `pior ${Math.max(...vistos).toFixed(2)} ms`);
  assert.ok(r.trocas <= 2, `trocas ${r.trocas}: sem pisca-pisca`);
  // com a placa folgada (13 ms na nativa) fica na nativa
  const ctx2 = { perfil: PERFIS.pc, pr: 1, tela: { w: 1536, h: 743 } };
  const r2 = new Resolucao(ctx2, { fixa: false });
  Object.defineProperty(r2, 'dpr', { value: 2.5 });
  r2.conferir();
  for (let t2 = 0; t2 < 60000; t2 += 16.7) r2.amostraGpu(13, ctx2.pr, t2);
  assert.equal(ctx2.pr, nominal);
  // a bancada trava (?pr= e o estado 'teste'); o jogo não
  assert.equal(new Resolucao(ctx2, { fixa: true }).modo, 'fixa');
  assert.equal(r2.amostraGpu(40, ctx2.pr, 70000, 'teste'), false);
});

test('CAS perceptiva: sem anel preto em volta da luz acesa, no GLSL cru e no enxuto da montagem', async () => {
  // a CAS perceptiva mora em pos.glsl.js desde a C1b (antes era uma troca de texto em motor/pos.js)
  const { COMPOSICAO } = await import('../../fonte/render/materiais/shaders/pos.glsl.js');
  const { enxugarGlsl } = await import('../montar.mjs');
  const js = enxugarGlsl(`const x = /* glsl */ \`${COMPOSICAO}\`;`);
  const enxuto = js.slice(js.indexOf('`') + 1, js.lastIndexOf('`'));
  assert.ok(enxuto.length < COMPOSICAO.length, 'a montagem enxuga o GLSL');
  for (const g of [COMPOSICAO, enxuto]) {
    assert.match(g, /cor\s*=\s*casDe\(\s*clamp\(/);
    assert.match(g, /vec3\s+casPara\(/);
    assert.ok(!/comprime\(/.test(g), 'o filtro linear saiu');
    assert.equal((g.match(/void main\(\s*\)/g) ?? []).length, 1);
  }
  const pos = readFileSync(new URL('../../fonte/render/motor/pos.js', import.meta.url), 'utf8');
  assert.ok(!/composicaoPerceptiva|COMPOSICAO_CAS/.test(pos), 'motor/pos.js usa a composição de pos.glsl.js como está');
  // as duas contas em JS (um canal): a fachada escura (0,05) ao lado da janela acesa (10), exposição 1, CAS do dono
  const cas = 0.72;
  const lum = (c) => c; // cinza: a luminância é o próprio valor
  const velha = (c0, viz) => {
    const comp = (c) => lum(c) / (1 + lum(c));
    const cs = [c0, ...viz].map(comp);
    const mn = Math.min(...cs);
    const mx = Math.max(...cs);
    const amp = Math.sqrt(Math.min(1, Math.max(0, Math.min(mn, 1 - mx) / Math.max(mx, 1e-4))));
    const w = -amp / (8 + (5 - 8) * cas);
    return Math.max(0, (c0 + w * viz.reduce((a, b) => a + b, 0)) / (1 + 4 * w));
  };
  const para = (c) => Math.sqrt(c / (1 + c));
  const de = (p) => {
    const t = p * p;
    return t / (1 - Math.min(t, 0.999));
  };
  const nova = (c0, viz) => {
    const ps = [c0, ...viz].map(para);
    const mn = Math.min(...ps);
    const mx = Math.max(...ps);
    const amp = Math.sqrt(Math.min(1, Math.max(0, Math.min(mn, 1 - mx) / Math.max(mx, 1e-4))));
    const w = -amp / (8 + (5 - 8) * cas);
    return de(Math.min(1, Math.max(0, (ps[0] + w * (ps[1] + ps[2] + ps[3] + ps[4])) / (1 + 4 * w))));
  };
  const viz = [10, 0.05, 0.05, 0.05];
  assert.equal(velha(0.05, viz), 0, 'a conta linear apagava o vizinho da luz (o anel preto)');
  assert.ok(nova(0.05, viz) > 0.025, `a perceptiva só escurece um pouco: ${nova(0.05, viz)}`);
  // onde não há o que realçar, a volta ao HDR é exata; na borda comum ela ainda realça
  for (const c of [0, 0.02, 0.18, 1, 7.5, 60]) assert.ok(Math.abs(nova(c, [c, c, c, c]) - c) < 1e-6 * Math.max(1, c));
  assert.ok(nova(0.2, [0.4, 0.2, 0.2, 0.2]) < 0.2, 'o lado escuro da borda escurece');
  assert.ok(nova(0.4, [0.2, 0.4, 0.4, 0.4]) > 0.4, 'e o claro clareia');
});

test('céu em cubo: um salto no estado (hora pulada, brilho da cidade que chega) refaz o cubo da frente inteiro', () => {
  const desenhos = [];
  let alvo = null;
  const renderer = {
    getRenderTarget: () => alvo,
    getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0,
    setRenderTarget: (rt) => (alvo = rt),
    render: () => desenhos.push(alvo),
  };
  const ceu = new C.Ceu({ perfil: PERFIS.pc });
  assert.equal(ceu.assar(renderer, null), 6);
  for (let q = 0; q < 5; q++) ceu.assar(renderer, null);
  assert.ok(ceu.faceSeguinte > 0 || ceu.fatiaSeguinte > 0, 'o cubo de trás estava no meio');
  const frente = ceu.frente;
  desenhos.length = 0;
  ceu.refazer();
  assert.equal(ceu.assar(renderer, null), 6, 'o da frente sai inteiro no quadro seguinte');
  assert.ok(desenhos.length === 6 && desenhos.every((a) => a === ceu.cubos[frente]));
  assert.equal(ceu.faceSeguinte, 0, 'e o de trás recomeça (sem faces de antes do salto)');
  assert.equal(ceu.fatiaSeguinte, 0);
  // o céu direto não tem cubo
  const direto = new C.Ceu({ perfil: PERFIS.alta });
  direto.refazer();
  assert.equal(direto.assar(renderer, null), 0);
});

// ------------------------------------------------------------------------------------------------ PC3

test('PC3: compilação adiantada (Aquecimento.compilar) na cena e no alvo de cada uso, sem esperar a rodada', async () => {
  const chamadas = [];
  const renderer = {
    alvo: 'tela',
    toneMapping: 'agx',
    getRenderTarget() {
      return this.alvo;
    },
    setRenderTarget(a) {
      this.alvo = a;
    },
    compileAsync(obj, cam, destino) {
      chamadas.push({ nome: obj.name, alvo: this.alvo, tom: this.toneMapping, destino });
      return Promise.resolve(obj);
    },
  };
  const obj = (name, extra = {}) => ({ isObject3D: true, name, userData: {}, ...extra });
  const cena = obj('cena', { isScene: true });
  const sombra = { cena: obj('cenaSombra', { isScene: true }), alvo: 'alvoSombra' };
  const a = new Aquecimento({ renderer, cena, camera: 'camera', perfil: PERFIS.pc, medidas: { stats: {} }, sombra }, { minQuadros: 1 });
  // o alvo e o tom do quadro vêm do primeiro quadro desenhado
  a._alvo = { alvo: 'alvoHdr', tom: 'nenhum' };
  // as árvores: na cena da vista, no alvo HDR com o tom do quadro
  await a.compilar([obj('arvores:oiti:0'), obj('arvores:impostores'), null]);
  assert.deepEqual(chamadas.map((c) => [c.nome, c.alvo, c.tom, c.destino.name]), [
    ['arvores:oiti:0', 'alvoHdr', 'nenhum', 'cena'], ['arvores:impostores', 'alvoHdr', 'nenhum', 'cena'],
  ]);
  // o gêmeo da sombra própria: no alvo e na cena da sombra
  chamadas.length = 0;
  await a.compilar([obj('arvores:oiti:sombra')], { sombra: true });
  assert.deepEqual(chamadas.map((c) => [c.alvo, c.tom, c.destino.name]), [['alvoSombra', 'agx', 'cenaSombra']]);
  // um passe fora da cena (o assado dos impostores): no alvo dele, com a cena dele
  chamadas.length = 0;
  const cenaAssar = obj('assar', { isScene: true });
  await a.compilar([cenaAssar], { alvo: 'alvoAssar', cena: cenaAssar });
  assert.deepEqual(chamadas.map((c) => [c.alvo, c.destino.name]), [['alvoAssar', 'assar']]);
  // o estado do renderer volta; sem compileAsync (render falso) resolve sem quebrar
  assert.deepEqual([renderer.alvo, renderer.toneMapping], ['tela', 'agx']);
  assert.deepEqual(await new Aquecimento({ renderer: {}, cena, perfil: PERFIS.pc }).compilar([obj('x')]), []);
  // pedida antes do primeiro quadro (o GLSL das árvores chegou cedo): espera por ele, para compilar no alvo e no tom
  // da cena (na tela, com outro tom, o programa seria outro e o primeiro desenho compilaria de novo)
  chamadas.length = 0;
  const b = new Aquecimento({ renderer, cena: { ...cena, children: [] }, camera: 'camera', perfil: PERFIS.pc, medidas: { stats: {} }, sombra }, { minQuadros: 1 });
  let resolveu = false;
  const p = b.compilar([obj('arvores:oiti:1')]).then(() => (resolveu = true));
  await new Promise((ok) => setTimeout(ok, 5));
  assert.equal(chamadas.length, 0, 'compilou antes do primeiro quadro');
  assert.equal(resolveu, false);
  b.quadro(0, { alvo: 'alvoHdr', tom: 'nenhum' });
  await p;
  assert.deepEqual(chamadas.filter((c) => c.nome === 'arvores:oiti:1').map((c) => [c.alvo, c.tom]), [['alvoHdr', 'nenhum']]);
});

test('PC3: as ferramentas nascem com a geometria que terão (o programa do aquecimento é o do uso, D66)', async () => {
  // o three põe "tem atributo de posição" na chave do programa: a geometria vazia sem posição compilava outro programa
  // e a primeira prévia de via, o primeiro fantasma e o primeiro demolir de via compilavam depois de pronto
  const { geometriaVazia, registrar } = await import('../../fonte/render/sobreposicoes/ferramentas.js');
  const g = geometriaVazia(true);
  assert.ok(g.getAttribute('position') && g.getAttribute('color'));
  let fabrica = null;
  registrar({ registrarDominio: (n, f) => (fabrica = f) });
  const cena = new THREE.Scene();
  const ctx = { cena, medidas: { familia: (o) => o }, ouvir: () => () => {}, sim: { espelho: {} } };
  const dom = fabrica(ctx);
  const grupo = cena.getObjectByName('ferramentas');
  const objetos = [];
  grupo.traverse((o) => (o.isMesh || o.isLine) && objetos.push(o));
  assert.ok(objetos.length >= 7);
  for (const o of objetos) assert.ok(o.geometry.getAttribute('position'), `${o.name} sem posição no aquecimento`);
  // a de cor por vértice já tem a cor (a chave das cores por vértice com alfa sai do atributo)
  for (const nome of ['ferramentas:fita', 'ferramentas:linhas']) assert.ok(cena.getObjectByName(nome).geometry.getAttribute('color'), nome);
  dom.descartar();
  // a via: o aquecimento leva uma malha com os atributos de um setor (o programa 'via' compila na carga)
  const { geometriaAquecerVia } = await import('../../fonte/render/mundo/vias.js');
  const gv = geometriaAquecerVia();
  for (const k of ['position', 'normal', 'aUV', 'aDados', 'aId']) assert.ok(gv.getAttribute(k), k);
  assert.equal(gv.index.count, 3);
  const fonteVias = readFileSync(new URL('../../fonte/render/mundo/vias.js', import.meta.url), 'utf8');
  assert.match(fonteVias, /ctx\.quadro\?\.aquecer\?\.add\?\.\(aquecerVia\)/);
});

test('PC3: o disco de Vogel constante do PCF dá as mesmas amostras (giro da fase uma vez por pixel)', async () => {
  const { SOMBRA_PARS } = await import('../../fonte/render/materiais/shaders/sombra.glsl.js');
  const m = SOMBRA_PARS.match(/const vec2 G_VOGEL\[ 8 \] = vec2\[ 8 \]\( ([^;]+) \);/);
  assert.ok(m, 'tabela do disco');
  const v = [...m[1].matchAll(/vec2\( ([-\d.]+), ([-\d.]+) \)/g)].map((x) => [Number(x[1]), Number(x[2])]);
  assert.equal(v.length, 8);
  for (const n of [5, 8]) {
    for (const fase of [0, 0.7, 2.9, 5.5]) {
      const cf = Math.cos(fase);
      const sf = Math.sin(fase);
      for (let i = 0; i < n; i++) {
        // antes: o ângulo e o raio de cada amostra no pixel
        const r = Math.sqrt((i + 0.5) / n);
        const a = i * 2.39996323 + fase;
        const antes = [Math.cos(a) * r, Math.sin(a) * r];
        // agora: a tabela girada pela fase (mat2( cf, sf, -sf, cf ) do GLSL) e escalada por 1 / sqrt( n )
        const k = 1 / Math.sqrt(n);
        const agora = [(cf * v[i][0] - sf * v[i][1]) * k, (sf * v[i][0] + cf * v[i][1]) * k];
        assert.ok(Math.hypot(agora[0] - antes[0], agora[1] - antes[1]) < 1e-7, `n ${n}, fase ${fase}, amostra ${i}`);
      }
    }
  }
  assert.ok(!/cos\( a \)|sin\( a \)/.test(SOMBRA_PARS), 'sem seno e cosseno por amostra');
  assert.match(SOMBRA_PARS, /mat2 giro = mat2\( cf, sf, -sf, cf \);/);
});
