/** Identifica valores usados únicamente para cumplir el campo obligatorio de una opción. */
function esValorDeRelleno(valor) {
    return !valor || valor === "1" || /^[.\-–—]+$/.test(valor);
}

/**
 * Forma una etiqueta de catálogo sin mostrar marcadores de opciones como «1», «.» o «-».
 * Las medidas conservan su valor; los datos recibidos y su validación no se modifican.
 * @param {string} nombre Nombre registrado de la característica.
 * @param {string} valor Valor obligatorio registrado en la relación.
 * @param {{medida?: boolean}} opciones Indica si el valor corresponde a una medida real.
 * @returns {string} Etiqueta para presentar al usuario.
 */
export function etiquetaCaracteristica(nombre, valor, { medida = false } = {}) {
    const texto = String(valor ?? "").trim();
    if (!medida && esValorDeRelleno(texto)) return nombre;
    return /^\d+(?:[.,]\d+)?$/.test(texto) ? `${texto} ${nombre}` : `${nombre}: ${texto}`;
}

/** Reconoce las unidades que deben conservar un valor numérico en las notas ya guardadas. */
function esNombreDeMedida(nombre) {
    const normalizado = nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return /^(onzas?|oz|mililitros?|ml|litros?|l|gramos?|g|kilogramos?|kg|porcion(?:es)?|unidad(?:es)?|tamano)\b/.test(normalizado);
}

/**
 * Limpia únicamente el texto visible de especificaciones actuales o de pedidos anteriores.
 * Conserva medidas y valores informativos, y permite omitir «1 Porción» junto a cantidades xN.
 * 
 * @param {string} texto Especificaciones separadas por el delimitador del pedido « · ».
 * @param {{omitirPorcionUnitaria?: boolean}} opciones Preferencia de la vista o del ticket.
 * @returns {string} Especificaciones legibles, sin marcadores de relleno.
 */
export function limpiarEspecificaciones(texto, { omitirPorcionUnitaria = false } = {}) {
    return String(texto ?? "").split(" · ").map(parte => {
        const etiqueta = parte.trim();
        if (omitirPorcionUnitaria && /^(?:1\s+porci[oó]n(?:es)?|porci[oó]n(?:es)?\s*:\s*1)$/i.test(etiqueta)) return "";
        const separador = etiqueta.indexOf(":");
        if (separador >= 0) {
            const nombre = etiqueta.slice(0, separador).trim();
            const valor = etiqueta.slice(separador + 1).trim();
            return !esNombreDeMedida(nombre) && esValorDeRelleno(valor) ? nombre : etiqueta;
        }
        const marcador = etiqueta.match(/^1\s+(.+)$/);
        return marcador && !esNombreDeMedida(marcador[1]) ? marcador[1] : etiqueta;
    }).filter(Boolean).join(" · ");
}
