import DefaultDao from "./default_dao.js";

/** Acceso al recurso REST Caracteristica. */
export default class CaracteristicaDao extends DefaultDao {
    /** Configura la ruta de Caracteristica. */
    constructor() {
        super();
        this.URL += "caracteristica";
    }
}
