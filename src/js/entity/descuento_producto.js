import Descuento from "./descuento.js";
import Producto from "./producto.js";

/** Entidad DescuentoProducto según la representación JSON del recurso REST. */
class DescuentoProducto {
    /** Construye la entidad con sus propiedades REST. */
    constructor() {
        this.idDescuentoProducto = null;
        this.fechaInicio = null;
        this.fechaFin = null;
        this.valor = null;
        this.observaciones = null;
        this.idDescuento = null;
        this.idProducto = null;
    }

    /** Tipos de las relaciones incluidas en la respuesta de la API. */
    static relaciones = {
        idDescuento: Descuento,
        idProducto: Producto,
    };
}

export default DescuentoProducto;
