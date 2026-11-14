import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import DefaultDao from "../../../src/js/control/default_dao.js";
import Pago from "../../../src/js/entity/pago.js";
import Factura from "../../../src/js/entity/factura.js";
import Caja from "../../../src/js/entity/caja.js";
import { registros } from "./datos_entidades.js";

mocha.setup("tdd");
suite("Pago: unidad", function () {
    const datos = registros.Pago;
    let peticion;
    setup(() => { peticion = sinon.stub(window, "fetch"); });
    teardown(() => sinon.restore());

    test("conserva confirmación del aporte y factura al recuperar y serializar la entidad", async function () {
        const original = JSON.stringify(datos);
        peticion.resolves(new Response(original));
        const registro = await new DefaultDao(Pago).findById(datos.idPago);
        expect(registro).to.be.instanceOf(Pago);
        for (const [ruta, Tipo] of [["idFactura", Factura], ["idFactura.idCaja", Caja]]) {
            expect(ruta.split(".").reduce((valor, campo) => valor[campo], registro), ruta).to.be.instanceOf(Tipo);
        }
        expect(JSON.stringify(registro)).to.equal(original);
        expect(JSON.stringify(datos)).to.equal(original);
        expect(peticion.firstCall.args[1]).to.equal(undefined);
    });

    test("Conserva únicamente los campos recibidos de la API", async function () {
        const parcial = { idPago: datos.idPago };
        peticion.resolves(new Response(JSON.stringify(parcial)));
        const registro = await new DefaultDao(Pago).findById(datos.idPago);
        expect(registro).to.be.instanceOf(Pago);
        expect(Object.keys(registro)).to.deep.equal(["idPago"]);
        expect(JSON.stringify(registro)).to.equal(JSON.stringify(parcial));
    });
});
mocha.run();
