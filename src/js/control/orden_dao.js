import DefaultDao from "./default_dao.js";

/** Acceso al recurso REST Orden. */
export default class OrdenDao extends DefaultDao {
    /** Configura la ruta de Orden. */
    constructor() {
        super();
        this.URL += "orden";
    }

    /**
     * Registra la orden del cliente.
     * @param {object} solicitud Datos de creación que espera el recurso Orden.
     * @returns {Promise<object>} Registro creado por la API.
     */
    crear(solicitud) {
        return this.solicitarJson(this.URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(solicitud)
        });
    }
}
