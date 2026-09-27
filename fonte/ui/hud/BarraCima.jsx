// Barra de cima MÍNIMA da F0 (a U1a é dona depois e refaz com marco, bem-estar, demanda, Conselho e menu): créditos
// com o saldo por hora de jogo, população, calendário sem hora ("Mês 3 · Ano 2" e a fase do céu, D42) e a velocidade
// funcionando (pausa, 1x, 2x e 4x, D7). Vidro grafite, Inter, números tabulares. Os números abrem as telas de gestão
// quando elas existirem (ui.abrirTela).
import { barra } from '../loja.js';
import * as fmt from '../formato.js';
import { t } from '../textos.js';
import { velocidade } from '../acoes.js';
import { Botao } from '../comp/Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';

const GLIFO_VEL = ['pausa', 'vel1', 'vel2', 'vel3'];

let abrirTela = () => {};

export function BarraCima() {
  const b = barra.value;
  const saldo = fmt.porHora(b.saldoHora);
  const negativo = b.saldoHora < 0;
  return (
    <div class="barra-cima">
      <div class="grupo vidro" data-hud="cima-esquerda">
        <Botao a="holding" rotulo={t('hud.holding')} class="item marca" onClick={() => abrirTela('holding')}>
          <Glifo n="holding" tam={24} />
        </Botao>
        <Botao a="creditos" rotulo={`${t('hud.creditos')}: ${fmt.creditos(b.creditos)}, ${saldo}`} class="item" onClick={() => abrirTela('economia')}>
          <Glifo n="creditos" class="ch" />
          <span class="pilha">
            <b class="num">{fmt.creditosBarra(b.creditos)}</b>
            <small class={`num sub${negativo ? ' neg' : ''}`} title={fmt.dicaHora()} data-dica="hora">
              {negativo ? <Glifo n="alerta" tam={12} /> : null}
              {saldo}
            </small>
          </span>
        </Botao>
        <Botao a="populacao" rotulo={`${t('hud.populacao')}: ${fmt.populacao(b.populacao)}`} class="item" onClick={() => abrirTela('cidade')}>
          <Glifo n="populacao" />
          <span class="pilha">
            <b class="num">{fmt.populacao(b.populacao)}</b>
            <small class="num sub" title={fmt.dicaHora()} data-dica="hora">
              {fmt.porHora(b.popHora)}
            </small>
          </span>
        </Botao>
      </div>
      <div class="grupo vidro" data-hud="cima-direita">
        <div class="item data" role="group" aria-label={t('hud.calendario')}>
          <Glifo n={fmt.glifoDaFase(b.data?.fase)} class="fase" />
          <span class="pilha">
            <b class="num">{fmt.dataCalendario(b.data)}</b>
            <small class="sub">{fmt.fase(b.data?.fase)}</small>
          </span>
        </div>
        <div class="vel" role="group" aria-label={t('vel.grupo')}>
          {GLIFO_VEL.map((g, v) => (
            <Botao a="velocidade" k={v} rotulo={t(`vel.${v}`)} ativo={b.velocidade === v} class={`item seg${b.velocidade === v ? ' ligado' : ''}${v === 0 && b.velocidade === 0 ? ' pausa' : ''}`} onClick={() => velocidade(v)}>
              <Glifo n={g} />
            </Botao>
          ))}
        </div>
      </div>
      {b.velocidade === 0 ? (
        <div class="chip-pausado vidro" data-hud="pausado" role="status">
          {t('vel.pausado')}
        </div>
      ) : null}
    </div>
  );
}

/** Entra no lugar 'cima' da interface (ui/index.jsx). */
export function registrar(ui) {
  abrirTela = (id) => ui.abrirTela(id);
  ui.registrarHud('cima', BarraCima, { ordem: 0, nome: 'barra' });
}
