import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import DefaultDao from "../../../src/js/control/default_dao.js";
import Descuento from "../../../src/js/entity/descuento.js";
import TipoDescuento from "../../../src/js/entity/tipo_descuento.js";
import { registros } from "./datos_entidades.js";

mocha.setup("tdd");
suite("Descuento: unidad", function () {
    const datos = registros.Descuento;
    let peticion;
    setup(() => { peticion = sinon.stub(window, "fetch"); });
    teardown(() => sinon.restore());

    test("conserva vigencia y límite del descuento al recuperar y serializar la entidad", async function () {
        const original = JSON.stringify(datos);
        peticion.resolves(new Response(original));
        const registro = await new DefaultDao(Descuento).findById(datos.idDescuento);
        expect(registro).to.be.instanceOf(Descuento);
        for (const [ruta, Tipo] of [["idTipoDescuento", TipoDescuento]]) {
            expect(ruta.split(".").reduce((valor, campo) => valor[campo], registro), ruta).to.be.instanceOf(Tipo);
        }
        expect(JSON.stringify(registro)).to.equal(original);
        expect(JSON.stringify(datos)).to.equal(original);
        expect(peticion.firstCall.args[1]).to.equal(undefined);
    });

    test("Conserva únicamente los campos recibidos de la API", async function () {
        const parcial = { idDescuento: datos.idDescuento };
        peticion.resolves(new Response(JSON.stringify(parcial)));
        const registro = await new DefaultDao(Descuento).findById(datos.idDescuento);
        expect(registro).to.be.instanceOf(Descuento);
        expect(Object.keys(registro)).to.deep.equal(["idDescuento"]);
        expect(JSON.stringify(registro)).to.equal(JSON.stringify(parcial));
    });
});
mocha.run();
