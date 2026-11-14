import { expect } from "../../lib/chai/index.js";
import DefaultDao from "../../../src/js/control/default_dao.js";
import Producto from "../../../src/js/entity/producto.js";
import DefaultResponse from "../../../src/js/entity/default_response.js";

mocha.setup("tdd");
suite("DefaultDao: Integración con la API", function () {
    this.timeout(10000);
    test("consulta y transforma una página real del recurso de productos", async function () {
        const dao = new DefaultDao(Producto); dao.URL += "producto";
        const pagina = await dao.findRange(0, 1);
        expect(pagina).to.be.instanceOf(DefaultResponse);
        expect(pagina.totalDatos).to.match(/^\d+$/);
        expect(pagina.datos).to.have.lengthOf(Math.min(1, Number(pagina.totalDatos)));
        for (const producto of pagina.datos) expect(producto).to.be.instanceOf(Producto);
    });
});
mocha.run();
