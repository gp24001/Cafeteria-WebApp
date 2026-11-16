import { expect } from "../../lib/chai/index.js";
import { generarTicket } from "../../../src/js/control/ticket_pdf.js";

mocha.setup("tdd");
suite("Ticket PDF: Unidad", function () {
    const factura = { idFactura: "f1", cliente: "Ana", fechaFacturacion: "2026-11-12T20:00:00Z" };
    async function lineasDelTicket(pdf) {
        return Array.from((await pdf.text()).matchAll(/<([\da-f]+)> Tj/g), m =>
            m[1].match(/../g).map(h => String.fromCharCode(parseInt(h, 16))).join(""));
    }
    test("el PDF contiene factura, cliente, orden e importes; saldo pendiente impide generarlo", async function () {
        const datos = { factura, orden: { idOrden: "orden-1" }, lineas: [{ nombre: "Café", precio: 2, cantidad: 2 }],
            historial: [], total: 400, pagado: 400, saldo: 0 };
        const pdf = generarTicket(datos);
        expect(pdf.type).to.equal("application/pdf");
        const texto = await pdf.text();
        expect(texto.startsWith("%PDF-1.4")).to.be.true;
        expect(texto).to.include("xref").and.include("/MediaBox [0 0 226.77");
        expect(() => generarTicket({ ...datos, saldo: 200 })).to.throw("completar");
        const grande = generarTicket({ ...datos, lineas: Array.from({ length: 80 }, () => datos.lineas[0]) });
        expect((await grande.text()).match(/\/Type \/Page\s/g).length).to.be.greaterThan(1);
    });

    test("el ticket limpia valores de relleno y la porción unitaria sin perder tamaños ni modificar la orden", async function () {
        const lineas = [
            { nombre: "Panini", precio: 4, cantidad: 2, presentacion: "1 Porcion · Leche Entera: - · 1 Pan blanco · 1 Sin Azucar" },
            { nombre: "Latte", precio: 3, cantidad: 1, presentacion: "12 Onzas · Leche deslactosada: ." },
            { nombre: "Pastel", precio: 2, cantidad: 1, presentacion: "2 Porciones" }
        ];
        const originales = JSON.stringify(lineas);
        const pdf = generarTicket({ factura, orden: { idOrden: "o1" }, lineas, historial: [], total: 1300, pagado: 1300, saldo: 0 });
        const textos = await lineasDelTicket(pdf);
        const contenido = textos.join(" ");
        expect(contenido).to.include("Panini x2").and.include("Latte x1").and.include("Pastel x1");
        expect(contenido).to.include("Leche Entera").and.include("Pan blanco").and.include("Sin Azucar");
        expect(contenido).to.include("12 Onzas").and.include("Leche deslactosada").and.include("2 Porciones");
        expect(contenido).not.to.include("1 Porcion").and.not.to.include("1 Pan blanco").and.not.to.include("1 Sin Azucar");
        expect(contenido).not.to.include("Leche Entera: -").and.not.to.include("Leche deslactosada: .");
        expect(contenido).to.include("$13.00");
        expect(JSON.stringify(lineas)).to.equal(originales);
    });

    test("el ticket resume los aportes por medio una sola vez con los importes sumados", async function () {
        const historial = [1, 0.5].map(monto => ({ detalles: [{ tipoPago: "EFECTIVO", monto }] }))
            .concat([1, 1.5].map(monto => ({ detalles: [{ tipoPago: "TARJETA", monto }] })));
        const pdf = generarTicket({ factura, orden: { idOrden: "o1" }, lineas: [], historial, total: 400, pagado: 400, saldo: 0 });
        const textos = await lineasDelTicket(pdf);
        expect(textos.filter(t => t.startsWith("Efectivo")).map(t => t.trim())).to.deep.equal(["Efectivo                     $1.50"]);
        expect(textos.filter(t => t.startsWith("Tarjeta"))).to.have.lengthOf(1);
        expect(textos.find(t => t.startsWith("Tarjeta"))).to.include("$2.50");
        expect(textos.some(t => t.startsWith("Cambio"))).to.be.false;
    });

    test("imprime el efectivo entregado y el cambio al completar un cobro de $21.33 con $25", async function () {
        const historial = [{ detalles: [{ tipoPago: "EFECTIVO", monto: 21.33, observaciones: "Efectivo recibido (centavos): 2500" }] }];
        const textos = await lineasDelTicket(generarTicket({ factura, orden: { idOrden: "o1" }, lineas: [], historial,
            total: 2133, pagado: 2133, saldo: 0 }));
        expect(textos.find(t => t.startsWith("TOTAL USD"))).to.match(/\$21\.33$/);
        expect(textos.filter(t => t.startsWith("Efectivo"))).to.deep.equal(["Efectivo recibido".padEnd(28) + "$25.00"]);
        expect(textos.find(t => t.startsWith("Cambio"))).to.match(/\$3\.67$/);
    });

    test("agrupa el efectivo recibido de varios aportes y separa la parte pagada con tarjeta", async function () {
        const historial = [
            { detalles: [{ tipoPago: "EFECTIVO", monto: 2 }] },
            { detalles: [{ tipoPago: "TARJETA", monto: 4 }] },
            { detalles: [{ tipoPago: "EFECTIVO", monto: 15.33, observaciones: "Efectivo recibido (centavos): 2000" }] }
        ];
        const textos = await lineasDelTicket(generarTicket({ factura, orden: { idOrden: "o1" }, lineas: [], historial,
            total: 2133, pagado: 2133, saldo: 0 }));
        expect(textos.find(t => t.startsWith("Efectivo recibido"))).to.match(/\$22\.00$/);
        expect(textos.find(t => t.startsWith("Cambio"))).to.match(/\$4\.67$/);
        expect(textos.find(t => t.startsWith("Tarjeta"))).to.match(/\$4\.00$/);
    });

    test("genera un PDF de factura anulada con motivo, sin exigir un pago ni simular devolución", async function () {
        const pdf = generarTicket({ factura: { ...factura, estado: "ANULADA", observaciones: "Orden o1\nAnulación: Orden anulada: Pedido duplicado" },
            orden: { idOrden: "o1" }, lineas: [{ nombre: "Café", precio: 4, cantidad: 1 }], historial: [], total: 400, pagado: 0, saldo: 400 });
        const textos = await lineasDelTicket(pdf);
        expect(textos.join(" ")).to.include("FACTURA ANULADA").and.include("Pedido duplicado").and.include("SIN COBROS REGISTRADOS");
        expect(textos.join(" ")).not.to.include("PAGO COMPLETO");
    });

});
mocha.run();
