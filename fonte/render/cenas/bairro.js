// Cena 'bairro' (desenho do render 15.2, A10: 9h): um bairro misto da cidade sintética (casas, lojas de rua, prédios
// médios, torres e escritórios) a 400 m e 45 graus, para a troca LOD0/LOD1 e a sombra de perto. ?vista= troca a câmera
// sem sair do lugar: rua (nível da calçada), 50, 200 (metros), lod1 (1,1 km) e lod2 (3,2 km); ?hora= a hora do céu.
// A cena espera a oficina entregar os setores da vista (predios.preparar) antes de liberar a captura, e o resultado
// traz as medidas do gerador (setores, LOD0 visíveis, instâncias, triângulos por LOD, memória, sombra).

/** Centro do bairro na cidade sintética e as vistas. */
export const BAIRRO = Object.freeze({ x: -1000, z: -460, guinada: 32 });
export const VISTAS = Object.freeze({
  padrao: { dist: 400, inclinacao: 45 },
  // a avenida comercial da orla, olhando ao longo dela
  rua: { dist: 30, inclinacao: 4, x: 1543, z: 1570, guinada: 110 },
  // rua de casas e lojas de um bairro popular denso, e um bairro misto com prédios médios
  50: { dist: 55, inclinacao: 16, x: 386, z: -958, guinada: 40 },
  200: { dist: 200, inclinacao: 30, x: 330, z: -880, guinada: 20 },
  lod1: { dist: 1100, inclinacao: 30 },
  lod2: { dist: 3200, inclinacao: 24 },
});

export function registrar(registrarCena) {
  registrarCena('bairro', {
    sim: 'sintetica',
    hora: 9,
    camera: { x: BAIRRO.x, z: BAIRRO.z, guinada: BAIRRO.guinada, ...VISTAS.padrao },
    async montar(ctx) {
      const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
      const nome = qs.get('vista') ?? 'padrao';
      const v = VISTAS[nome] ?? VISTAS.padrao;
      ctx.cameraApi.definir({ x: BAIRRO.x, z: BAIRRO.z, guinada: BAIRRO.guinada, ...v });
      const dom = ctx.dominio('predios');
      const falhas = [];
      let medidas = null;
      if (!dom?.preparar) falhas.push('o domínio predios é o substituto da F0 (o gerador não registrou)');
      else {
        try {
          medidas = await dom.preparar({ teto: 180000 });
          if (!dom.pronto()) falhas.push('a oficina não entregou todos os setores da vista a tempo');
        } catch (e) {
          falhas.push(`preparar falhou: ${e?.message ?? e}`);
        }
      }
      return {
        resultado() {
          const s = ctx.stats;
          const m = dom?.medidas?.() ?? medidas;
          if (m && !m.instancias && !m.lod0Visiveis) falhas.push('nenhum prédio desenhado');
          return {
            ok: falhas.length === 0,
            falhas: [...falhas],
            vista: nome,
            medidas: m,
            quadro: { calls: s.calls, tris: s.tris, callsSombra: s.callsSombra, trisSombra: s.trisSombra, predios: s.familias.predios, sombra: s.familias.sombra },
          };
        },
      };
    },
  });
}
