// Libera a memória de GPU de uma subárvore que saiu de cena (canteiros, prévias, extras): geometrias
// (menos as marcadas com userData.compartilhada, que outras malhas ainda usam), atributos das
// instâncias e os materiais clonados para a obra (userData.base = material original).
export function descartar(root) {
  if (!root) return;
  root.traverse((o) => {
    if (o.isInstancedMesh) o.dispose();
    const g = o.geometry; if (g && !g.userData?.compartilhada) g.dispose();
    const m = o.material; if (!m) return;
    if (Array.isArray(m)) { for (const x of m) if (x?.userData?.base) x.dispose(); } else if (m.userData?.base) m.dispose();
  });
}
