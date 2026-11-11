import DefaultError from "../entity/default_error.js";
import DefaultResponse from "../entity/default_response.js";
class DefaultDao {
    constructor() {
        this._BASE_URL = "http://localhost:9080/cafefe-1.0-SNAPSHOT/resources/v1/";
        this.URL = this._BASE_URL;
    }
    /**
     * Busca un conjunto de registros en el repositorio, usando paginacion.
     * @param {number} first el primer registro a obtener
     * @param {number} max cantidad maxima de registros a obtener
     * @returns {Promise<DefaultResponse>} Página y total de registros. Rechaza con DefaultError si falla la consulta.
     */
    findRange(first, max) {
        let errorSalida = new DefaultError();
        let salida = new Promise((resolve, reject) => {
            fetch(`${this.URL}?min=${first}&max=${max}`, { method: "GET" }).then(r => {
                if (r.status === 200) {
                    r.json().then(j => {
                        let respuesta = new DefaultResponse();
                        respuesta.datos = j;
                        respuesta.totalDatos = r.headers.get("Total-registros");
                        resolve(respuesta);

                    }).catch(e => {
                        errorSalida.mensaje = "Error al procesar los datos de respuesta";
                        errorSalida.error = e;
                        reject(errorSalida);
                    })
                } else {
                    errorSalida.mensaje = `Error al obtener los datos: ${r.status}`;
                    errorSalida.error = r;
                    reject(errorSalida);

                }
            }).catch(e => {
                errorSalida.mensaje = "Error al acceder al repositorio";
                errorSalida.error = e;
                reject(errorSalida);
            });
        });
        return salida;
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
     * Ejecuta una operación que devuelve un objeto JSON.
     * @param {string} url Dirección del recurso.
     * @param {RequestInit} [opciones] Método, cabeceras y cuerpo para fetch.
     * @returns {Promise<object>} Datos de la respuesta.
     * @throws {DefaultError} Conserva la respuesta HTTP o la causa del fallo.
     */
    async solicitarJson(url, opciones) {
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
            return await respuesta.json();
        } catch (error) {
            fallo.mensaje = "Error al procesar los datos de respuesta";
            fallo.error = error;
            throw fallo;
        }
    }
}
export default DefaultDao;
