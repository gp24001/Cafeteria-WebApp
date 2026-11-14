import { expect } from "../../lib/chai/index.js";
import { crearIndice, buscarEnIndice } from "../../../src/js/control/filtro_catalogo.js";

mocha.setup("tdd");
suite("Filtro del catálogo: Unidad", function () {
    const productos = [{ nombre: "Café Latte", comentarios: "Con leche deslactosada" }, { nombre: "Té frío", comentarios: "Con limón" }, { nombre: "Pan integral", comentarios: "Con semillas" }];
    test("el filtro encuentra todas las palabras en nombre y descripción sin cambiar los registros", function () {
        const originales = JSON.stringify(productos);
        const indice = crearIndice(productos);
        expect(buscarEnIndice(indice, "  CAFE   deslactosada ")).to.deep.equal([0]);
        expect(buscarEnIndice(indice, "frio limon")).to.deep.equal([1]);
        expect(buscarEnIndice(indice, "cafe semillas")).to.deep.equal([]);
        expect(buscarEnIndice(indice, " ")).to.deep.equal([0, 1, 2]);
        expect(JSON.stringify(productos)).to.equal(originales);
    });

});
mocha.run();
