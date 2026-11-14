import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import DefaultDao from "../../../src/js/control/default_dao.js";
import PagoDetalle from "../../../src/js/entity/pago_detalle.js";
import Pago from "../../../src/js/entity/pago.js";
import Factura from "../../../src/js/entity/factura.js";
import { registros } from "./datos_entidades.js";

mocha.setup("tdd");
suite("PagoDetalle: unidad", function () {
    const datos = registros.PagoDetalle;
    let peticion;
    setup(() => { peticion = sinon.stub(window, "fetch"); });
    teardown(() => sinon.restore());

    test("conserva monto, medio y referencia del abono al recuperar y serializar la entidad", async function () {
        const original = JSON.stringify(datos);
        peticion.resolves(new Response(original));
        const registro = await new DefaultDao(PagoDetalle).findById(datos.idPagoDetalle);
        expect(registro).to.be.instanceOf(PagoDetalle);
        for (const [ruta, Tipo] of [["idPago", Pago], ["idPago.idFactura", Factura]]) {
            expect(ruta.split(".").reduce((valor, campo) => valor[campo], registro), ruta).to.be.instanceOf(Tipo);
        }
        expect(JSON.stringify(registro)).to.equal(original);
        expect(JSON.stringify(datos)).to.equal(original);
        expect(peticion.firstCall.args[1]).to.equal(undefined);
    });

    test("Conserva únicamente los campos recibidos de la API", async function () {
        const parcial = { idPagoDetalle: datos.idPagoDetalle };
        peticion.resolves(new Response(JSON.stringify(parcial)));
        const registro = await new DefaultDao(PagoDetalle).findById(datos.idPagoDetalle);
        expect(registro).to.be.instanceOf(PagoDetalle);
        expect(Object.keys(registro)).to.deep.equal(["idPagoDetalle"]);
        expect(JSON.stringify(registro)).to.equal(JSON.stringify(parcial));
    });
});
mocha.run();
