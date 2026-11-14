import TipoDescuento from "./tipo_descuento.js";

/** Entidad Descuento según la representación JSON del recurso REST. */
class Descuento {
    /** Construye la entidad con sus propiedades REST. */
    constructor() {
        this.idDescuento = null;
        this.nombre = null;
        this.fechaInicio = null;
        this.fechaFin = null;
        this.observaciones = null;
        this.idTipoDescuento = null;
    }

    /** Tipos de las relaciones incluidas en la respuesta de la API. */
    static relaciones = {
        idTipoDescuento: TipoDescuento,
    };
}

export default Descuento;
