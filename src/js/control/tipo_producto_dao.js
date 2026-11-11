import DefaultDao from "./default_dao.js";

/** Acceso al recurso REST TipoProducto. */
export default class TipoProductoDao extends DefaultDao {
    /** Configura la ruta de TipoProducto. */
    constructor() {
        super();
        this.URL += "tipoProducto";
    }
}
