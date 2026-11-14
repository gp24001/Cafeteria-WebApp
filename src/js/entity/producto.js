/** Entidad Producto según la representación JSON del recurso REST. */
class Producto {
    /** Construye la entidad con sus propiedades REST. */
    constructor() {
        this.idProducto = null;
        this.nombre = null;
        this.precioSugerido = null;
        this.activo = false;
        this.comentarios = null;
    }
}

export default Producto;
