import Producto from "../entity/producto.js";
import DefaultDao from "./default_dao.js";
import ProductoTipoProductoDao from "./producto_tipo_producto_dao.js";

/** Acceso al recurso REST Producto. */
export default class ProductoDao extends DefaultDao {
    /** Configura la ruta de Producto. */
    constructor() {
        super(Producto);
        this.URL += "producto";
    }

    /** Lista productos con una asociación activa a la categoría indicada. */
    async productosDeCategoria(idTipoProducto) {
        const productos = await this.listarTodos();
        const seleccion = [];
        for (const producto of productos.filter(p => p.activo)) {
            const relaciones = await new ProductoTipoProductoDao(producto.idProducto).listarTodos();
            if (relaciones.some(r => r.activo && r.idTipoProducto?.idTipoProducto === idTipoProducto)) {
                seleccion.push(producto);
            }
        }
        return seleccion;
    }
}
