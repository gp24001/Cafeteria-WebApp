import DefaultDao from "./default_dao.js";

/** Acceso al recurso REST EmpleadoRol dentro de Empleado. */
export default class EmpleadoRolDao extends DefaultDao {
    /**
     * Selecciona las asociaciones de un registro de Empleado.
     * @param {string} idEmpleado UUID del registro principal.
     */
    constructor(idEmpleado) {
        super();
        this.URL += `empleado/${encodeURIComponent(idEmpleado)}/rol`;
    }
}
