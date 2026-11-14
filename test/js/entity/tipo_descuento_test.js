import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import DefaultDao from "../../../src/js/control/default_dao.js";
import TipoDescuento from "../../../src/js/entity/tipo_descuento.js";
import { registros } from "./datos_entidades.js";

mocha.setup("tdd");
suite("TipoDescuento: unidad", function () {
    const datos = registros.TipoDescuento;
    let peticion;
    setup(() => { peticion = sinon.stub(window, "fetch"); });
    teardown(() => sinon.restore());

    test("conserva límite decimal y estado del descuento al recuperar y serializar la entidad", async function () {
        const original = JSON.stringify(datos);
        peticion.resolves(new Response(original));
        const registro = await new DefaultDao(TipoDescuento).findById(datos.idTipoDescuento);
        expect(registro).to.be.instanceOf(TipoDescuento);
        expect(JSON.stringify(registro)).to.equal(original);
        expect(JSON.stringify(datos)).to.equal(original);
        expect(peticion.firstCall.args[1]).to.equal(undefined);
    });

    test("Conserva únicamente los campos recibidos de la API", async function () {
        const parcial = { idTipoDescuento: datos.idTipoDescuento };
        peticion.resolves(new Response(JSON.stringify(parcial)));
        const registro = await new DefaultDao(TipoDescuento).findById(datos.idTipoDescuento);
        expect(registro).to.be.instanceOf(TipoDescuento);
        expect(Object.keys(registro)).to.deep.equal(["idTipoDescuento"]);
        expect(JSON.stringify(registro)).to.equal(JSON.stringify(parcial));
    });
});
mocha.run();
