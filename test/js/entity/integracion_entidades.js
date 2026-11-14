import sinon from "../../lib/sinon/sinon-esm.js";

/**
 * Busca un registro existente sin crear datos para satisfacer la prueba.
 * En colecciones hijas recorre los padres hasta encontrar una asociación real.
 * @param {object} dao DAO de la colección o de los registros principales.
 * @param {string} [campoPadre] Campo identificador del registro principal.
 * @param {function(string): object} [crearHijo] Construye el DAO de sus asociaciones.
 * @returns {Promise<{dao: object, registro: object}|null>} Registro disponible o nulo si no existen datos.
 */
export async function buscarRegistro(dao, campoPadre, crearHijo) {
    if (!crearHijo) {
        const pagina = await dao.findRange(0, 1);
        return pagina.datos.length ? { dao, registro: pagina.datos[0] } : null;
    }
    for (const padre of await dao.listarTodos()) {
        const hijo = crearHijo(padre[campoPadre]);
        const pagina = await hijo.findRange(0, 1);
        if (pagina.datos.length) return { dao: hijo, registro: pagina.datos[0] };
    }
    return null;
}

/**
 * Captura el JSON de la misma respuesta HTTP que transforma el DAO para compararlo sin carreras entre lecturas.
 * El espía delega a fetch real y se restaura también si falla la consulta.
 * @param {object} dao DAO de la entidad que se consulta mediante GET.
 * @param {string} id Identificador real obtenido de una colección existente.
 * @returns {Promise<{entidad: object, original: object}>} Entidad tipada y su representación original.
 */
export async function leerConOriginal(dao, id) {
    const fetchReal = window.fetch.bind(window);
    let original;
    const peticion = sinon.stub(window, "fetch").callsFake(async (...argumentos) => {
        const respuesta = await fetchReal(...argumentos);
        if (respuesta.ok) original = await respuesta.clone().json();
        return respuesta;
    });
    try {
        const entidad = await dao.findById(id);
        return { entidad, original };
    } finally { peticion.restore(); }
}
