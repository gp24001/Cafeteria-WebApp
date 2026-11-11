import sinon from "../../lib/sinon/sinon-esm.js";
import { expect } from "../../lib/chai/index.js";
import DefaultResponse from "../../../src/js/entity/default_response.js";
import ProductoTipoProductoDao from "../../../src/js/control/producto_tipo_producto_dao.js";
import ProductoDao from "../../../src/js/control/producto_dao.js";

mocha.setup("bdd");
describe("ProductoTipoProductoDao", function () {
    this.timeout(10000);
    let peticion;
    beforeEach(() => { peticion = sinon.spy(window, "fetch"); });
    afterEach(() => peticion.restore());

    it("consulta la página y busca el registro por UUID cuando hay datos", async function () {
        const padres = await new ProductoDao().findRange(0, 1);
        if (padres.datos.length === 0) {
            const dao = new ProductoTipoProductoDao(crypto.randomUUID());
            const fallo = await dao.findRange(0, 1).catch(error => error);
            expect(fallo.error.status).to.equal(404);
            return;
        }
        const idProducto = padres.datos[0].idProducto;
        expect(idProducto).to.be.a("string");
        const dao = new ProductoTipoProductoDao(idProducto);
        const pagina = await dao.findRange(0, 1);
        expect(pagina).to.be.instanceOf(DefaultResponse);
        expect(pagina.totalDatos).to.match(/^\d+$/);
        expect(pagina.datos).to.be.an("array").of.length(Math.min(1, Number(pagina.totalDatos)));
        if (pagina.datos.length > 0) {
            const id = pagina.datos[0].idProductoTipoProducto;
            expect(id).to.be.a("string");
            const registro = await dao.findById(id);
            expect(registro.idProductoTipoProducto).to.equal(id);
        }
    });

    it("rechaza un tamaño de página cero e identifica los parámetros inválidos", async function () {
        const dao = new ProductoTipoProductoDao(crypto.randomUUID());
        const fallo = await dao.findRange(0, 0).catch(error => error);
        sinon.assert.calledOnceWithExactly(peticion, dao.URL + "?min=0&max=0", { method: "GET" });
        expect(fallo.error.status).to.equal(422);
        expect(fallo.error.headers.get("Wrong-Param")).to.equal("min,max");
    });
});
mocha.run();
