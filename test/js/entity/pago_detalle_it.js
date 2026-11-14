import { expect } from "../../lib/chai/index.js";
import PagoDetalle from "../../../src/js/entity/pago_detalle.js";
import Pago from "../../../src/js/entity/pago.js";
import Factura from "../../../src/js/entity/factura.js";
import PagoDetalleDao from "../../../src/js/control/pago_detalle_dao.js";
import PagoDao from "../../../src/js/control/pago_dao.js";
import { buscarRegistro, leerConOriginal } from "./integracion_entidades.js";

mocha.setup("tdd");
suite("PagoDetalle: integración con la API", function () {
    this.timeout(30000);

    test("recupera un registro real con sus relaciones tipadas y sin perder valores del JSON", async function () {
        const encontrado = await buscarRegistro(new PagoDao(), "idPago", id => new PagoDetalleDao(id));
        if (!encontrado) {
            this.test.title += " (pendiente: no existen registros de PagoDetalle)";
            this.skip();
            return;
        }
        const id = encontrado.registro.idPagoDetalle;
        expect(id).to.be.a("string").and.not.be.empty;
        const { entidad, original } = await leerConOriginal(encontrado.dao, id);
        expect(entidad).to.be.instanceOf(PagoDetalle);
        expect(entidad.idPagoDetalle).to.equal(id);
        for (const [ruta, Tipo] of [["idPago", Pago], ["idPago.idFactura", Factura]]) {
            const relacionado = ruta.split(".").reduce((valor, campo) => valor?.[campo], entidad);
            if (relacionado != null) expect(relacionado, ruta).to.be.instanceOf(Tipo);
        }
        expect(JSON.stringify(entidad)).to.equal(JSON.stringify(original));
    });
});
mocha.run();
