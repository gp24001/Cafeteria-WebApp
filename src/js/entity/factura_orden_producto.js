import Factura from "./factura.js";
import OrdenProducto from "./orden_producto.js";

/** Entidad FacturaOrdenProducto según la representación JSON del recurso REST. */
class FacturaOrdenProducto {
    /** Construye la entidad con sus propiedades REST. */
    constructor() {
        this.idFacturaOrdenProducto = null;
        this.precio = null;
        this.observaciones = null;
        this.idFactura = null;
        this.idOrdenProducto = null;
    }

    /** Tipos de las relaciones incluidas en la respuesta de la API. */
    static relaciones = {
        idFactura: Factura,
        idOrdenProducto: OrdenProducto,
    };
}

export default FacturaOrdenProducto;
