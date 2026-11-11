import DefaultDao from "./default_dao.js";

/** Acceso al recurso REST ProductoCaracteristica dentro de Producto. */
export default class ProductoCaracteristicaDao extends DefaultDao {
    /**
     * Selecciona las asociaciones de un registro de Producto.
     * @param {string} idProducto UUID del registro principal.
     */
    constructor(idProducto) {
        super();
        this.URL += `producto/${encodeURIComponent(idProducto)}/caracteristica`;
    }
}
