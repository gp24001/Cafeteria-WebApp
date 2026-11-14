import TipoProducto from "../entity/tipo_producto.js";
import DefaultDao from "./default_dao.js";

/** Acceso al recurso REST TipoProducto. */
export default class TipoProductoDao extends DefaultDao {
    /** Configura la ruta de TipoProducto. */
    constructor() {
        super(TipoProducto);
        this.URL += "tipoProducto";
    }
}
