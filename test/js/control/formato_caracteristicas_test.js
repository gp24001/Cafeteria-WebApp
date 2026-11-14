import { expect } from "../../lib/chai/index.js";
import { limpiarEspecificaciones, etiquetaCaracteristica } from "../../../src/js/control/formato_caracteristicas.js";

mocha.setup("tdd");
suite("Formato de características: Unidad", function () {
    test("muestra el nombre de la opción sin sus valores de relleno y conserva las medidas", function () {
        for (const valor of ["1", ".", "-", ""]) expect(etiquetaCaracteristica("Leche entera", valor)).to.equal("Leche entera");
        expect(etiquetaCaracteristica("Onzas", "12", { medida: true })).to.equal("12 Onzas");
        expect(etiquetaCaracteristica("Leche", "avena")).to.equal("Leche: avena");
    });
    test("limpia especificaciones guardadas conservando medidas y valores informativos", function () {
        const original = "1 Porcion · Leche Entera: - · 1 Pan blanco · Pan de masa madre: . · 1 Sin Azucar · 12 Onzas · 2 Porciones · Leche: avena";
        expect(limpiarEspecificaciones(original)).to.equal("1 Porcion · Leche Entera · Pan blanco · Pan de masa madre · Sin Azucar · 12 Onzas · 2 Porciones · Leche: avena");
        expect(limpiarEspecificaciones(original, { omitirPorcionUnitaria: true }))
            .to.equal("Leche Entera · Pan blanco · Pan de masa madre · Sin Azucar · 12 Onzas · 2 Porciones · Leche: avena");
        expect(limpiarEspecificaciones("Porción: 1 · 1 ml · 1 g · 1 oz", { omitirPorcionUnitaria: true })).to.equal("1 ml · 1 g · 1 oz");
        expect(limpiarEspecificaciones("1 Leche: avena · Leche Entera: 1")).to.equal("1 Leche: avena · Leche Entera");
        expect(limpiarEspecificaciones(undefined)).to.equal("");
    });

});
mocha.run();
