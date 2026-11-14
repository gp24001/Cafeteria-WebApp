import Pago from "../entity/pago.js";
import DefaultDao from "./default_dao.js";

/** Acceso al recurso REST Pago. */
export default class PagoDao extends DefaultDao {
    /** Configura la ruta de Pago. */
    constructor() {
        super(Pago);
        this.URL += "pago";
    }

    /**
     * Registra el pago con el detalle de sus medios e importes.
     * @param {object} solicitud Factura (idFactura), detalles de pago y observaciones.
     * Cada detalle contiene monto, tipoPago y, si corresponde, referenciaExterna.
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
