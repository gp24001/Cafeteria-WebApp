import { expect } from "../../lib/chai/index.js";
import { centavos, dinero, totalesPorMedio } from "../../../src/js/control/importes.js";

mocha.setup("tdd");
suite("Importes: Unidad", function () {
    test("convierte importes válidos sin introducir errores de decimales", function () {
        expect(centavos("0,25")).to.equal(25);
        expect(centavos("0.10") + centavos("0.20")).to.equal(30);
        expect(dinero(350)).to.equal("$3.50");
    });
    test("rechaza exponentes, negativos y más de dos decimales", function () {
        for (const monto of ["", "-1", "1e2", "1.001", "NaN", "999999999999999999999"]) expect(() => centavos(monto)).to.throw();
    });
    test("suma los aportes del mismo medio y conserva intacto el historial", function () {
        const historial = [{ detalles: [{ tipoPago: "EFECTIVO", monto: 1 }, { tipoPago: "TARJETA", monto: 0.5 }] },
            { detalles: [{ tipoPago: "EFECTIVO", monto: 2.5 }] }];
        const original = JSON.stringify(historial);
        expect(totalesPorMedio(historial)).to.deep.equal([{ tipoPago: "EFECTIVO", monto: 350 }, { tipoPago: "TARJETA", monto: 50 }]);
        expect(JSON.stringify(historial)).to.equal(original);
    });
    test("solo interpreta como vuelto el efectivo registrado con un importe válido", function () {
        const detalles = [
            { tipoPago: " Efectivo ", monto: 1, observaciones: "Efectivo recibido (centavos): 125" },
            { tipoPago: "EFECTIVO", monto: 2, observaciones: "Efectivo recibido (centavos): pendiente" },
            { tipoPago: "TARJETA", monto: 3, observaciones: "Efectivo recibido (centavos): 400" }
        ];
        expect(totalesPorMedio([{ detalles }])).to.deep.equal([
            { tipoPago: "EFECTIVO", monto: 300, vuelto: 25 }, { tipoPago: "TARJETA", monto: 300 }
        ]);
    });
});
mocha.run();
