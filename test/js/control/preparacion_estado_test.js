import { expect } from "../../lib/chai/index.js";
import { leerPreparacion, escribirPreparacion, MARCA_PREPARACION, leerPreparacionUnidad, escribirPreparacionUnidad, leerPresentacionUnidad, ordenConPreparacion } from "../../../src/js/control/preparacion_estado.js";

mocha.setup("tdd");
suite("Estado de preparación: Unidad", function () {
    test("cambia el estado de una unidad sin perder su presentación ni duplicar el texto", function () {
        const nota = "Pedido web referencia/cafe/1 · 12 Onzas · Leche entera";
        const lista = escribirPreparacionUnidad(nota, true);
        expect(leerPreparacionUnidad(lista)).to.deep.equal({ texto: nota, listo: true });
        const pendiente = escribirPreparacionUnidad(lista, false);
        expect(leerPreparacionUnidad(pendiente)).to.deep.equal({ texto: nota, listo: false });
        expect(leerPresentacionUnidad(pendiente)).to.equal("12 Onzas · Leche entera");
    });
    test("reúne las unidades listas sin modificar la orden ni las notas recibidas", function () {
        const orden = { idOrden: "o1", observacion: "Cliente: Ana\nEstado: En preparación" };
        const unidades = [{ idOrdenProducto: "u1", observaciones: "12 Onzas\nPreparación: Listo" },
            { idOrdenProducto: "u2", observaciones: "16 Onzas\nPreparación: Pendiente" }];
        const original = JSON.stringify([orden, unidades]);
        const resultado = ordenConPreparacion(orden, unidades);
        expect(resultado.listos).to.deep.equal(["u1"]);
        expect(resultado.estadoPreparacion).to.equal("EN_PREPARACION");
        expect(resultado.observacion).to.equal("Cliente: Ana");
        expect(JSON.stringify([orden, unidades])).to.equal(original);
    });
    test("preserva texto y referencia sin duplicar el bloque y rechaza datos dañados", function () {
        const texto = "Cliente: Ana · Pedido web referencia\nSin azúcar";
        const primero = escribirPreparacion(texto, { estado: "EN_PREPARACION", version: 1, listos: ["u1"] });
        const segundo = escribirPreparacion(primero, { estado: "DESPACHADA", version: 2, listos: ["u1"] });
        expect(leerPreparacion(segundo).texto).to.equal(texto);
        expect(segundo).to.equal(texto + "\nEstado: Despachada");
        expect(segundo).not.to.include(MARCA_PREPARACION);
        expect(leerPreparacion(null).estado).to.equal("PENDIENTE");
        expect(() => leerPreparacion(texto + MARCA_PREPARACION + "{incorrecto}")).to.throw();
    });

});
mocha.run();
