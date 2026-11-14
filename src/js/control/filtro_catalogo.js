/**
 * Normaliza nombres y consultas sin distinguir tildes, mayúsculas ni espacios exteriores.
 * @param {string} texto Nombre, descripción o consulta.
 * @returns {string} Texto preparado para comparar en el hilo principal o en el Worker.
 */
export function normalizarBusqueda(texto) {
    return String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/**
 * Prepara una cadena por registro; conserva el orden de los productos originales.
 * @param {object[]} productos Registros con nombre y comentarios opcionales.
 * @returns {string[]} Índice de textos que permite devolver posiciones, sin copiar entidades al resultado.
 */
export function crearIndice(productos) {
    return productos.map(producto => normalizarBusqueda(`${producto.nombre || ""} ${producto.comentarios || ""}`));
}

/**
 * Devuelve los índices que contienen todas las palabras, sin copiar ni alterar productos.
 * @param {string[]} indice Textos previamente normalizados en el orden del catálogo.
 * @param {string} consulta Palabras que deben estar presentes en cada coincidencia.
 * @returns {number[]} Posiciones coincidentes; todas las posiciones si la consulta está vacía.
 */
export function buscarEnIndice(indice, consulta) {
    const palabras = normalizarBusqueda(consulta).split(/\s+/).filter(Boolean);
    const coincidencias = [];
    indice.forEach((texto, posicion) => {
        if (palabras.every(palabra => texto.includes(palabra))) coincidencias.push(posicion);
    });
    return coincidencias;
}
