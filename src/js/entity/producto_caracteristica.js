import Caracteristica from "./caracteristica.js";
import Producto from "./producto.js";

/** Entidad ProductoCaracteristica según la representación JSON del recurso REST. */
class ProductoCaracteristica {
    /** Construye la entidad con sus propiedades REST. */
    constructor() {
        this.idProductoCaracteristica = null;
        this.valor = null;
        this.idCaracteristica = null;
        this.idProducto = null;
    }

    /** Tipos de las relaciones incluidas en la respuesta de la API. */
    static relaciones = {
        idCaracteristica: Caracteristica,
        idProducto: Producto,
    };
}

export default ProductoCaracteristica;
