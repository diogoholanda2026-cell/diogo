// Cena 'prova-sombra' (D43), da F0, herdada pela R1a (a sombra agora em render/sombra/mapa.js, com cascatas e a
// profundidade invertida quando o aparelho tem EXT_clip_control): prova que a sombra própria deixa o LOD0
// detalhado VISÍVEL SEM PROJETAR e a caixa LOD1 INVISÍVEL PROJETANDO, numa cena só de projetores desenhada com
// renderer.render(cenaSombra, camOrto) num alvo com DepthTexture, com callsSombra contadas à parte.
//
// Três pórticos (dois pilares, uma ponte no alto e um mastro): o LOD0 tem o vão aberto e o mastro; o LOD1 é a caixa de
// massa (sem vão e sem mastro), escondida na vista (magenta, para que qualquer pixel dele apareça) e com o gêmeo
// projetor na cena de sombra, que COMPARTILHA a geometria e o buffer de instâncias. Conferido por leitura de pixels:
//   A  chão na sombra do vão (só a caixa cobre): escuro
//   D  chão na sombra do alto do mastro (só o LOD0 cobre): claro
//   B  chão aberto (referência): claro
//   nenhum pixel magenta na imagem (a caixa não aparece)
// e dois controles que provam que a conta enxerga a diferença: com a caixa visível aparece magenta; com o LOD0
// projetando, D escurece. window.__resultado = { ok, falhas, medidas }.
import * as THREE from 'three';

const SOL = new THREE.Vector3(-0.28, 0.64, 0.72).normalize(); // de onde vem a luz (sul-sudoeste, 40 graus)
const PORTICOS = [
  { x: -90, h: 56 },
  { x: 0, h: 72 },
  { x: 90, h: 48 },
];
const LARG = 36; // frente do pórtico
const FUNDO = 12; // profundidade
const PILAR = 10; // largura de cada pilar (vão de 16 m)
const PONTE = 12; // altura da ponte no alto
const MASTRO = { lado: 4, altura: 24 };

function caixa(w, h, d, x, y, z) {
  return new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
}

/** Pontos de teste no chão: onde cai a sombra de um ponto P pela direção do sol. */
const sombraNoChao = (p, s) => p.clone().addScaledVector(s, -p.y / s.y);

export function registrar(registrarCena) {
  registrarCena('prova-sombra', {
    sim: 'vazia',
    dominios: false,
    hora: 15,
    camera: { x: 0, z: -40, dist: 360, guinada: 158, inclinacao: 34 },
    async montar(ctx) {
      const { cena, sombra, ganchos, medidas, renderer } = ctx;
      cena.background = new THREE.Color('#9db8d2');
      const luz = new THREE.DirectionalLight(0xfff4e6, 3.2);
      const hemi = new THREE.HemisphereLight(0xc4d6ea, 0x6a6154, 0.9);
      cena.add(luz, luz.target, hemi);
      // neblina da prova: uma cor só no anel do horizonte e no alto (sem o domínio do céu)
      const corNeblina = new THREE.Color('#b8c6d3');
      for (const v of ganchos.uniformes.gNeblinaAnel.value) v.set(corNeblina.r, corNeblina.g, corNeblina.b);
      ganchos.uniformes.gNeblinaZenite.value.set(corNeblina.r, corNeblina.g, corNeblina.b);

      const matChao = ganchos.aplicar(new THREE.MeshStandardMaterial({ color: '#8d8a80', roughness: 0.92, metalness: 0 }), ['sombra', 'neblina']);
      const matConcreto = ganchos.aplicar(new THREE.MeshStandardMaterial({ color: '#cdc6b8', roughness: 0.8, metalness: 0 }), ['sombra', 'neblina']);
      const chao = medidas.familia(new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2), matChao), 'terreno');
      chao.name = 'prova:chao';
      cena.add(chao);

      // LOD0: pilares, ponte e mastro de cada pórtico (visíveis, fora da cena de sombra)
      const lod0 = new THREE.Group();
      lod0.name = 'prova:lod0';
      for (const p of PORTICOS) {
        const partes = [
          caixa(PILAR, p.h, FUNDO, p.x - LARG / 2 + PILAR / 2, 0, 0),
          caixa(PILAR, p.h, FUNDO, p.x + LARG / 2 - PILAR / 2, 0, 0),
          caixa(LARG - 2 * PILAR, PONTE, FUNDO, p.x, p.h - PONTE, 0),
          caixa(MASTRO.lado, MASTRO.altura, MASTRO.lado, p.x - LARG / 2 + PILAR / 2, p.h, 0),
        ];
        for (const g of partes) lod0.add(medidas.familia(new THREE.Mesh(g, matConcreto), 'predios'));
      }
      cena.add(lod0);

      // LOD1: a caixa de massa de cada pórtico, instanciada; escondida na vista e projetando pelo gêmeo
      const geoCaixa = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
      const lod1 = new THREE.InstancedMesh(geoCaixa, new THREE.MeshBasicMaterial({ color: 0xff00ff }), PORTICOS.length);
      lod1.name = 'prova:lod1';
      const m = new THREE.Matrix4();
      PORTICOS.forEach((p, i) => lod1.setMatrixAt(i, m.compose(new THREE.Vector3(p.x, 0, 0), new THREE.Quaternion(), new THREE.Vector3(LARG, p.h, FUNDO))));
      lod1.instanceMatrix.needsUpdate = true;
      lod1.visible = false; // de perto a vista mostra o LOD0
      cena.add(lod1);
      const gemeo = medidas.familia(sombra.projetor(lod1), 'sombra');

      const dirSol = SOL.clone();
      const centro = new THREE.Vector3(0, 0, -30);
      const aplicarSol = () => {
        // com ?sol=anda a luz gira em volta do eixo vertical pela hora do céu (15 graus por hora)
        const giro = ((ctx.horaDoCeu() - 15) * 15 * Math.PI) / 180;
        dirSol.copy(SOL).applyAxisAngle(new THREE.Vector3(0, 1, 0), -giro);
        ctx.sol.dir.copy(dirSol);
        luz.position.copy(dirSol).multiplyScalar(800);
        sombra.acompanhar(centro, 230, dirSol);
      };
      aplicarSol();

      // ---------- conferência por pixels, num alvo próprio (linear, sem tom) ----------
      function lerPixels(alvo) {
        const px = new Uint8Array(alvo.width * alvo.height * 4);
        renderer.readRenderTargetPixels(alvo, 0, 0, alvo.width, alvo.height, px);
        return px;
      }
      function desenharEmAlvo(alvo) {
        sombra.sujo = true;
        const info = renderer.info.render;
        const c0 = info.calls;
        const t0 = info.triangles;
        sombra.desenhar(renderer, null, ganchos.uniformes);
        const passeSombra = { calls: info.calls - c0, tris: info.triangles - t0 };
        const c1 = info.calls;
        renderer.setRenderTarget(alvo);
        renderer.render(cena, ctx.camera);
        renderer.setRenderTarget(null);
        return { sombra: passeSombra, cena: info.calls - c1 };
      }
      function brilho(px, alvo, p) {
        const v = p.clone().project(ctx.camera);
        const x = Math.round(((v.x + 1) / 2) * (alvo.width - 1));
        const y = Math.round(((v.y + 1) / 2) * (alvo.height - 1));
        if (x < 2 || y < 2 || x >= alvo.width - 2 || y >= alvo.height - 2 || v.z <= -1 || v.z >= 1) return null;
        let s = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const k = 4 * ((y + dy) * alvo.width + x + dx);
            s += 0.2126 * px[k] + 0.7152 * px[k + 1] + 0.0722 * px[k + 2];
            n++;
          }
        }
        return s / n / 255;
      }
      const magenta = (px) => {
        let n = 0;
        for (let k = 0; k < px.length; k += 4) if (px[k] > 150 && px[k + 1] < 60 && px[k + 2] > 150) n++;
        return n;
      };

      let resultado = null;
      function conferir() {
        const w = Math.max(64, Math.round(ctx.canvas.clientWidth / 2));
        const h = Math.max(64, Math.round(ctx.canvas.clientHeight / 2));
        const alvo = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true });
        aplicarSol();
        const meio = PORTICOS[1];
        const zc = 0;
        const pA = sombraNoChao(new THREE.Vector3(meio.x, meio.h / 2 - 8, zc), dirSol);
        const xMastro = meio.x - LARG / 2 + PILAR / 2;
        const pD = sombraNoChao(new THREE.Vector3(xMastro, meio.h + MASTRO.altura - 4, zc), dirSol);
        // referência: o chão perto da borda de baixo da tela, entre a câmera e as sombras (sempre à vista e ao sol)
        const r = new THREE.Vector3(0, -0.85, 0.5).unproject(ctx.camera).sub(ctx.camera.position).normalize();
        const pB = ctx.camera.position.clone().addScaledVector(r, -ctx.camera.position.y / r.y);
        const falhas = [];

        const passe = desenharEmAlvo(alvo);
        const px = lerPixels(alvo);
        const A = brilho(px, alvo, pA);
        const B = brilho(px, alvo, pB);
        const D = brilho(px, alvo, pD);
        const nMagenta = magenta(px);

        // controle 1: a caixa visível aparece (magenta) na mesma conta
        lod1.visible = true;
        desenharEmAlvo(alvo);
        const magentaControle = magenta(lerPixels(alvo));
        lod1.visible = false;

        // controle 2: com o LOD0 projetando, a sombra do mastro aparece em D
        const extras = lod0.children.map((o) => sombra.projetor(o));
        desenharEmAlvo(alvo);
        const Dcontrole = brilho(lerPixels(alvo), alvo, pD);
        for (const o of lod0.children) sombra.soltar(o);
        sombra.sujo = true;

        const soProjetores = sombra.cena.children.length === 1 && sombra.cena.children[0] === gemeo && !sombra.cena.children.includes(lod0);
        if (!soProjetores) falhas.push('a cena de sombra tem algo além do gêmeo do LOD1');
        if (gemeo.instanceMatrix !== lod1.instanceMatrix || gemeo.geometry !== lod1.geometry) falhas.push('o gêmeo não compartilha geometria e instâncias do LOD1');
        const nc = sombra.cascatas ?? 1; // o gêmeo é desenhado uma vez por cascata
        if (passe.sombra.calls !== nc) falhas.push(`passe de sombra com ${passe.sombra.calls} chamadas (esperado ${nc})`);
        if (passe.sombra.tris !== 12 * PORTICOS.length * nc) falhas.push(`passe de sombra com ${passe.sombra.tris} triângulos (esperado ${12 * PORTICOS.length * nc})`);
        if (A === null || B === null || D === null) falhas.push('ponto de teste fora da tela');
        else {
          if (A / B > 0.6) falhas.push(`o chão na sombra do vão não escureceu (A/B ${(A / B).toFixed(2)}): a caixa LOD1 não projetou`);
          if (D / B < 0.85) falhas.push(`o chão na sombra do mastro escureceu (D/B ${(D / B).toFixed(2)}): o LOD0 projetou`);
          if (Dcontrole === null || Dcontrole / B > 0.6) falhas.push('controle: com o LOD0 projetando, D deveria escurecer');
        }
        if (nMagenta > 0) falhas.push(`${nMagenta} pixels da caixa LOD1 na imagem (devia estar invisível)`);
        if (!(magentaControle > 50)) falhas.push('controle: a caixa visível deveria aparecer em magenta');
        alvo.dispose();
        resultado = {
          ok: falhas.length === 0,
          falhas,
          medidas: {
            A: +A?.toFixed(3), B: +B?.toFixed(3), D: +D?.toFixed(3), Dcontrole: +Dcontrole?.toFixed(3), magenta: nMagenta, magentaControle,
            callsSombra: passe.sombra.calls, trisSombra: passe.sombra.tris, callsCena: passe.cena, extras: extras.length,
          },
        };
        return resultado;
      }

      return {
        sombraPropria: true,
        quadro() {
          aplicarSol();
        },
        resultado: () => resultado ?? conferir(),
        descartar() {
          sombra.soltar(lod1);
          cena.remove(chao, lod0, lod1, luz, luz.target, hemi);
        },
      };
    },
  });
}
