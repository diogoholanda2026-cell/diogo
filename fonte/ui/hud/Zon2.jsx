// ZON2 na interface (D112 e D113): o painel de crescimento da zona (Automático ou Manual por lote, com a demanda
// acumulada), os contornos nomeados do Distrito Industrial e da Zona de Utilidades no mundo, e o texto da rede de longo
// alcance. Funções puras no começo (a vitrine e o teste ui as chamam sem navegador); os componentes entram na barra da
// ferramenta (BarraFerramenta.jsx) e no lugar 'mundo' (registrar). Só consultas síncronas e comandos por acoes.js.
import { signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Botao } from '../comp/Botao.jsx';
import { Segmentado } from '../comp/Segmentado.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { barra, avisar } from '../loja.js';
import { consultar } from '../consultas.js';
import { t } from '../textos.js';
import * as fmt from '../formato.js';
import { ZONAS } from '../../data/zonas.js';
import { LOTE_MIN, LOTE_PADRAO, MODOS, validarLote, esperaInteira, areasDaSessao, densificar, regrasAtuais } from '../ferramentas/zon2.js';
import { alturaEm } from '../../comum/altura.js';
import { sessao } from '../ferramentas/sessao.js';
import { fugirDoHud } from '../ferramentas/areas.js';
import { retangulosHud } from '../mundo/Cotas.jsx';

/** O painel de crescimento está aberto? Guarda o id da sessão da ferramenta que o abriu (0 = fechado): ao fechar a ferramenta
 * ele fecha sozinho. */
export const painelZon2 = signal(0);
/** Sobe depois de um comando do painel, para ele reler a consulta na hora. */
const versao = signal(0);

// ------------------------------------------------------------------------------------------------ barra: chip e painel

/** O chip da barra de zonas: mostra o modo da zona escolhida e abre o painel. */
export function ChipCrescimento({ s }) {
  versao.value;
  barra.value;
  const m = s.maquina;
  if (m.apagar) return null;
  const c = consultar('zona.crescimento', { zona: m.zona });
  const modo = c?.modo === 'manual' ? 'manual' : 'automatico';
  const aberto = painelZon2.value === s.id;
  return (
    <Botao a="zon2.painel" rotulo={`${t('zon2.painel.abrir')}: ${t(`zon2.modo.${modo}`)}`} class={`bf-tipo chip chip-bt z2-chip${aberto ? ' aberta' : ''}${modo === 'manual' ? ' manual' : ''}`} aria-expanded={String(aberto)} onClick={() => (painelZon2.value = aberto ? 0 : s.id)}>
      <Glifo n="zonas" tam={16} />
      <span class="chip-texto">{t(`zon2.modo.${modo}`)}</span>
      <Glifo n="setaCima" tam={14} class="bf-seta" />
    </Botao>
  );
}

/** O painel: modo da zona, demanda acumulada, campo da quantidade e o botão de iniciar o lote. */
export function PainelCrescimento({ ui }) {
  versao.value;
  barra.value;
  const [txt, setTxt] = useState(LOTE_PADRAO);
  const s = sessao.value;
  if (!s || painelZon2.value !== s.id || s.tipo !== 'zona' || s.maquina.apagar) return null;
  const id = s.maquina.zona;
  const c = consultar('zona.crescimento', { zona: id });
  if (!c) return null;
  const nomeZona = ZONAS[id]?.nome ?? id;
  const manual = c.modo === 'manual';
  const espera = esperaInteira(c);
  const pedido = Math.max(0, Math.round(c.pedido ?? 0));
  const v = validarLote(txt, pedido);
  const gravidade = (texto) => avisar({ texto, gravidade: 'info' });

  const trocar = async (modo) => {
    if (modo === c.modo) return;
    const r = await ui.comando('zona.modo', { zona: id, modo });
    versao.value++;
    if (!r.ok) return;
    gravidade(t('zon2.modo.trocou', { zona: nomeZona, modo: t(`zon2.modo.${modo}`) }));
    if (r.dados?.cancelados > 0) gravidade(t('zon2.modo.cancelou', { n: fmt.numero(r.dados.cancelados) }));
  };
  const comecar = async () => {
    if (!v.n) return avisar({ texto: t(v.erro === 'maximo' ? 'zon2.lote.maximo' : 'zon2.lote.invalido'), gravidade: 'atencao' });
    const r = await ui.comando('zona.lote', { zona: id, n: v.n });
    versao.value++;
    if (r.ok) gravidade(t('zon2.lote.pedidoOk', { n: fmt.numero(v.n), zona: nomeZona }));
  };
  const cancelar = async () => {
    const r = await ui.comando('zona.lote', { zona: id, n: 0 });
    versao.value++;
    if (r.ok) gravidade(t('zon2.lote.canceladoOk', { zona: nomeZona, n: fmt.numero(r.dados?.cancelados ?? pedido) }));
  };

  return (
    <div class={`bandeja bandeja-esquerda zon2-painel${manual ? ' manual' : ''}`} data-hud="bandeja" role="group" aria-label={t('zon2.modo.titulo')}>
      <header class="z2-cab">
        <b>{t('zon2.modo.titulo')}</b>
        <span class="z2-zona">{nomeZona}</span>
        <Botao a="zon2.fechar" rotulo={t('zon2.painel.fechar')} class="bt-glifo z2-fechar" onClick={() => (painelZon2.value = 0)}>
          <Glifo n="cancelar" tam={18} />
        </Botao>
      </header>
      <div class="z2-esq">
      <Segmentado a="zon2.modo" rotulo={t('zon2.modo.qual')} valor={manual ? 'manual' : 'automatico'} aoTrocar={trocar} opcoes={MODOS.map((m) => ({ v: m, rotulo: t(`zon2.modo.${m}`) }))} class="z2-seg" />
      <p class="z2-dica">{t(`zon2.modo.${manual ? 'manual' : 'automatico'}.dica`)}</p>
      <p class="z2-resumo num">{t('zon2.crescimento.resumo', { construidos: fmt.numero(c.construidos), emObra: fmt.numero(c.emObra), frentes: fmt.numero(c.frentes) })}</p>
      </div>
      {manual ? (
        <div class="z2-lote">
          <p class="z2-espera num" data-k="espera">
            <span>{t('zon2.lote.demanda')}</span>
            <b>{t('zon2.lote.demandaValor', { n: fmt.numero(espera) })}</b>
          </p>
          <label class="z2-campo">
            <span>{t('zon2.lote.pergunta')}</span>
            <span class="z2-linha">
              <input
                class="z2-qtd num"
                data-a="zon2.qtd"
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={txt}
                aria-label={t('zon2.lote.campo')}
                aria-invalid={v.erro ? 'true' : 'false'}
                onInput={(ev) => setTxt(ev.currentTarget.value.replace(/[^\d]/g, ''))}
                onKeyDown={(ev) => ev.key === 'Enter' && comecar()}
              />
              <Botao a="zon2.usarEspera" rotulo={t('zon2.lote.usarEspera')} desligado={espera < LOTE_MIN} class="bt-sec bt-curto" onClick={() => setTxt(String(Math.max(LOTE_MIN, espera)))}>
                <span>{t('zon2.lote.usarEspera')}</span>
              </Botao>
            </span>
          </label>
          <p class={`z2-estado num${v.erro ? ' tx-er' : ''}`}>
            {v.erro ? t(v.erro === 'maximo' ? 'zon2.lote.maximo' : 'zon2.lote.invalido') : pedido > 0 ? t('zon2.lote.pedido', { n: fmt.numero(pedido) }) : t('zon2.lote.nenhum')}
          </p>
          <div class="z2-acoes">
            <Botao a="zon2.lote" rotulo={t('zon2.lote.comecar')} principal desligado={!v.n} class="bt-pri bt-curto" onClick={comecar}>
              <Glifo n="check" tam={16} />
              <span>{t('zon2.lote.comecar')}</span>
            </Botao>
            {pedido > 0 ? (
              <Botao a="zon2.cancelar" rotulo={t('zon2.lote.cancelar')} class="bt-sec bt-curto" onClick={cancelar}>
                <span>{t('zon2.lote.cancelar')}</span>
              </Botao>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ mundo: contornos

/** Os contornos nomeados, com o rótulo, sobre o relevo; só quando a ferramenta pede (zona industrial ou utilidade). */
function ContornosZon2({ ui }) {
  const raiz = useRef(null);
  const areasRef = useRef([]);
  const s = sessao.value;
  const regras = s ? regrasAtuais(ui.obterSim()) : null;
  const ids = areasDaSessao(s, regras);
  const areas = ids.map((id) => ({
    id,
    nome: t(`zon2.contorno.${id}`),
    sub: id === 'distrito' && regras.vento ? t('zon2.contorno.vento', { de: regras.vento.de, para: regras.vento.para }) : null,
    contorno: regras[id].contorno,
    pontos: densificar(regras[id].contorno),
  }));
  areasRef.current = areas;

  useEffect(
    () =>
      ui.aoQuadro(() => {
        const el = raiz.current;
        const R = ui.R;
        if (!el || !R?.projetar) return;
        const T = ui.obterSim()?.espelho?.terreno;
        const W = typeof innerWidth !== 'undefined' ? innerWidth : 986;
        const H = typeof innerHeight !== 'undefined' ? innerHeight : 443;
        const hud = retangulosHud();
        for (const a of areasRef.current) {
          const poli = el.querySelector(`polygon[data-area="${a.id}"]`);
          const rot = el.querySelector(`.z2-rotulo[data-area="${a.id}"]`);
          if (!poli) continue;
          const pts = [];
          let melhor = null;
          let tudo = true;
          for (const [x, z] of a.pontos) {
            const q = R.projetar([x, (T?.altura ? alturaEm(T, x, z) : 0) + 1, z]);
            if (!q || !Number.isFinite(q.x) || !Number.isFinite(q.y) || q.frente === false || (q.dist !== undefined && q.dist <= 0)) {
              tudo = false;
              break;
            }
            pts.push(`${q.x.toFixed(1)},${q.y.toFixed(1)}`);
            // o rótulo fica no ponto do contorno que está à vista e mais perto do meio da tela
            if (q.x > 80 && q.x < W - 80 && q.y > 90 && q.y < H - 110) {
              const d = Math.hypot(q.x - W / 2, q.y - H / 2);
              if (!melhor || d < melhor.d) melhor = { x: q.x, y: q.y, d };
            }
          }
          poli.setAttribute('points', tudo ? pts.join(' ') : '');
          if (!rot) continue;
          if (!tudo || !melhor) {
            rot.style.visibility = 'hidden';
            continue;
          }
          const w = rot.offsetWidth || 160;
          const y = fugirDoHud(melhor.x, melhor.y + 22, w, 40, hud);
          rot.style.visibility = y === null ? 'hidden' : 'visible';
          if (y !== null) rot.style.transform = `translate(${melhor.x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
        }
      }),
    [],
  );

  if (!areas.length) return null;
  return (
    <div ref={raiz} class="z2-contornos" aria-hidden="true" data-contornos={ids.join(' ')}>
      <svg class="z2-svg">
        {areas.map((a) => (
          <polygon key={a.id} data-area={a.id} class={`z2-area z2-${a.id}`} points="" />
        ))}
      </svg>
      {areas.map((a) => (
        <div key={a.id} data-area={a.id} class={`z2-rotulo z2-${a.id}`}>
          <b>{a.nome}</b>
          {a.sub ? <span>{a.sub}</span> : null}
        </div>
      ))}
    </div>
  );
}

export function registrar(ui) {
  ui.registrarHud('mundo', ContornosZon2, { ordem: 55, nome: 'zon2-contornos' });
}
