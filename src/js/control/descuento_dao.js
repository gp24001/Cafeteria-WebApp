import DefaultDao from "./default_dao.js";

/** Acceso al recurso REST Descuento. */
export default class DescuentoDao extends DefaultDao {
    /** Configura la ruta de Descuento. */
    constructor() {
        super();
        this.URL += "descuento";
    }
}
