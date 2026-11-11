import DefaultDao from "./default_dao.js";

/** Acceso al recurso REST Producto. */
export default class ProductoDao extends DefaultDao {
    /** Configura la ruta de Producto. */
    constructor() {
        super();
        this.URL += "producto";
    }
}
