// Mundo: monta todas as estruturas da composição, liga cada etapa à sua peça 3D, mostra/esconde
// conforme o progresso e anima o que tem vida (fauna, manadas, água).
import * as THREE from 'three';
import { faixas } from './models/aneis.js';
import { biblioteca, crd } from './models/biblioteca.js';
import { bioma, anfiteatro, gorilas, acelerador, savana, santuarioInterior, CasasVila } from './models/leste.js';
import { ciencias, alaOnda, lago, sedePatio } from './models/centro.js';
import { escola, campo, engenharia, instituto, gramadoUni } from './models/campus.js';
import { praca, passarela, ponteCoberta } from './models/praca.js';
import { LOTES, predioCanteiro, ambienteCanteiro } from './models/canteiro.js';
import { PASSARELAS } from '../data/planta.js';
import { Crowd } from './figuras.js';
import { inPoly } from '../core/util.js';
import { bake } from './geom.js';

export class Mundo {
  constructor(engine, ground, forest) {
    this.e = engine; this.ground = ground; this.forest = forest; const scene = engine.scene;
    this.root = new THREE.Group(); this.root.name = 'mundo'; scene.add(this.root);
    // edifícios-fita (módulos por nível)
    this.faixas = faixas(); this.faixas.onda = alaOnda(); this.casas = new CasasVila();
    const FP = { sede: 'sede', humanidades: 'humanidades', onda: 'onda', uniElo: 'uniElo' };
    for (const [k, f] of Object.entries(this.faixas)) { this.root.add(f.group); f.refresh(); f.group.userData.pick = FP[k] ? { tipo: 'proj', id: FP[k] } : { tipo: 'modulos', id: k }; }
    this.root.add(this.casas.group); this.casas.group.userData.pick = { tipo: 'modulos', id: 'casas' };
    // marcos com etapas
    const list = [biblioteca(), crd(), bioma(), anfiteatro(), gorilas(), acelerador(), savana(), santuarioInterior(), ciencias(), lago(ground), sedePatio(), escola(), campo(), engenharia(), instituto(), gramadoUni(), praca(), ponteCoberta()];
    for (const id of Object.keys(PASSARELAS)) list.push(passarela(id));
    const PROJ_DE = { sedePatio: 'sede' };
    this.modelos = {}; for (const m of list) { this.modelos[m.id] = m; this.root.add(m.root); m.root.userData.pick = { tipo: 'proj', id: PROJ_DE[m.id] || m.id }; for (const p of Object.values(m.partes)) { bake(p); p.visible = false; } for (const s of Object.values(m.esqueletos || {})) { bake(s); s.visible = false; } }
    // canteiro de obras
    this.canteiro = new THREE.Group(); this.canteiro.name = 'canteiro'; this.root.add(this.canteiro); this.canteiro.add(ambienteCanteiro()); this.predios = {};
    for (const [id, l] of Object.entries(LOTES)) { const g = predioCanteiro(id.startsWith('usina') ? 'usina' : id); g.position.set(l.x, 0, l.z); g.rotation.y = l.r; g.visible = false; g.userData.pick = { tipo: 'predio', id }; this.canteiro.add(g); this.predios[id] = g; }
    // pessoas na praça e nas passarelas
    this.povo = new Crowd('pessoa', 260); this.povo.mesh.visible = false; this.root.add(this.povo.mesh); this.povoAreas = [];
    this.animados = [];
  }
  parte(modelo, etapa) { return this.modelos[modelo]?.partes[etapa]; }
  setEtapa(modelo, etapa, feito) {
    const p = this.parte(modelo, etapa); if (!p) return; p.visible = feito;
    if (feito && p.userData.chao) { this.ground.flags[p.userData.chao] = true; this.ground.paint(); }
    if (feito && p.userData.nivel && modelo === 'lago') this.ground.lake.position.y = -0.1;
    if (!feito && p.userData.nivel && modelo === 'lago') this.ground.lake.position.y = -0.3;
    this._animados(); this.e.shadowDirty = true;
  }
  _animados() { this.animados = []; for (const m of Object.values(this.modelos)) for (const p of Object.values(m.partes)) if (p.visible && (p.userData.manadas || p.userData.update)) this.animados.push(p); }
  // tudo concluído (a composição da foto)
  tudoPronto() {
    for (const f of Object.values(this.faixas)) f.setTodos(f.max); this.casas.setTodos(this.casas.max);
    for (const [id, m] of Object.entries(this.modelos)) for (const k of Object.keys(m.partes)) this.setEtapa(id, k, true);
    this.ground.flags.praca = true; this.ground.flags.verde = Object.fromEntries(['anel', 'uni', 'ciencias', 'sede', 'biblio', 'savana', 'bioma', 'vila', 'gorilas', 'acelerador', 'santuario'].map((k) => [k, true])); this.ground.paint(); this.ground.lake.position.y = -0.1; this.ground.tampa.visible = false;
    this.povoar();
  }
  povoar() {
    this.povo.clear(); const pr = this.modelos.praca.partes.e3;
    if (pr.visible) { const poly = pr.userData.pessoas.area; for (let i = 0; i < 70; i++) { const pts = []; let x = 4, z = 15; for (let k = 0; k < 4; k++) { let nx, nz, t = 0; do { nx = -2.5 + Math.random() * 14; nz = 12 + Math.random() * 7; t++; } while (!inPoly(nx, nz, poly) && t < 30); pts.push([nx, 0.03, nz]); } this.povo.add(pts, { speed: 0.1 + Math.random() * 0.08, idle: 1 }); } }
    for (const m of Object.values(this.modelos)) if (m.caminho && m.partes.e1.visible) for (let i = 0; i < 6; i++) this.povo.add(m.caminho, { speed: 0.12 + Math.random() * 0.06, phase: Math.random() });
    this.povo.mesh.visible = this.povo.walkers.length > 0;
  }
  update(dt, t) {
    for (const p of this.animados) { if (p.userData.manadas) for (const m of p.userData.manadas) m.update(dt, t); if (p.userData.update) p.userData.update(t); }
    if (this.povo.mesh.visible) this.povo.update(dt, t);
  }
}
