/** Entidad Empleado según la representación JSON del recurso REST. */
class Empleado {
    /** Construye la entidad con sus propiedades REST. */
    constructor() {
        this.idEmpleado = null;
        this.nombre = null;
        this.apellido = null;
        this.activo = null;
        this.observaciones = null;
    }
}

export default Empleado;
