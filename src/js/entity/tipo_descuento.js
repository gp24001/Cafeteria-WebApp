/** Entidad TipoDescuento según la representación JSON del recurso REST. */
class TipoDescuento {
    /** Construye la entidad con sus propiedades REST. */
    constructor() {
        this.idTipoDescuento = null;
        this.nombre = null;
        this.activo = null;
        this.descuentoMaximo = null;
        this.observaciones = null;
    }
}

export default TipoDescuento;
