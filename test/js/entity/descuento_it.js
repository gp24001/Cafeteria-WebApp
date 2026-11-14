import { expect } from "../../lib/chai/index.js";
import Descuento from "../../../src/js/entity/descuento.js";
import TipoDescuento from "../../../src/js/entity/tipo_descuento.js";
import DescuentoDao from "../../../src/js/control/descuento_dao.js";
import { buscarRegistro, leerConOriginal } from "./integracion_entidades.js";

mocha.setup("tdd");
suite("Descuento: integración con la API", function () {
    this.timeout(30000);

    test("recupera un registro real con sus relaciones tipadas y sin perder valores del JSON", async function () {
        const encontrado = await buscarRegistro(new DescuentoDao());
        if (!encontrado) {
            this.test.title += " (pendiente: no existen registros de Descuento)";
            this.skip();
            return;
        }
        const id = encontrado.registro.idDescuento;
        expect(id).to.be.a("string").and.not.be.empty;
        const { entidad, original } = await leerConOriginal(encontrado.dao, id);
        expect(entidad).to.be.instanceOf(Descuento);
        expect(entidad.idDescuento).to.equal(id);
        for (const [ruta, Tipo] of [["idTipoDescuento", TipoDescuento]]) {
            const relacionado = ruta.split(".").reduce((valor, campo) => valor?.[campo], entidad);
            if (relacionado != null) expect(relacionado, ruta).to.be.instanceOf(Tipo);
        }
        expect(JSON.stringify(entidad)).to.equal(JSON.stringify(original));
    });
});
mocha.run();
