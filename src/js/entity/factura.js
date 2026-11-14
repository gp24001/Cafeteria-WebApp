import Caja from "./caja.js";
import EmpleadoRol from "./empleado_rol.js";

/** Entidad Factura según la representación JSON del recurso REST. */
class Factura {
    /** Construye la entidad con sus propiedades REST. */
    constructor() {
        this.idFactura = null;
        this.cliente = null;
        this.fechaFacturacion = null;
        this.estado = null;
        this.observaciones = null;
        this.idCaja = null;
        this.idEmpleadoRol = null;
    }

    /** Tipos de las relaciones incluidas en la respuesta de la API. */
    static relaciones = {
        idCaja: Caja,
        idEmpleadoRol: EmpleadoRol,
    };
}

export default Factura;
