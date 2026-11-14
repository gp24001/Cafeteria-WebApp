import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import DefaultDao from "../../../src/js/control/default_dao.js";
import Caja from "../../../src/js/entity/caja.js";
import { registros } from "./datos_entidades.js";

mocha.setup("tdd");
suite("Caja: unidad", function () {
    const datos = registros.Caja;
    let peticion;
    setup(() => { peticion = sinon.stub(window, "fetch"); });
    teardown(() => sinon.restore());

    test("conserva estado activo y caja virtual al recuperar y serializar la entidad", async function () {
        const original = JSON.stringify(datos);
        peticion.resolves(new Response(original));
        const registro = await new DefaultDao(Caja).findById(datos.idCaja);
        expect(registro).to.be.instanceOf(Caja);
        expect(JSON.stringify(registro)).to.equal(original);
        expect(JSON.stringify(datos)).to.equal(original);
        expect(peticion.firstCall.args[1]).to.equal(undefined);
    });

    test("Conserva únicamente los campos recibidos de la API", async function () {
        const parcial = { idCaja: datos.idCaja };
        peticion.resolves(new Response(JSON.stringify(parcial)));
        const registro = await new DefaultDao(Caja).findById(datos.idCaja);
        expect(registro).to.be.instanceOf(Caja);
        expect(Object.keys(registro)).to.deep.equal(["idCaja"]);
        expect(JSON.stringify(registro)).to.equal(JSON.stringify(parcial));
    });
});
mocha.run();
