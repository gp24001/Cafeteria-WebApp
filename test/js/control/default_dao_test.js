import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import DefaultDao from "../../../src/js/control/default_dao.js";
import Producto from "../../../src/js/entity/producto.js";
import DefaultError from "../../../src/js/entity/default_error.js";

mocha.setup("tdd");
suite("DefaultDao: Unidad", function () {
    let peticion;
    setup(() => { peticion = sinon.stub(window, "fetch"); });
    teardown(() => sinon.restore());

    test("consulta el registro solicitado y conserva su tipo y sus campos", async function () {
        peticion.resolves(new Response(JSON.stringify({ idProducto: "cafe", precioSugerido: 2.25, activo: false })));
        const dao = new DefaultDao(Producto);
        const producto = await dao.findById("cafe");
        expect(peticion.firstCall.args[0]).to.equal(dao.URL + "/cafe");
        expect(producto).to.be.instanceOf(Producto);
        expect(producto.precioSugerido).to.equal(2.25);
        expect(producto.activo).to.be.false;
        expect(Object.hasOwn(producto, "nombre")).to.be.false;
    });

    test("conserva el mensaje del servidor cuando una petición es rechazada", async function () {
        const respuesta = new Response(null, { status: 422, headers: { "App-Error": "Dato inválido" } });
        peticion.resolves(respuesta);
        const fallo = await new DefaultDao().findById("invalido").catch(error => error);
        expect(fallo).to.be.instanceOf(DefaultError);
        expect(fallo.error).to.equal(respuesta);
        expect(fallo.mensaje).to.equal("Dato inválido");
    });

    test("distingue una respuesta JSON inválida de un error de conexión", async function () {
        peticion.resolves(new Response("{incorrecto"));
        const dao = new DefaultDao();
        expect((await dao.findById("x").catch(error => error)).error).to.be.instanceOf(SyntaxError);
        const causa = new TypeError("Sin conexión");
        peticion.rejects(causa);
        expect((await dao.findById("x").catch(error => error)).error).to.equal(causa);
    });
});
mocha.run();
