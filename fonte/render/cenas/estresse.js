// Cena 'estresse' (D33, 4.6, 5.3): o pior caso do Média numa tela cheia, para o dono medir no Poco X7 na Prévia 0 (com
// ?painel=1 a página de teste abre por cima): alvo HDR com MSAA, céu, neblina, sombra própria e uma fachada
// aproximada (janelas procedurais em metros, filtradas por fwidth, vidro que reflete o céu) cobrindo a tela inteira,
// com 900 mil triângulos e perto de 270 chamadas em regime (o pior quadro, com um quadro-chave novo da luz do
// ambiente, fica abaixo de 300). As torres são malhas separadas (uma chamada cada, como os setores
// do jogo) e a sombra sai de um só gêmeo instanciado com as caixas. window.__resultado confere o orçamento da cena.
import * as THREE from 'three';
import { criarMaterial } from '../materiais/biblioteca.js';
import { projetar } from '../sombra/projetores.js';

/** Alvos da cena (os tetos do Média, A6). */
export const ESTRESSE = Object.freeze({ chamadas: 300, triangulos: 900000, torres: 256 });

// fachada aproximada: andares de 3,3 m, vãos de 1,6 m, vidro escuro e liso, pele de concreto claro; o teto é laje
const FACHADA_FRAG = /* glsl */ `
float fcFaixa( float x, float w, float fw ) {
  float f = fract( x );
  return smoothstep( 0.5 - w - fw, 0.5 - w + fw, f ) - smoothstep( 0.5 + w - fw, 0.5 + w + fw, f );
}
`;

function materialFachada(corPele) {
  const m = criarMaterial({ color: corPele, roughness: 0.78, metalness: 0 }, { ganchos: ['sombra', 'neblina'] });
  const anterior = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    anterior.call(m, shader, renderer);
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `${FACHADA_FRAG}\nvoid main() {`)
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
  {
    vec3 nf = normalize( cross( dFdx( vGPosMundo ), dFdy( vGPosMundo ) ) );
    float parede = 1.0 - step( 0.8, abs( nf.y ) );
    float u = abs( nf.x ) > abs( nf.z ) ? vGPosMundo.z : vGPosMundo.x;
    vec2 g = vec2( u / 1.6, vGPosMundo.y / 3.3 );
    vec2 fw = fwidth( g );
    float janela = fcFaixa( g.x, 0.36, fw.x ) * fcFaixa( g.y - 0.08, 0.3, fw.y );
    // de longe (célula menor que 2 px) vale a média: nada cintila
    float longe = smoothstep( 0.25, 0.5, max( fw.x, fw.y ) );
    janela = mix( janela, 0.43, longe ) * parede;
    float hs = fract( sin( dot( floor( g ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
    diffuseColor.rgb = mix( diffuseColor.rgb * ( 0.92 + 0.16 * hs * parede ), vec3( 0.035, 0.042, 0.05 ), janela );
    roughnessFactor = mix( roughnessFactor, 0.1, janela );
  }`,
      );
  };
  const chave = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `${chave()}|fachada-estresse`;
  return m;
}

export function registrar(registrarCena) {
  registrarCena('estresse', {
    sim: 'vazia',
    hora: 15.5,
    perfil: 'media',
    dominios: ['ceu', 'bancada', 'entrada'],
    camera: { x: 0, z: 150, dist: 330, guinada: 0, inclinacao: 10 },
    async montar(ctx) {
      const { cena, medidas } = ctx;
      const grupo = new THREE.Group();
      grupo.name = 'estresse';
      const chao = medidas.familia(new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), criarMaterial({ superficie: 'asfaltoGasto' }, { ganchos: ['sombra', 'neblina'] })), 'terreno');
      chao.name = 'estresse:chao';
      grupo.add(chao);
      // 4 formas de torre subdivididas (~3.200 triângulos cada) e 3 peles; uma chamada por torre
      const formas = [
        new THREE.BoxGeometry(24, 1, 24, 8, 54, 8),
        new THREE.BoxGeometry(32, 1, 20, 10, 44, 6),
        new THREE.BoxGeometry(18, 1, 30, 6, 52, 10),
        new THREE.BoxGeometry(28, 1, 28, 9, 46, 9),
      ].map((g) => g.translate(0, 0.5, 0));
      const peles = ['#b9b2a6', '#9da3a8', '#c4b8a3'].map((c) => materialFachada(c));
      const caixas = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshBasicMaterial(), ESTRESSE.torres);
      caixas.visible = false;
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      let k = 0;
      // quarteirões dos dois lados de uma avenida que corre para o norte, até 1,6 km
      for (let j = 0; k < ESTRESSE.torres; j++) {
        for (const lado of [-1, 1]) {
          for (let c = 0; c < 4 && k < ESTRESSE.torres; c++) {
            const f = (j * 7 + c * 3 + (lado > 0 ? 1 : 0)) % formas.length;
            const alt = 40 + ((j * 37 + c * 53 + (lado > 0 ? 17 : 0)) % 110);
            const x = lado * (34 + c * 42);
            const z = 60 - j * 46;
            const torre = new THREE.Mesh(formas[f], peles[(j + c) % peles.length]);
            torre.position.set(x, 0, z);
            torre.scale.set(1, alt, 1);
            torre.name = `estresse:torre${k}`;
            medidas.familia(torre, 'predios');
            grupo.add(torre);
            const p = formas[f].parameters;
            caixas.setMatrixAt(k, m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(p.width, alt, p.depth)));
            k++;
          }
        }
      }
      caixas.instanceMatrix.needsUpdate = true;
      grupo.add(caixas);
      cena.add(grupo);
      projetar(ctx, caixas);
      return {
        resultado() {
          const s = ctx.medidas.stats;
          const falhas = [];
          if (s.calls < ESTRESSE.chamadas * 0.8 || s.calls > ESTRESSE.chamadas) falhas.push(`${s.calls} chamadas (teto ${ESTRESSE.chamadas})`);
          if (s.tris < ESTRESSE.triangulos * 0.9 || s.tris > ESTRESSE.triangulos * 1.02) falhas.push(`${s.tris} triângulos (alvo ${ESTRESSE.triangulos})`);
          if (!ctx.ambiente) falhas.push('sem o céu');
          return { ok: falhas.length === 0, falhas, medidas: { calls: s.calls, tris: s.tris, callsSombra: s.callsSombra, msaa: s.msaa, alvo: s.alvo } };
        },
        descartar() {
          ctx.sombra.soltar(caixas);
          cena.remove(grupo);
        },
      };
    },
  });
}
