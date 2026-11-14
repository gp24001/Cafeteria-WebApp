import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import DefaultDao from "../../../src/js/control/default_dao.js";
import DefaultResponse from "../../../src/js/entity/default_response.js";
import Producto from "../../../src/js/entity/producto.js";
import { registros } from "./datos_entidades.js";
const producto = registros.Producto;
mocha.setup("tdd");
suite("DefaultResponse", function () {
    teardown(() => sinon.restore());
    test("las páginas independientes no comparten registros ni alteran sus totales", function () {
        const primera = new DefaultResponse(), segunda = new DefaultResponse();
        primera.datos.push(producto); primera.totalDatos = "53";
        expect(segunda.datos).to.deep.equal([]);
        expect(segunda.totalDatos).to.equal(-1);
        expect(primera.datos[0]).to.equal(producto);
        expect(primera.totalDatos).to.equal("53");
    });
    test("conserva el total del servidor aunque sea mayor que la página y tipa sus registros", async function () {
        sinon.stub(window, "fetch").resolves(new Response(JSON.stringify([producto]), { headers: { "Total-registros": "53" } }));
        const pagina = await new DefaultDao(Producto).findRange(0, 1);
        expect(pagina).to.be.instanceOf(DefaultResponse);
        expect(pagina.totalDatos).to.equal("53");
        expect(pagina.datos).to.have.lengthOf(1);
        expect(pagina.datos[0]).to.be.instanceOf(Producto);
        expect(JSON.stringify(pagina.datos[0])).to.equal(JSON.stringify(producto));
    });
});

mocha.run();
