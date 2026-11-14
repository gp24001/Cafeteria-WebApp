import Producto from "./producto.js";
import TipoProducto from "./tipo_producto.js";

/** Entidad ProductoTipoProducto según la representación JSON del recurso REST. */
class ProductoTipoProducto {
    /** Construye la entidad con sus propiedades REST. */
    constructor() {
        this.idProductoTipoProducto = null;
        this.activo = null;
        this.fechaCreacion = null;
        this.observaciones = null;
        this.idProducto = null;
        this.idTipoProducto = null;
    }

    /** Tipos de las relaciones incluidas en la respuesta de la API. */
    static relaciones = {
        idProducto: Producto,
        idTipoProducto: TipoProducto,
    };
}

export default ProductoTipoProducto;
