import Orden from "./orden.js";
import Producto from "./producto.js";

/** Entidad OrdenProducto según la representación JSON del recurso REST. */
class OrdenProducto {
    /** Construye la entidad con sus propiedades REST. */
    constructor() {
        this.idOrdenProducto = null;
        this.precio = null;
        this.observaciones = null;
        this.idOrden = null;
        this.idProducto = null;
    }

    /** Tipos de las relaciones incluidas en la respuesta de la API. */
    static relaciones = {
        idOrden: Orden,
        idProducto: Producto,
    };
}

export default OrdenProducto;
