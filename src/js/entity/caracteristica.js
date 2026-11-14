import TipoCaracteristica from "./tipo_caracteristica.js";

/** Entidad Caracteristica según la representación JSON del recurso REST. */
class Caracteristica {
    /** Construye la entidad con sus propiedades REST. */
    constructor() {
        this.idCaracteristica = null;
        this.nombre = null;
        this.activo = null;
        this.observaciones = null;
        this.idTipoCaracteristica = null;
    }

    /** Tipos de las relaciones incluidas en la respuesta de la API. */
    static relaciones = {
        idTipoCaracteristica: TipoCaracteristica,
    };
}

export default Caracteristica;
