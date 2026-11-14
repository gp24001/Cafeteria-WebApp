import { expect } from "../../lib/chai/index.js";
import DefaultResponse from "../../../src/js/entity/default_response.js";
import Producto from "../../../src/js/entity/producto.js";
import ProductoDao from "../../../src/js/control/producto_dao.js";

mocha.setup("tdd");
suite("DefaultResponse: integración con la API", function () {
    this.timeout(10000);

    test("conserva el total real del recurso y las entidades de la página recibida", async function () {
        const pagina = await new ProductoDao().findRange(0, 1);
        expect(pagina).to.be.instanceOf(DefaultResponse);
        expect(pagina.totalDatos).to.match(/^\d+$/);
        expect(pagina.datos).to.have.lengthOf(Math.min(1, Number(pagina.totalDatos)));
        for (const producto of pagina.datos) {
            expect(producto).to.be.instanceOf(Producto);
            expect(producto.idProducto).to.be.a("string").and.not.be.empty;
        }
    });
});
mocha.run();
