import ProductoTipoProducto from "../entity/producto_tipo_producto.js";
import DefaultDao from "./default_dao.js";

/** Acceso al recurso REST ProductoTipoProducto dentro de Producto. */
export default class ProductoTipoProductoDao extends DefaultDao {
    /**
     * Selecciona las asociaciones de un registro de Producto.
     * @param {string} idProducto UUID del registro principal.
     */
    constructor(idProducto) {
        super(ProductoTipoProducto);
        this.URL += `producto/${encodeURIComponent(idProducto)}/tipoproducto`;
    }
}
