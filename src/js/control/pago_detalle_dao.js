import PagoDetalle from "../entity/pago_detalle.js";
import DefaultDao from "./default_dao.js";

/** Acceso al recurso REST PagoDetalle dentro de Pago. */
export default class PagoDetalleDao extends DefaultDao {
    /**
     * Selecciona las asociaciones de un registro de Pago.
     * @param {string} idPago UUID del registro principal.
     */
    constructor(idPago) {
        super(PagoDetalle);
        this.URL += `pago/${encodeURIComponent(idPago)}/detalle`;
    }
}
