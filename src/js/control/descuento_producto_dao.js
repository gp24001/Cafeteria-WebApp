import DefaultDao from "./default_dao.js";

/** Acceso al recurso REST DescuentoProducto dentro de Descuento. */
export default class DescuentoProductoDao extends DefaultDao {
    /**
     * Selecciona las asociaciones de un registro de Descuento.
     * @param {string} idDescuento UUID del registro principal.
     */
    constructor(idDescuento) {
        super();
        this.URL += `descuento/${encodeURIComponent(idDescuento)}/producto`;
    }
}
