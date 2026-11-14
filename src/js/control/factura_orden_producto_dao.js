import FacturaOrdenProducto from "../entity/factura_orden_producto.js";
import DefaultDao from "./default_dao.js";

/** Acceso al recurso REST FacturaOrdenProducto dentro de Factura. */
export default class FacturaOrdenProductoDao extends DefaultDao {
    /**
     * Selecciona las asociaciones de un registro de Factura.
     * @param {string} idFactura UUID del registro principal.
     */
    constructor(idFactura) {
        super(FacturaOrdenProducto);
        this.URL += `factura/${encodeURIComponent(idFactura)}/ordenProducto`;
    }
}
