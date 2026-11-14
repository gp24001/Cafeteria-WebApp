import Rol from "../entity/rol.js";
import DefaultDao from "./default_dao.js";

/** Acceso al recurso REST Rol. */
export default class RolDao extends DefaultDao {
    /** Configura la ruta de Rol. */
    constructor() {
        super(Rol);
        this.URL += "rol";
    }
}
