import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import CajaDao from "../../../src/js/control/caja_dao.js";
import Caja from "../../../src/js/entity/caja.js";
import DefaultResponse from "../../../src/js/entity/default_response.js";

mocha.setup("tdd");
suite("CajaDao", function () {
    let peticion;
    setup(() => { peticion = sinon.stub(window, "fetch"); });
    teardown(() => sinon.restore());

    test("consulta la página solicitada y conserva las cajas activas e inactivas para que la vista decida", async function () {
        const cajas = [{ idCaja: "virtual", nombre: "Caja Virtual", activo: true, observaciones: "Web" },
            { idCaja: "fisica", nombre: "Caja 1", activo: false, observaciones: null }];
        peticion.resolves(new Response(JSON.stringify(cajas), { headers: { "Total-registros": "53" } }));
        const dao = new CajaDao();
        const pagina = await dao.findRange(2, 10);
        expect(peticion.firstCall.args).to.deep.equal([dao.URL + "?min=2&max=10", { method: "GET" }]);
        expect(dao.URL).to.match(/\/caja$/);
        expect(pagina).to.be.instanceOf(DefaultResponse);
        expect(pagina.totalDatos).to.equal("53");
        expect(pagina.datos).to.deep.equal(cajas);
        expect(pagina.datos.every(caja => caja instanceof Caja)).to.be.true;
    });

    test("reúne las páginas sin perder cajas ni repetir registros al seleccionar la caja virtual", async function () {
        const cajas = Array.from({ length: 51 }, (_, i) => ({ idCaja: "caja-" + i, nombre: i === 50 ? "Caja Virtual" : "Caja " + i, activo: true }));
        peticion.onFirstCall().resolves(new Response(JSON.stringify(cajas.slice(0, 50)), { headers: { "Total-registros": "51" } }));
        peticion.onSecondCall().resolves(new Response(JSON.stringify(cajas.slice(50)), { headers: { "Total-registros": "51" } }));
        const dao = new CajaDao();
        const registros = await dao.listarTodos();
        expect(registros).to.deep.equal(cajas);
        expect(registros.at(-1).nombre).to.equal("Caja Virtual");
        expect(peticion.getCalls().map(llamada => llamada.args[0]))
            .to.deep.equal([dao.URL + "?min=0&max=50", dao.URL + "?min=50&max=50"]);
    });
});
mocha.run();
