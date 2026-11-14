import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import DefaultDao from "../../../src/js/control/default_dao.js";
import Caracteristica from "../../../src/js/entity/caracteristica.js";
import TipoCaracteristica from "../../../src/js/entity/tipo_caracteristica.js";
import { registros } from "./datos_entidades.js";

mocha.setup("tdd");
suite("Caracteristica: unidad", function () {
    const datos = registros.Caracteristica;
    let peticion;
    setup(() => { peticion = sinon.stub(window, "fetch"); });
    teardown(() => sinon.restore());

    test("conserva tipo y expresión regular al recuperar y serializar la entidad", async function () {
        const original = JSON.stringify(datos);
        peticion.resolves(new Response(original));
        const registro = await new DefaultDao(Caracteristica).findById(datos.idCaracteristica);
        expect(registro).to.be.instanceOf(Caracteristica);
        for (const [ruta, Tipo] of [["idTipoCaracteristica", TipoCaracteristica]]) {
            expect(ruta.split(".").reduce((valor, campo) => valor[campo], registro), ruta).to.be.instanceOf(Tipo);
        }
        expect(JSON.stringify(registro)).to.equal(original);
        expect(JSON.stringify(datos)).to.equal(original);
        expect(peticion.firstCall.args[1]).to.equal(undefined);
    });

    test("Conserva únicamente los campos recibidos de la API", async function () {
        const parcial = { idCaracteristica: datos.idCaracteristica };
        peticion.resolves(new Response(JSON.stringify(parcial)));
        const registro = await new DefaultDao(Caracteristica).findById(datos.idCaracteristica);
        expect(registro).to.be.instanceOf(Caracteristica);
        expect(Object.keys(registro)).to.deep.equal(["idCaracteristica"]);
        expect(JSON.stringify(registro)).to.equal(JSON.stringify(parcial));
    });
});
mocha.run();
