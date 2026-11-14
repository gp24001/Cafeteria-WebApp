import { expect } from "../../lib/chai/index.js";
import { generarTicket } from "../../../src/js/control/ticket_pdf.js";

mocha.setup("tdd");
suite("Formato de características: Integración con el ticket", function () {
    test("las notas antiguas llegan al ticket sin valores de relleno y conservan el tamaño solicitado", async function () {
        const lineas = [{ nombre: "Latte", precio: 2, cantidad: 1,
            presentacion: "1 Porcion · 16 Onzas · Leche deslactosada: - · 1 Sin Azucar" }];
        const original = JSON.stringify(lineas);
        const pdf = generarTicket({ factura: { idFactura: "f1", fechaFacturacion: "2026-11-13T12:00:00Z" },
            orden: { idOrden: "orden" }, lineas, historial: [], total: 200, pagado: 200, saldo: 0 });
        const texto = [...(await pdf.text()).matchAll(/<([\da-f]+)> Tj/g)]
            .map(m => m[1].match(/../g).map(h => String.fromCharCode(parseInt(h, 16))).join("")).join(" ");
        expect(texto).to.include("16 Onzas").and.include("Leche deslactosada").and.include("Sin Azucar");
        expect(texto).not.to.include("1 Porcion").and.not.to.include("Leche deslactosada: -");
        expect(JSON.stringify(lineas)).to.equal(original);
    });
});
mocha.run();
