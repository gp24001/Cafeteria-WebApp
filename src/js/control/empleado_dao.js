import DefaultDao from "./default_dao.js";

/** Acceso al recurso REST Empleado. */
export default class EmpleadoDao extends DefaultDao {
    /** Configura la ruta de Empleado. */
    constructor() {
        super();
        this.URL += "empleado";
    }
}
