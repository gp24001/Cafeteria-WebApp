import DefaultDao from "./default_dao.js";
/** Consulta las cajas del establecimiento mediante el recurso REST de Caja. */
class CajaDao extends DefaultDao{
    /** Configura la colección de cajas para las consultas heredadas. */
    constructor(){
        super();
        this.URL +="caja";
    }
}
export default CajaDao;
