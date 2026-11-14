import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import DefaultDao from "../../../src/js/control/default_dao.js";
import DefaultError from "../../../src/js/entity/default_error.js";
import Producto from "../../../src/js/entity/producto.js";
import Pago from "../../../src/js/entity/pago.js";
import Orden from "../../../src/js/entity/orden.js";
mocha.setup("tdd");
suite("DefaultError", function () {
    teardown(() => sinon.restore());
    test("conserva la causa de red y un mensaje utilizable por las notificaciones", async function () {
        const causa = new TypeError("Sin conexión");
        sinon.stub(window, "fetch").rejects(causa);
        const fallo = await new DefaultDao(Producto).findById("latte").catch(error => error);
        expect(fallo).to.be.instanceOf(DefaultError);
        expect(fallo.error).to.equal(causa);
        expect(fallo.mensaje).to.equal("Error al acceder al repositorio");
    });
    test("conserva respuesta HTTP y mensaje del servidor sin sustituirlos por datos exitosos", async function () {
        const respuesta = new Response(null, { status: 422, headers: { "App-Error": "El monto excede el saldo" } });
        sinon.stub(window, "fetch").resolves(respuesta);
        const fallo = await new DefaultDao(Pago).findById("pago-efectivo").catch(error => error);
        expect(fallo).to.be.instanceOf(DefaultError);
        expect(fallo.error).to.equal(respuesta);
        expect(fallo.mensaje).to.equal("El monto excede el saldo");
    });
    test("una respuesta JSON dañada conserva su causa en lugar de convertirse en una entidad vacía", async function () {
        sinon.stub(window, "fetch").resolves(new Response("{invalido"));
        const fallo = await new DefaultDao(Orden).findById("orden-ana").catch(error => error);
        expect(fallo).to.be.instanceOf(DefaultError);
        expect(fallo.error).to.be.instanceOf(SyntaxError);
        expect(fallo.mensaje).to.equal("Error al procesar los datos de respuesta");
    });
});
mocha.run();
