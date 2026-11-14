import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import RecepcionOrdenDao from "../../../src/js/control/recepcion_orden_dao.js";
import { leerPreparacion, leerPreparacionUnidad, leerPresentacionUnidad } from "../../../src/js/control/preparacion_estado.js";
import { simularPreparacion } from "./api_simulada.js";

mocha.setup("tdd");
suite("Estado de preparación: Integración con recepción", function () {
    teardown(() => sinon.restore());
    test("recepción guarda los estados sin perder el cliente ni las opciones de cada producto", async function () {
        const api = simularPreparacion();
        const dao = new RecepcionOrdenDao();
        let orden = await dao.cambiarPreparacion(api.orden, "barista", "PREPARAR");
        orden = await dao.cambiarPreparacion(orden, "barista", "TODOS_LISTOS");
        orden = await dao.cambiarPreparacion(orden, "barista", "DESPACHAR");
        expect(leerPreparacion(api.leerOrden().observacion).estado).to.equal("DESPACHADA");
        expect(leerPreparacion(api.leerOrden().observacion).texto).to.equal("Cliente: Ana · Pedido web referencia");
        expect(api.unidades.every(u => leerPreparacionUnidad(u.observaciones).listo)).to.be.true;
        expect(api.unidades.map(u => leerPresentacionUnidad(u.observaciones)))
            .to.deep.equal(["12 Onzas · Leche deslactosada", "12 Onzas · Leche deslactosada"]);
        expect(orden.listos).to.have.members(["u1", "u2"]);
        expect(api.solicitudes.filter(s => s.metodo === "PUT")).to.have.lengthOf(4);
    });
});
mocha.run();
