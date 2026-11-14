/** Entidad TipoCaracteristica según la representación JSON del recurso REST. */
class TipoCaracteristica {
    /** Construye la entidad con sus propiedades REST. */
    constructor() {
        this.idTipoCaracteristica = null;
        this.nombre = null;
        this.expresionRegular = null;
        this.activo = null;
        this.observaciones = null;
    }
}

export default TipoCaracteristica;
