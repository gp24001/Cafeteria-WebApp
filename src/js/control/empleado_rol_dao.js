import EmpleadoRol from "../entity/empleado_rol.js";
import DefaultDao from "./default_dao.js";

/** Acceso al recurso REST EmpleadoRol dentro de Empleado. */
export default class EmpleadoRolDao extends DefaultDao {
    /**
     * Selecciona las asociaciones de un registro de Empleado.
     * @param {string} idEmpleado UUID del registro principal.
     */
    constructor(idEmpleado) {
        super(EmpleadoRol);
        this.URL += `empleado/${encodeURIComponent(idEmpleado)}/rol`;
    }

    /** Envía los datos al recurso REST propio y devuelve el registro creado. */
    crear(datos) {
        return this.solicitarJson(this.URL, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos)
        });
    }
}
