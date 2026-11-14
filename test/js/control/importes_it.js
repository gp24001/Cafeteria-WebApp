import { expect } from "../../lib/chai/index.js";
import { centavos, totalesPorMedio } from "../../../src/js/control/importes.js";
import { generarTicket } from "../../../src/js/control/ticket_pdf.js";

mocha.setup("tdd");
suite("Importes: Integración con el ticket", function () {
    test("el ticket muestra los mismos importes acumulados que los aportes en efectivo y tarjeta", async function () {
        const historial = [1, 2, 0.5].map(monto => ({ detalles: [{ tipoPago: "EFECTIVO", monto }] }))
            .concat([{ detalles: [{ tipoPago: "TARJETA", monto: 0.5 }] }]);
        const total = totalesPorMedio(historial).reduce((suma, medio) => suma + medio.monto, 0);
        const pdf = generarTicket({ factura: { idFactura: "f1", cliente: "Ana", fechaFacturacion: "2026-11-13T12:00:00Z" },
            orden: { idOrden: "orden" }, lineas: [{ nombre: "Latte", cantidad: 2, precio: 2 }], historial,
            total: centavos("4"), pagado: total, saldo: 0 });
        const textos = [...(await pdf.text()).matchAll(/<([\da-f]+)> Tj/g)]
            .map(m => m[1].match(/../g).map(h => String.fromCharCode(parseInt(h, 16))).join(""));
        expect(textos.filter(t => t.startsWith("Efectivo"))).to.have.lengthOf(1);
        expect(textos.find(t => t.startsWith("Efectivo"))).to.include("$3.50");
        expect(textos.find(t => t.startsWith("Tarjeta"))).to.include("$0.50");
        expect(textos.find(t => t.startsWith("TOTAL"))).to.include("$4.00");
    });
});
mocha.run();
