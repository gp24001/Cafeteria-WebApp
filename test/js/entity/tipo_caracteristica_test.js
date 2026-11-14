import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import DefaultDao from "../../../src/js/control/default_dao.js";
import TipoCaracteristica from "../../../src/js/entity/tipo_caracteristica.js";
import { registros } from "./datos_entidades.js";

mocha.setup("tdd");
suite("TipoCaracteristica: unidad", function () {
    const datos = registros.TipoCaracteristica;
    let peticion;
    setup(() => { peticion = sinon.stub(window, "fetch"); });
    teardown(() => sinon.restore());

    test("conserva expresión regular sin escapes perdidos al recuperar y serializar la entidad", async function () {
        const original = JSON.stringify(datos);
        peticion.resolves(new Response(original));
        const registro = await new DefaultDao(TipoCaracteristica).findById(datos.idTipoCaracteristica);
        expect(registro).to.be.instanceOf(TipoCaracteristica);
        expect(JSON.stringify(registro)).to.equal(original);
        expect(JSON.stringify(datos)).to.equal(original);
        expect(peticion.firstCall.args[1]).to.equal(undefined);
    });

    test("Conserva únicamente los campos recibidos de la API", async function () {
        const parcial = { idTipoCaracteristica: datos.idTipoCaracteristica };
        peticion.resolves(new Response(JSON.stringify(parcial)));
        const registro = await new DefaultDao(TipoCaracteristica).findById(datos.idTipoCaracteristica);
        expect(registro).to.be.instanceOf(TipoCaracteristica);
        expect(Object.keys(registro)).to.deep.equal(["idTipoCaracteristica"]);
        expect(JSON.stringify(registro)).to.equal(JSON.stringify(parcial));
    });
});
mocha.run();
