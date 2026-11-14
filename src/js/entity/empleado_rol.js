import Empleado from "./empleado.js";
import Rol from "./rol.js";

/** Entidad EmpleadoRol según la representación JSON del recurso REST. */
class EmpleadoRol {
    /** Construye la entidad con sus propiedades REST. */
    constructor() {
        this.idEmpleadoRol = null;
        this.activo = null;
        this.observaciones = null;
        this.idEmpleado = null;
        this.idRol = null;
    }

    /** Tipos de las relaciones incluidas en la respuesta de la API. */
    static relaciones = {
        idEmpleado: Empleado,
        idRol: Rol,
    };
}

export default EmpleadoRol;
