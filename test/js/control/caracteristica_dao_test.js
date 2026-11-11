import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import DefaultResponse from "../../../src/js/entity/default_response.js";
import DefaultError from "../../../src/js/entity/default_error.js";
import CaracteristicaDao from "../../../src/js/control/caracteristica_dao.js";

mocha.setup("tdd");
suite("CaracteristicaDao", function () {
    const id = "26abca46-4196-45b6-a225-c8d2028c8a37";
    const dao = new CaracteristicaDao();
    const url = `http://localhost:9080/cafefe-1.0-SNAPSHOT/resources/v1/caracteristica`;
    const registro = { idCaracteristica: id };
    let peticion;
    setup(() => { peticion = sinon.stub(window, "fetch"); });
    teardown(() => peticion.restore());

    test("findRange envía el desplazamiento y conserva el total", async function () {
        peticion.resolves(new Response(JSON.stringify([registro]), { headers: { "Total-registros": "5" } }));
        const pagina = await dao.findRange(2, 1);
        expect(peticion.firstCall.args).to.deep.equal([url + "?min=2&max=1", { method: "GET" }]);
        expect(pagina).to.be.instanceOf(DefaultResponse);
        expect(pagina.datos).to.deep.equal([registro]);
        expect(pagina.totalDatos).to.equal("5");
    });

    test("findById consulta el registro por UUID", async function () {
        peticion.resolves(new Response(JSON.stringify(registro)));
        expect(await dao.findById(id)).to.deep.equal(registro);
        expect(peticion.firstCall.args[0]).to.equal(url + "/" + id);
    });

    test("findById conserva el error del recurso", async function () {
        const respuesta = new Response(null, { status: 404, headers: { "App-Error": "Registro ausente" } });
        peticion.resolves(respuesta);
        const fallo = await dao.findById(id).catch(error => error);
        expect(fallo).to.be.instanceOf(DefaultError);
        expect(fallo.error).to.equal(respuesta);
        expect(fallo.mensaje).to.equal("Registro ausente");
    });
});
mocha.run();
