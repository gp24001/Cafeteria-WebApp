export const MARCA_PREPARACION = "\n[CAFEFE_PREPARACION_V1]";
const nombres = { PENDIENTE: "Pendiente", EN_PREPARACION: "En preparación", DESPACHADA: "Despachada" };

/** Usa exclusivamente el texto de observacion ya disponible en la API original. */
export function leerPreparacion(observacion) {
    const texto = observacion || "";
    const posicion = texto.lastIndexOf(MARCA_PREPARACION);
    if (posicion < 0) {
        const coincidencia = texto.match(/\nEstado: (Pendiente|En preparación|Despachada)$/);
        return { texto: coincidencia ? texto.slice(0, coincidencia.index) : texto,
            estado: coincidencia ? Object.keys(nombres).find(clave => nombres[clave] === coincidencia[1]) : "PENDIENTE",
            version: 0, listos: [], legado: false };
    }
    let datos;
    try { datos = JSON.parse(texto.slice(posicion + MARCA_PREPARACION.length)); }
    catch { /* La validación siguiente rechaza tanto JSON inválido como datos incompletos con el mismo mensaje. */ }
    if (!datos || !["PENDIENTE", "EN_PREPARACION", "DESPACHADA"].includes(datos.estado)
        || !Number.isSafeInteger(datos.version) || datos.version < 0 || !Array.isArray(datos.listos)
        || !datos.listos.every(id => typeof id === "string")) {
        throw new Error("No se pudo interpretar la preparación guardada en esta orden.");
    }
    return { ...datos, texto: texto.slice(0, posicion), legado: true };
}

/** Añade el estado legible conservando el texto original del pedido. */
export function escribirPreparacion(observacion, datos) {
    const { texto } = leerPreparacion(observacion);
    if (!nombres[datos.estado]) throw new Error("El estado de preparación no es válido.");
    return texto + "\nEstado: " + nombres[datos.estado];
}

/** Separa el estado de preparación de la presentación y notas originales del ítem. */
export function leerPreparacionUnidad(observaciones) {
    const texto = observaciones || "";
    const coincidencia = texto.match(/\nPreparación: (Listo|Pendiente)$/);
    return { texto: coincidencia ? texto.slice(0, coincidencia.index) : texto,
        listo: coincidencia ? coincidencia[1] === "Listo" : null };
}

/** Obtiene la presentación sin el identificador interno del pedido ni su estado de preparación. */
export function leerPresentacionUnidad(observaciones) {
    return leerPreparacionUnidad(observaciones).texto.replace(/^Pedido web [^/]+\/[^/]+\/\d+(?: · )?/, "").trim();
}

/** Escribe Listo o Pendiente conservando las notas del ítem. */
export function escribirPreparacionUnidad(observaciones, listo) {
    return leerPreparacionUnidad(observaciones).texto + "\nPreparación: " + (listo ? "Listo" : "Pendiente");
}

/** Combina orden e ítems y calcula una huella de lectura que solo permanece en memoria. */
export function ordenConPreparacion(orden, unidades) {
    const datos = leerPreparacion(orden.observacion);
    const listos = unidades.filter(unidad => {
        const estado = leerPreparacionUnidad(unidad.observaciones).listo;
        return estado === null ? datos.estado === "DESPACHADA" || datos.listos.includes(unidad.idOrdenProducto) : estado;
    }).map(u => u.idOrdenProducto);
    // Huella de lectura solo en memoria: nunca se guarda en PostgreSQL.
    const revision = JSON.stringify([orden.observacion || "", unidades.map(u => [u.idOrdenProducto, u.observaciones || ""])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])))]);
    return { ...orden, observacion: datos.texto, estadoPreparacion: datos.estado,
        versionPreparacion: datos.version, revisionPreparacion: revision, listos, unidades };
}
