import sinon from "../../lib/sinon/sinon-esm.js";
import { expect } from "../../lib/chai/index.js";
import DefaultResponse from "../../../src/js/entity/default_response.js";
import PagoDao from "../../../src/js/control/pago_dao.js";

mocha.setup("bdd");
describe("PagoDao", function () {
    this.timeout(10000);
    let peticion;
    beforeEach(() => { peticion = sinon.spy(window, "fetch"); });
    afterEach(() => peticion.restore());

    it("consulta la página y busca el registro por UUID cuando hay datos", async function () {
        const dao = new PagoDao();
        const pagina = await dao.findRange(0, 1);
        expect(pagina).to.be.instanceOf(DefaultResponse);
        expect(pagina.totalDatos).to.match(/^\d+$/);
        expect(pagina.datos).to.be.an("array").of.length(Math.min(1, Number(pagina.totalDatos)));
        if (pagina.datos.length > 0) {
            const id = pagina.datos[0].idPago;
            expect(id).to.be.a("string");
            const registro = await dao.findById(id);
            expect(registro.idPago).to.equal(id);
        }
    });

    it("rechaza un tamaño de página cero e identifica los parámetros inválidos", async function () {
        const dao = new PagoDao();
        const fallo = await dao.findRange(0, 0).catch(error => error);
        sinon.assert.calledOnceWithExactly(peticion, dao.URL + "?min=0&max=0", { method: "GET" });
        expect(fallo.error.status).to.equal(422);
        expect(fallo.error.headers.get("Wrong-Param")).to.equal("min,max");
    });

    it("rechaza una solicitud de creación sin datos", async function () {
        const dao = new PagoDao();
        const fallo = await dao.crear(null).catch(error => error);
        expect(fallo.error.status).to.equal(422);
        expect(fallo.error.headers.get("App-Error")).to.be.a("string").and.not.be.empty;
    });
});
mocha.run();
