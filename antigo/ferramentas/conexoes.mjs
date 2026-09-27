// Conferência das juntas na geometria de verdade (roda em Node, sem navegador, em alguns segundos): monta as fitas no
// nível máximo e todos os modelos e passarelas prontos, amostra os triângulos acima do chão (y > 0,06; sem instâncias:
// arbustos, árvores e gente ficam de fora) numa grade de 0,1 e aponta onde peças de projetos DIFERENTES ocupam a mesma
// célula na mesma faixa de altura. Mostra também onde cada passarela começa e termina.
// A regra das juntas das pegadas (planta) está em ferramentas/teste-planta.mjs; aqui aparece o que o desenho acrescenta
// (beirais, floreiras, pilares, pontas de passarela pousando nos prédios).
// Uso: node ferramentas/conexoes.mjs [limite de células por par, padrão 100: as juntas de lado cruzam só os beirais, 0,6 a 0,8 u²]   (código 1 se algum par passar do limite)
const nada = new Proxy(function () {}, { get: (t, k) => (k === 'data' ? [] : k === Symbol.toPrimitive ? () => 0 : nada), apply: () => nada }); // canvas de mentira: tudo aceita tudo
globalThis.document = { createElement: () => ({ getContext: () => nada, width: 1, height: 1 }) };
globalThis.window = globalThis; globalThis.self = globalThis;
const THREE = await import('three');
const { A, PASSARELAS } = await import('../fonte/data/planta.js');
const { makeMaterials } = await import('../fonte/render/materials.js'); makeMaterials();
const { faixas } = await import('../fonte/render/models/aneis.js');
const { biblioteca, crd } = await import('../fonte/render/models/biblioteca.js');
const { anfiteatro, acelerador } = await import('../fonte/render/models/leste.js');
const { bioma, gorilas, savana, santuarioInterior } = await import('../fonte/render/models/cupula.js');
const { ciencias, lago, sedePatio } = await import('../fonte/render/models/centro.js');
const { escola, campo, gramadoUni } = await import('../fonte/render/models/campus.js');
const { praca, passarela, ponteCoberta } = await import('../fonte/render/models/praca.js');

const LIM = +(process.argv[2] || 100), S = 0.1, TOL = 0.05;
// pares que se tocam de propósito: vidro no vidro (Eden Project), a mata dentro da Cúpula, o portal sobre o Anel e
// as pontas das passarelas que pousam nos prédios (conferidas à parte, pela ponta)
const PERMITIDO = new Set(['bioma|gorilas', 'gorilas|santuarioInt', 'bioma|savana', 'bioma|santuarioInt', 'santuarioInt|savana', 'gorilas|savana']);
const par = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
const PROJ_DE = { sedePatio: 'sede', santuarioInterior: 'santuarioInt' };

// fontes: [projeto, Object3D]
const fontes = [];
const F = faixas(); for (const [k, f] of Object.entries(F)) { f.setTodos(f.max); fontes.push([k, f.group]); }
const modelos = [biblioteca(), crd(), bioma(), anfiteatro(), gorilas(), acelerador(), savana(), santuarioInterior(), ciencias(), lago(), sedePatio(), escola(), campo(), gramadoUni(), praca(), ponteCoberta(), ...Object.keys(PASSARELAS).map((k) => passarela(k))];
for (const m of modelos) { for (const p of Object.values(m.partes)) p.visible = true; fontes.push([PROJ_DE[m.id] || m.id, m.root]); }

// grade: célula -> [[projeto, y0, y1], ...] (faixas de altura por projeto, juntadas)
const grade = new Map(); const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _p = new THREE.Vector3();
const marca = (proj, x, y0, z, y1) => {
  const k = Math.floor(x / S) + ':' + Math.floor(z / S); let l = grade.get(k); if (!l) grade.set(k, (l = []));
  const e = l.find((q) => q[0] === proj); if (e) { e[1] = Math.min(e[1], y0); e[2] = Math.max(e[2], y1); } else l.push([proj, y0, y1]);
};
for (const [proj, raiz] of fontes) {
  raiz.updateMatrixWorld(true);
  raiz.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry?.attributes?.position) return;
    const g = o.geometry, pa = g.attributes.position, idx = g.index, n = idx ? idx.count : pa.count; const M = o.matrixWorld;
    for (let t = 0; t < n; t += 3) {
      const v = (j) => (idx ? idx.getX(t + j) : t + j);
      _a.fromBufferAttribute(pa, v(0)).applyMatrix4(M); _b.fromBufferAttribute(pa, v(1)).applyMatrix4(M); _c.fromBufferAttribute(pa, v(2)).applyMatrix4(M);
      const y0 = Math.min(_a.y, _b.y, _c.y), y1 = Math.max(_a.y, _b.y, _c.y); if (y1 < 0.06) continue; // chão, água e placas pintadas
      const L = Math.max(_a.distanceTo(_b), _b.distanceTo(_c), _c.distanceTo(_a)); const k = Math.max(1, Math.ceil(L / (S * 0.7)));
      for (let i = 0; i <= k; i++) for (let j = 0; j <= k - i; j++) { const u = i / k, w = j / k; _p.copy(_a).multiplyScalar(1 - u - w).addScaledVector(_b, u).addScaledVector(_c, w); if (_p.y >= 0.06) marca(proj, _p.x, _p.y, _p.z, _p.y); }
    }
  });
}
// pontas das passarelas: o que existe a menos de 0,6 do começo e do fim (a passarela pousa ali)
const pontas = {}; for (const [k, d] of Object.entries(PASSARELAS)) pontas['pas_' + k] = [d.pts[0], d.pts[d.pts.length - 1]];
const naPonta = (proj, x, z) => (pontas[proj] || []).some((p) => Math.hypot(p[0] - x, p[1] - z) < 0.6);

const conflitos = new Map();
for (const [k, l] of grade) {
  if (l.length < 2) continue; const [i, j] = k.split(':').map(Number); const x = (i + 0.5) * S, z = (j + 0.5) * S;
  for (let a = 0; a < l.length; a++) for (let b = a + 1; b < l.length; b++) {
    const [pa, a0, a1] = l[a], [pb, b0, b1] = l[b]; const sob = Math.min(a1, b1) - Math.max(a0, b0); if (sob < TOL) continue;
    const pp = par(pa, pb); if (PERMITIDO.has(pp) || naPonta(pa, x, z) || naPonta(pb, x, z)) continue;
    let c = conflitos.get(pp); if (!c) conflitos.set(pp, (c = { n: 0, ex: [x, z, Math.max(a0, b0)], sob: 0 })); c.n++; if (sob > c.sob) { c.sob = sob; c.ex = [x, z, Math.max(a0, b0)]; }
  }
}
const out = []; let graves = 0;
out.push(`${fontes.length} peças, ${grade.size} células de ${S} com obra acima do chão`);
for (const [pp, c] of [...conflitos].sort((a, b) => b[1].n - a[1].n)) {
  const grave = c.n > LIM; if (grave) graves++;
  out.push(`${grave ? 'CRUZA' : 'toca '} ${pp}: ${c.n} células (${(c.n * S * S).toFixed(2)} u²), sobreposição até ${c.sob.toFixed(2)} em (${c.ex.map((v) => v.toFixed(2)).join('; ')})`);
}
// onde cada passarela começa e termina: projetos com obra a menos de 0,6 da ponta
for (const [id, [p0, p1]] of Object.entries(pontas)) {
  const perto = (p) => { const s = new Set(); for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) for (const [q] of grade.get(Math.floor(p[0] / S + i) + ':' + Math.floor(p[1] / S + j)) || []) if (q !== id) s.add(q); return [...s].join(', ') || 'chão'; };
  out.push(`${id}: começa em (${p0[0].toFixed(2)}; ${p0[1].toFixed(2)}) junto de [${perto(p0)}], termina em (${p1[0].toFixed(2)}; ${p1[1].toFixed(2)}) junto de [${perto(p1)}]`);
}
console.log(out.join('\n'));
process.exit(graves ? 1 : 0);
