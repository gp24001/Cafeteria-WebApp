import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import ActualizacionAutomatica from "../../../src/js/control/actualizacion_automatica.js";
import ProductoDao from "../../../src/js/control/producto_dao.js";
import Producto from "../../../src/js/entity/producto.js";
import { simularApi } from "./api_simulada.js";

mocha.setup("tdd");
suite("ActualizacionAutomatica: Integración con las consultas", function () {
    let actualizacion;
    teardown(() => { actualizacion?.detener(); sinon.restore(); });
    test("el intervalo consulta el DAO y deja de solicitar productos al detener la actualización", async function () {
        const { peticion } = simularApi({ "GET producto": [{ idProducto: "cafe", nombre: "Café", activo: true }] });
        sinon.stub(document, "hidden").get(() => false);
        sinon.stub(navigator, "onLine").get(() => true);
        let registros = [];
        let finalizar, rechazar;
        const consultada = new Promise((resolve, reject) => { finalizar = resolve; rechazar = reject; });
        const dao = new ProductoDao();
        actualizacion = new ActualizacionAutomatica(async () => {
            try { registros = (await dao.findRange(0, 1)).datos; finalizar(); }
            catch (error) { rechazar(error); throw error; }
        }, 20);
        actualizacion.iniciar();
        await consultada;
        expect(registros).to.have.lengthOf(1);
        expect(registros[0]).to.be.instanceOf(Producto);
        expect(registros[0].nombre).to.equal("Café");
        sinon.assert.calledOnce(peticion);
        actualizacion.detener(); await new Promise(resolve => setTimeout(resolve, 60));
        sinon.assert.calledOnce(peticion);
    });
});
mocha.run();
