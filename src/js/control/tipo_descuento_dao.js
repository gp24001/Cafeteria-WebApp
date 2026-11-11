import DefaultDao from "./default_dao.js";

/** Acceso al recurso REST TipoDescuento. */
export default class TipoDescuentoDao extends DefaultDao {
    /** Configura la ruta de TipoDescuento. */
    constructor() {
        super();
        this.URL += "tipoDescuento";
    }
}
