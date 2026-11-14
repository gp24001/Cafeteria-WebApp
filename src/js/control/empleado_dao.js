import Empleado from "../entity/empleado.js";
import DefaultDao from "./default_dao.js";

/** Acceso al recurso REST Empleado. */
export default class EmpleadoDao extends DefaultDao {
    /** Configura la ruta de Empleado. */
    constructor() {
        super(Empleado);
        this.URL += "empleado";
    }

    /** Envía los datos al recurso REST propio y devuelve el registro creado. */
    crear(datos) {
        return this.solicitarJson(this.URL, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos)
        });
    }
}
