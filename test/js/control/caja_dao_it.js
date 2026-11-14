import sinon from "../../lib/sinon/sinon-esm.js";
import { expect } from "../../lib/chai/index.js";
import CajaDao from "../../../src/js/control/caja_dao.js";
import DefaultResponse from "../../../src/js/entity/default_response.js";
import Caja from "../../../src/js/entity/caja.js";
mocha.setup("bdd");
describe("CajaDao: integración con la API", function(){
    let peticion;
    beforeEach(() => { peticion = sinon.spy(window, "fetch"); });
    afterEach(() => peticion.restore());
    it("recupera la página real, su total y los campos necesarios para seleccionar una caja", async function(){
        const dao = new CajaDao();
        const pagina = await dao.findRange(0, 10);
        sinon.assert.calledOnceWithExactly(peticion, dao.URL + "?min=0&max=10", { method: "GET" });
        expect(pagina).to.be.instanceOf(DefaultResponse);
        expect(pagina.totalDatos).to.match(/^\d+$/);
        expect(pagina.datos).to.have.lengthOf(Math.min(10, Number(pagina.totalDatos)));
        for (const caja of pagina.datos) {
            expect(caja).to.be.instanceOf(Caja);
            expect(caja.idCaja).to.be.a("string").and.not.be.empty;
            expect(caja.nombre).to.be.a("string");
            expect(caja.activo).to.be.a("boolean");
        }
    });
});

mocha.run();
