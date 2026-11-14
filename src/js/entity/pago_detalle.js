import Pago from "./pago.js";

/** Entidad PagoDetalle según la representación JSON del recurso REST. */
class PagoDetalle {
    /** Construye la entidad con sus propiedades REST. */
    constructor() {
        this.idPagoDetalle = null;
        this.monto = null;
        this.observaciones = null;
        this.referenciaExterna = null;
        this.idPago = null;
        this.tipoPago = null;
    }

    /** Tipos de las relaciones incluidas en la respuesta de la API. */
    static relaciones = {
        idPago: Pago,
    };
}

export default PagoDetalle;
