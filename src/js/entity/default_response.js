/** Representa una página de entidades y el total comunicado por la API. */
class DefaultResponse{
    /** Inicializa una página vacía cuyo total aún no se ha consultado. */
    constructor(){
        this.datos = [];
        this.totalDatos = -1;
    }
}
export default DefaultResponse;