import DefaultDao from "./default_dao.js";

/** Acceso al recurso REST TipoCaracteristica. */
export default class TipoCaracteristicaDao extends DefaultDao {
    /** Configura la ruta de TipoCaracteristica. */
    constructor() {
        super();
        this.URL += "tipoCaracteristica";
    }
}
