import EmpleadoRol from "./empleado_rol.js";

/** Entidad Orden según la representación JSON del recurso REST. */
class Orden {
    /** Construye la entidad con sus propiedades REST. */
    constructor() {
        this.idOrden = null;
        this.fechaOrden = null;
        this.observacion = null;
        this.idEmpleadoRol = null;
    }

    /** Tipos de las relaciones incluidas en la respuesta de la API. */
    static relaciones = {
        idEmpleadoRol: EmpleadoRol,
    };
}

export default Orden;
