import DefaultDao from "./default_dao.js";

/** Acceso al recurso REST Factura. */
export default class FacturaDao extends DefaultDao {
    /** Configura la ruta de Factura. */
    constructor() {
        super();
        this.URL += "factura";
    }

    /**
     * Registra la factura de la orden indicada.
     * @param {object} solicitud Datos de facturación con idCaja, idEmpleadoRol,
     * idOrden, cliente y observaciones según el contrato de Factura.
     * @returns {Promise<object>} Registro creado por la API.
     */
    crear(solicitud) {
        return this.solicitarJson(this.URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(solicitud)
        });
    }

    /**
     * Consulta los totales calculados por el backend para una factura.
     * @param {string} idFactura UUID de la factura.
     * @returns {Promise<object>} Totales devueltos por la API.
     */
    totales(idFactura) {
        return this.solicitarJson(`${this.URL}/${encodeURIComponent(idFactura)}/totales`);
    }
}
