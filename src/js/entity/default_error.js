/** Conserva el mensaje para la interfaz y la respuesta HTTP o causa original del fallo. */
class DefaultError{
    /** Inicializa un fallo sin mensaje ni causa, que el DAO completará al rechazar la consulta. */
    constructor(){
        this.mensaje = "";
        this.error = null;
    }
}
export default DefaultError;