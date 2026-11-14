import Factura from "../entity/factura.js";
import DefaultDao from "./default_dao.js";

/** Identifica anulaciones de órdenes completas, conservadas en el historial original. */
export function esOrdenAnulada(factura) {
    return factura.estado === "ANULADA" && factura.observaciones?.includes("Anulación: Orden anulada: ");
}

/** Acceso al recurso REST Factura. */
export default class FacturaDao extends DefaultDao {
    /** Configura la ruta de Factura. */
    constructor() {
        super(Factura);
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
        return this.solicitarJson(`${this.URL}/${encodeURIComponent(idFactura)}/totales`, undefined, Object);
    }

    /** Anula mediante el endpoint existente, que exige motivo y ausencia de pagos. */
    anular(idFactura, motivo) {
        return this.solicitarJson(`${this.URL}/${encodeURIComponent(idFactura)}/anular`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ motivo })
        });
    }
}
