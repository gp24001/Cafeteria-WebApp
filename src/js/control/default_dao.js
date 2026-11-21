import DefaultError from "../entity/default_error.js";
import DefaultResponse from "../entity/default_response.js";

/**
 * Convierte JSON al tipo del recurso, conservando los campos que envió el servidor.
 * Un registro parcial conserva sus omisiones al volver a serializarlo.
 * @param {Function} Tipo Clase de la entidad y de sus relaciones declaradas.
 * @param {object|null} datos Representación recibida de la API.
 * @returns {object|null} Entidad con las relaciones recibidas, sin completar campos ausentes.
 */
function desdeJson(Tipo, datos) {
    if (Tipo === Object || datos == null) return datos;
    const registro = Object.assign(Object.create(Tipo.prototype), datos);
    for (const [campo, Relacion] of Object.entries(Tipo.relaciones || {})) {
        if (datos[campo] && typeof datos[campo] === "object") {
            registro[campo] = desdeJson(Relacion, datos[campo]);
        }
    }
    return registro;
}

/** Comparte consultas REST, paginación y conversión de entidades entre los DAO específicos. */
class DefaultDao {
    /** Recibe el tipo de entidad y establece la dirección base de la API existente. */

        constructor(Entidad = Object) { // cambio para concidir con la imagen del backend
        this.Entidad = Entidad;
        this._BASE_URL = "http://cafefe.backend:9080/cafefe/resources/v1/";
        this.URL = this._BASE_URL;
    }
    /**
     * Busca un conjunto de registros en el repositorio, usando paginacion.
     * @param {number} first el primer registro a obtener
     * @param {number} max cantidad maxima de registros a obtener
     * @returns {Promise<DefaultResponse>} Página y total de registros. Rechaza con DefaultError si falla la consulta.
     */
    async findRange(first, max) {
        const fallo = new DefaultError();
        let respuesta;
        try {
            respuesta = await fetch(`${this.URL}?min=${first}&max=${max}`, { method: "GET" });
        } catch (error) {
            fallo.mensaje = "Error al acceder al repositorio";
            fallo.error = error;
            throw fallo;
        }
        if (respuesta.status !== 200) {
            fallo.mensaje = `Error al obtener los datos: ${respuesta.status}`;
            fallo.error = respuesta;
            throw fallo;
        }
        try {
            const datos = await respuesta.json();
            const pagina = new DefaultResponse();
            pagina.datos = datos.map(registro => desdeJson(this.Entidad, registro));
            pagina.totalDatos = respuesta.headers.get("Total-registros");
            return pagina;
        } catch (error) {
            fallo.mensaje = "Error al procesar los datos de respuesta";
            fallo.error = error;
            throw fallo;
        }
    }

    /**
     * Consulta un registro dentro del recurso configurado por el DAO.
     * @param {string} id UUID del registro.
     * @returns {Promise<object>} Registro devuelto por el recurso.
     */
    findById(id) {
        return this.solicitarJson(`${this.URL}/${encodeURIComponent(id)}`);
    }

    /**
     * Reúne las páginas de la colección respetando el límite de 50 de la API.
     * @returns {Promise<object[]>} Registros recibidos en el orden de las páginas.
     * @throws {DefaultError} Propaga el fallo de cualquier página sin devolver un catálogo parcial.
     */
    async listarTodos() {
        const registros = [];
        let pagina;
        do {
            pagina = await this.findRange(registros.length, 50);
            registros.push(...pagina.datos);
        } while (pagina.datos.length && registros.length < Number(pagina.totalDatos));
        return registros;
    }

    /**
     * Ejecuta una operación que devuelve un objeto JSON.
     * @param {string} url Dirección del recurso.
     * @param {RequestInit} [opciones] Método, cabeceras y cuerpo para fetch.
     * @param {Function} [Tipo] Clase de la entidad o del objeto de respuesta.
     * @returns {Promise<object>} Datos de la respuesta.
     * @throws {DefaultError} Conserva la respuesta HTTP o la causa del fallo.
     */
    async solicitarJson(url, opciones, Tipo = this.Entidad) {
        const fallo = new DefaultError();
        let respuesta;
        try {
            respuesta = await fetch(url, opciones);
        } catch (error) {
            fallo.mensaje = "Error al acceder al repositorio";
            fallo.error = error;
            throw fallo;
        }
        if (!respuesta.ok) {
            fallo.mensaje = respuesta.headers.get("App-Error") || `Error al obtener los datos: ${respuesta.status}`;
            fallo.error = respuesta;
            throw fallo;
        }
        try {
            return desdeJson(Tipo, await respuesta.json());
        } catch (error) {
            fallo.mensaje = "Error al procesar los datos de respuesta";
            fallo.error = error;
            throw fallo;
        }
    }
}
export default DefaultDao;
