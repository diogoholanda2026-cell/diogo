// Gire o celular (desenho da UI 7.5; dona: U2a): no toque em retrato, uma tela "Gire o celular: o jogo é em paisagem"
// com o glifo; o CSS decide quando aparece (orientation: portrait e pointer: coarse), sem custo no PC.
import { Glifo } from '../glifos/Glifo.jsx';
import { t } from '../textos.js';
import { usarEstilo, CSS_INICIO } from './estilo.js';

export function Girar() {
  return (
    <div class="girar" role="alert">
      <Glifo n="girarCelular" tam={48} />
      <span>{t('u2.girar')}</span>
    </div>
  );
}

export function registrar(ui) {
  if (ui.jogo?.falso || ui.jogo?.cena) return;
  usarEstilo('inicio', CSS_INICIO);
  ui.registrarHud('sobre', Girar, { ordem: 99, nome: 'girar' });
}
