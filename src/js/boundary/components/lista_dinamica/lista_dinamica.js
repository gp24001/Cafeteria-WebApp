/**
 * Integra altas, bajas y cambios conservando los nodos de los registros existentes.
 * @param {Element} lista Contenedor cuyos hijos corresponden a los registros.
 * @param {Array} registros Registros en el orden en que deben mostrarse.
 * @param {function(object): string} clave Obtiene una clave única y estable por registro.
 * @param {function(object): Element} crear Construye el nodo de un registro nuevo.
 * @param {function(Element, object): void} actualizar Actualiza el contenido de un nodo existente o nuevo.
 */
export function actualizarLista(lista, registros, clave, crear, actualizar) {
    const anteriores = new Map(Array.from(lista.children, nodo => [nodo.claveLista, nodo]));
    for (const [indice, registro] of registros.entries()) {
        const id = clave(registro);
        let nodo = anteriores.get(id);
        if (!nodo) { nodo = crear(registro); nodo.claveLista = id; }
        anteriores.delete(id);
        actualizar(nodo, registro);
        if (lista.children[indice] !== nodo) lista.insertBefore(nodo, lista.children[indice] || null);
    }
    for (const nodo of anteriores.values()) nodo.remove();
}

/**
 * Cambia exclusivamente el texto necesario, conservando el elemento contenedor.
 * @param {Element} nodo Elemento de texto que se actualizará.
 * @param {*} valor Valor que se representará como texto, o vacío si es nulo.
 */
export function actualizarTexto(nodo, valor) {
    const texto = String(valor ?? "");
    if (nodo.textContent !== texto) nodo.textContent = texto;
}
