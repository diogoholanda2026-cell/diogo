// Aba Problemas da tela Cidade (X3b). A aba mora na tela Cidade (telas/corpo/Cidade.jsx), que carrega o corpo
// (telas/corpo/Problemas.jsx) só quando a aba abre; a lista, o agrupamento e a ordem são puros em mundo/problemas.js.
// Aqui fica o registro: nada a registrar (a tela é a da Cidade), mas o arquivo é o ponto de entrada da parcela.
export { listarProblemas, ordenarProblemas, proximoProblema, destinoDoProblema, contarProblemas } from '../mundo/problemas.js';
export function registrar() {}
