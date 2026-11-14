import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import RecepcionOrdenDao from "../../../src/js/control/recepcion_orden_dao.js";
import { generarTicket } from "../../../src/js/control/ticket_pdf.js";
import { simularPreparacion } from "./api_simulada.js";

mocha.setup("tdd");
suite("Ticket PDF: Integración con el detalle de la orden", function () {
    teardown(() => sinon.restore());
    test("genera el PDF con las cantidades y precios históricos del detalle consultado", async function () {
        const api = simularPreparacion();
        const lineas = await new RecepcionOrdenDao().detalle({ unidades: api.unidades });
        expect(lineas[0]).to.include({ nombre: "Latte", cantidad: 2, precio: 2 });
        const pdf = generarTicket({ factura: { idFactura: "f1", cliente: "Ana", fechaFacturacion: "2026-11-13T12:00:00Z" },
            orden: api.orden, lineas, historial: [{ detalles: [{ tipoPago: "EFECTIVO", monto: 4 }] }], total: 400, pagado: 400, saldo: 0 });
        const textoPDF = await pdf.text();
        const textos = [...textoPDF.matchAll(/<([\da-f]+)> Tj/g)]
            .map(m => m[1].match(/../g).map(h => String.fromCharCode(parseInt(h, 16))).join(""));
        expect(textos.join(" ")).to.include("Latte x2").and.include("12 Onzas").and.include("Leche deslactosada");
        expect(textos.find(t => t.startsWith("TOTAL"))).to.include("$4.00");
        expect(textoPDF).to.include("xref").and.include("%%EOF");
        expect(api.solicitudes.every(s => s.metodo === "GET")).to.be.true;
    });
});
mocha.run();
