// Testes das ferramentas da F0 (guarda de texto, ordem do CSS, carimbo, contagem da guarda do Mali e orçamento).
// Roda sozinho: node ferramentas/testes/ferramentas.teste.mjs (o simular --testes descobre e roda).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarConteudo, semComentarios } from '../guarda-texto.mjs';
import { ordenarCss, carimboDe, enxugarGlsl } from '../montar.mjs';
import { avaliarSe, preprocessar, contarPrograma, conferirOrcamento, declaracoesGlobais } from '../bancada.mjs';

const regras = (txt, r) => verificarConteudo(txt, r).map((f) => f.regra);

test('guarda: relógio e sorteio na simulação, comentário não conta', () => {
  assert.deepEqual(regras('const t = Date.now();', ['relogio']), ['relogio']);
  assert.deepEqual(regras('const r = Math.random() * 2;', ['relogio']), ['relogio']);
  assert.deepEqual(regras('const d = new  Date();', ['relogio']), ['relogio']);
  assert.deepEqual(regras('performance.now()', ['relogio']), ['relogio']);
  assert.deepEqual(regras('// sem Math.random aqui\n/* nem Date.now */ const x = 1;', ['relogio']), []);
  assert.deepEqual(regras("const s = 'texto com // barra'; const t = Date.now();", ['relogio']), ['relogio']);
  assert.equal(semComentarios('a /* b\nc */ d').split('\n').length, 2);
});

test('guarda: three fora do render', () => {
  assert.deepEqual(regras("import * as THREE from 'three';", ['three']), ['three']);
  assert.deepEqual(regras('import { X } from "three/addons/x.js";', ['three']), ['three']);
  assert.deepEqual(regras("const m = await import('three');", ['three']), ['three']);
  assert.deepEqual(regras("import { a } from './three-util.js'; // 'three'", ['three']), []);
});

test('guarda: o namespace do three só como THREE.Nome (A1)', () => {
  const imp = "import * as THREE from 'three';\n";
  assert.deepEqual(regras(imp + 'const m = new THREE.Mesh(); const c = ctx.THREE; const d = { THREE: sub };', ['threeValor']), []);
  assert.deepEqual(regras(imp + 'f({ renderer, THREE });', ['threeValor']), ['threeValor']);
  assert.deepEqual(regras(imp + 'ctx.THREE = THREE;', ['threeValor']), ['threeValor']);
  assert.deepEqual(regras('const THREE = ctx.THREE; f(THREE);', ['threeValor']), [], 'sem o import, o THREE é o subconjunto do contexto');
});

test('guarda: mediump nos shaders', () => {
  assert.deepEqual(regras('const fs = `precision mediump float;`;', ['mediump']), ['mediump']);
  assert.deepEqual(regras('const fs = `precision highp float;`; // nada de mediump', ['mediump']), []);
});

test('guarda: textos da interface (D42)', () => {
  const t = ['travessao', 'aluguel', 'porDia', 'dia'];
  assert.deepEqual(regras("export default { a: 'Renda média por hora' };", t), []);
  assert.deepEqual(regras("export default { a: 'Diário de obra' };", t), []);
  assert.deepEqual(regras("export default { a: 'Meio-dia' };", t), ['dia']);
  assert.deepEqual(regras("export default { a: 'Faltam 3 dias' };", t), ['dia']);
  assert.deepEqual(regras("export default { a: 'Dia 12' };", t), ['dia']);
  assert.deepEqual(regras("export default { a: '120/dia' };", t).sort(), ['dia', 'porDia']);
  assert.deepEqual(regras("export default { a: 'Aluguel' };", t), ['aluguel']);
  assert.deepEqual(regras("export default { a: 'Casa \u2014 nova' };", t), ['travessao']);
  assert.deepEqual(regras("export default { a: 'de 1 \u2013 2' };", t), ['travessao']);
  assert.deepEqual(regras("export default { a: 'Mês 3 · Ano 2', b: '−120/h' };", t), []);
});

test('montar: CSS em ordem fixa e carimbo', () => {
  assert.deepEqual(ordenarCss(['telas.css', 'zeta.css', 'base.css', 'hud.css', 'tokens.css', 'alfa.css', 'mundo.css']),
    ['tokens.css', 'base.css', 'hud.css', 'telas.css', 'mundo.css', 'alfa.css', 'zeta.css']);
  assert.match(carimboDe(new Date(Date.UTC(2026, 8, 27, 6, 5, 4))), /^20260927060504$/);
});

test('montar: GLSL enxuto sem mexer nas diretivas nem nas expressões', () => {
  const src = [
    'const A = /* glsl */ `',
    '  // comentário',
    '  #define F( x ) ( x * 2.0 )',
    '  uniform float a; /* bloco */ float b;',
    '',
    '  vec3 f( float c ) { return vec3( ${Y}, c = -a ); } // fim',
    '`;',
    "const B = `  // fora da marca  `;",
    'const C = /* glsl */ `float c; // ${X}`;',
  ].join('\n');
  const e = enxugarGlsl(src);
  assert.ok(e.includes('`\n#define F( x ) ( x * 2.0 )\nuniform float a;float b;\nvec3 f(float c){return vec3(${Y},c=-a);}\n`'), e);
  assert.ok(e.includes('const B = `  // fora da marca  `;'), 'template sem a marca fica igual');
  assert.ok(e.includes('const C = /* glsl */ `float c; // ${X}`;'), 'expressão dentro de comentário: fica igual');
  assert.equal(enxugarGlsl('x = /* glsl */ `a ${`b ${1}`} // c`;'), 'x = /* glsl */ `a ${`b ${1}`}`;');
});

test('mali: #if do pré-processador', () => {
  const m = new Map([['A', '1'], ['N', '3'], ['USE_X', '']]);
  assert.equal(avaliarSe('defined( USE_X ) && N > 2', m), true);
  assert.equal(avaliarSe('defined(USE_Y) || N < 2', m), false);
  assert.equal(avaliarSe('!defined USE_Y', m), true);
  assert.equal(avaliarSe('( NADA > 0 )', m), false);
  assert.equal(avaliarSe('A == 1 && 2u > 1u', m), true);
  const p = preprocessar('#define USE_A\n#ifdef USE_A\na\n#ifndef USE_B\nb\n#else\nc\n#endif\n#elif 1\nd\n#else\ne\n#endif\n#if 0\nf\n#elif defined(USE_A)\ng\n#endif');
  assert.deepEqual(p.texto.split('\n'), ['a', 'b', 'g']);
});

test('mali: declarações globais ignoram corpo de função', () => {
  const st = declaracoesGlobais('uniform vec3 a; void f(in vec3 x, out float y) { float z; if (true) { z = 1.0; } } struct S { vec3 c; float d; }; out vec2 v;');
  assert.deepEqual(st, ['uniform vec3 a', 'struct S { vec3 c; float d; }', 'out vec2 v']);
});

test('mali: contagem por estágio e falhas acima do limite', () => {
  const vs = `#version 300 es
#define SHADER_NAME teste
#define N 3
#define attribute in
#define varying out
attribute vec3 position; in mat4 instanceMatrix; in vec2 uv;
uniform mat4 m; uniform sampler2D alturas;
varying vec2 vUv; out vec3 vN[2]; flat out int vId;
struct Luz { vec3 cor; vec3 dir; };
void main() { vec4 p = vec4(position, 1.0); gl_Position = p; }`;
  const fs = `#version 300 es
precision highp float;
#define varying in
struct Luz { vec3 cor; vec3 dir; };
uniform Luz luzes[ N_LUZES ];
uniform sampler2D a, b[4];
uniform mat3 k;
uniform float vals[10];
#ifdef USE_EXTRA
uniform sampler2D c[20];
#endif
varying vec2 vUv; in vec3 vN[2]; flat in int vId;
layout(location = 0) out highp vec4 cor;
void main() { cor = vec4(1.0); }`;
  const r = contarPrograma(vs, fs.replace('N_LUZES', '2'));
  assert.equal(r.nome, 'teste');
  assert.deepEqual(r.amostradores, { v: 1, f: 5 });
  assert.equal(r.atributos, 6); // position 1, instanceMatrix 4, uv 1
  assert.equal(r.varyings, 4); // vUv 1, vN 2, vId 1
  assert.equal(r.uniformesF, 2 * 2 + 3 + 10); // luzes, k, vals
  assert.deepEqual(r.falhas, []);
  const muito = contarPrograma(vs, '#define USE_EXTRA\n' + fs.replace('N_LUZES', '100'));
  assert.equal(muito.amostradores.f, 25);
  assert.ok(muito.falhas.some((f) => f.includes('amostradores no fragmento')));
  assert.ok(muito.falhas.some((f) => f.includes('vetores de uniforme')));
});

test('bancada: orçamento por perfil e por família (do contrato do render)', () => {
  assert.deepEqual(conferirOrcamento({ calls: 300, tris: 900e3 }, 'media'), []);
  assert.equal(conferirOrcamento({ calls: 301, tris: 900001 }, 'media').length, 2);
  assert.equal(conferirOrcamento({ calls: 201, tris: 1 }, 'leve').length, 1);
  assert.deepEqual(conferirOrcamento({ calls: 1400, tris: 4e6 }, 'ultra'), []);
  const f = conferirOrcamento({ calls: 100, tris: 500e3, trisSombra: 70e3, familias: { predios: 250e3, arvores: 90e3, resto: 80e3 } }, 'media', { familias: true });
  assert.equal(f.length, 2); // prédios e sombra passam do teto; árvores e resto não
  assert.equal(conferirOrcamento({ calls: 1, tris: 1, familias: { inventada: 1 } }, 'media', { familias: true }).length, 1);
  assert.equal(conferirOrcamento({ calls: 1, tris: 1 }, 'media', { memoria: { geometriaMB: 70 } }).length, 1);
});
