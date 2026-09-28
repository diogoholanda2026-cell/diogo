// Cena 'rua' (desenho do render 15.2, A6 e A10: 16h): a avenida comercial do bairro Sudeste da cidade sintética, com
// canteiro de palmeiras, cruzamento com semáforo, faixas do CTB, calçadas, postes, árvores e carros. ?vista= troca a
// câmera sem sair do lugar: rasante (padrão: no nível da rua, olhando a avenida), 300 (a vista de 300 m do bairro),
// cruzamento (de cima, a 45 graus: meio-fio, zebras e retenção) e orla (a avenida da orla com pedra portuguesa);
// ?hora= a hora do céu (21 dá a noite com a luz da rua e os faróis).
// A cena espera a oficina entregar os setores de vias e de prédios da vista, povoa o tráfego e deixa os carros
// andando; o resultado traz as medidas das vias, dos objetos e dos carros e as famílias do quadro.

/** O cruzamento da avenida com a rua no Sudeste da cidade sintética (nó 409) e as vistas. */
export const RUA = Object.freeze({ x: 907, z: 526.3 });
export const VISTAS_RUA = Object.freeze({
  // na faixa da direita da avenida, 30 m antes do cruzamento, olhando para leste
  rasante: { x: 880, z: 531.2, dist: 16, inclinacao: 4, guinada: 92 },
  300: { x: 912, z: 520, dist: 300, inclinacao: 32, guinada: 38 },
  cruzamento: { x: 907, z: 526.3, dist: 70, inclinacao: 48, guinada: 62 },
  orla: { x: 1543, z: 1570, dist: 30, inclinacao: 5, guinada: 110 },
});

export function registrar(registrarCena) {
  registrarCena('rua', {
    sim: 'sintetica',
    hora: 16,
    camera: { ...VISTAS_RUA.rasante },
    async montar(ctx) {
      const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
      const nome = qs.get('vista') ?? 'rasante';
      const v = VISTAS_RUA[nome] ?? VISTAS_RUA.rasante;
      ctx.cameraApi.definir({ ...v });
      const falhas = [];
      const vias = ctx.dominio('vias');
      const predios = ctx.dominio('predios');
      const trafego = ctx.dominio('trafego');
      if (!vias?.preparar) falhas.push('o domínio vias é o substituto da F0 (a R3a não registrou)');
      try {
        await Promise.all([vias?.preparar?.({ teto: 180000 }), predios?.preparar?.({ teto: 180000 })]);
        if (vias?.pronto && !vias.pronto()) falhas.push('a oficina não entregou todos os setores de vias da vista a tempo');
      } catch (e) {
        falhas.push(`preparar falhou: ${e?.message ?? e}`);
      }
      trafego?.povoar?.(ctx);
      trafego?.animar?.(true);
      return {
        resultado() {
          const s = ctx.stats;
          const mv = vias?.medidas?.() ?? null;
          // a conferência roda a cada chamada, sem acumular na lista da montagem
          const agora = [...falhas];
          if (mv && !mv.visiveis) agora.push('nenhum setor de via desenhado');
          return {
            ok: agora.length === 0,
            falhas: agora,
            vista: nome,
            vias: mv,
            objetos: ctx.dominio('props')?.medidas?.() ?? null,
            carros: trafego?.medidas?.() ?? null,
            luzRua: ctx.luzRua ? { luzes: ctx.luzRua.luzes, versao: ctx.luzRua.versao } : null,
            quadro: { calls: s.calls, tris: s.tris, callsSombra: s.callsSombra, trisSombra: s.trisSombra, familias: { ...s.familias } },
          };
        },
      };
    },
  });
}
