import OrdenProducto from "../entity/orden_producto.js";
import DefaultDao from "./default_dao.js";

/** Acceso al recurso REST OrdenProducto dentro de Orden. */
export default class OrdenProductoDao extends DefaultDao {
    /**
     * Selecciona las asociaciones de un registro de Orden.
     * @param {string} idOrden UUID del registro principal.
     */
    constructor(idOrden) {
        super(OrdenProducto);
        this.URL += `orden/${encodeURIComponent(idOrden)}/producto`;
    }

    /**
     * Registra la línea de producto de esta orden.
     * @param {object} solicitud Datos de creación que espera el recurso OrdenProducto.
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
