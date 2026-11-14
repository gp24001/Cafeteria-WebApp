import Factura from "./factura.js";

/** Entidad Pago según la representación JSON del recurso REST. */
class Pago {
    /** Construye la entidad con sus propiedades REST. */
    constructor() {
        this.idPago = null;
        this.estado = null;
        this.observaciones = null;
        this.idFactura = null;
    }

    /** Tipos de las relaciones incluidas en la respuesta de la API. */
    static relaciones = {
        idFactura: Factura,
    };
}

export default Pago;
