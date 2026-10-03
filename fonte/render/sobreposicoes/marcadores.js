// Marcadores de aviso sobre os prédios (D28; desenho do render 11.3; desenho da UI 6.3 e 8.9; X3a): placas viradas
// para a câmera numa chamada só, forma pela gravidade, glifo do atlas da UI, oclusão pela profundidade e teto por
// perfil (200 no PC e no Alta, 60 no Média, 30 no Leve; um por setor de longe). Aqui ficam o registro do domínio e da
// seleção, leves; o desenho (desenhoMarcadores.js: o shader, a escolha e as instâncias) vem sob demanda quando o
// domínio nasce (A1: o JS principal tem teto). Até ele chegar, os avisos ficam em ctx.sobre e o desenho lê de lá. A
// fonte do aquecimento (D66) entra aqui, antes da primeira rodada: a rodada final, segundos depois, já acha o desenho.
import { PRIORIDADE } from '../camera/selecao.js';

function criarCasca(ctx) {
  let real = null;
  let morto = false;
  const carregado = import('./desenhoMarcadores.js').then(
    (m) => {
      if (!morto) real = m.criarMarcadores(ctx);
      return real;
    },
    (e) => {
      console.error('render: o desenho dos marcadores não carregou', e);
      return null;
    },
  );
  const fonteAquecer = () => real?.aquecimento() ?? [];
  ctx.quadro?.aquecer?.add?.(fonteAquecer);
  return {
    nome: 'marcadores',
    /** Promessa do desenho (cenas e testes). */
    carregado: () => carregado,
    quadro: (tMs, c) => real?.quadro(tMs, c),
    mostrados: () => real?.mostrados() ?? [],
    medidas: () => real?.medidas() ?? null,
    selecionar: (raio) => real?.selecionar(raio) ?? null,
    descartar() {
      morto = true;
      ctx.quadro?.aquecer?.delete?.(fonteAquecer);
      real?.descartar();
    },
  };
}

export function registrar(api) {
  api.registrarDominio('marcadores', criarCasca);
  // os marcadores vêm antes de tudo na seleção (D40): um marcador acertado ganha do prédio atrás dele
  api.registrarSelecionavel('marcadores', (raio, ctx) => ctx.dominio('marcadores')?.selecionar?.(raio) ?? null, { prioridade: PRIORIDADE.marcador });
}
