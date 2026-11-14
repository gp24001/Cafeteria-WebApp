import { expect } from "../../lib/chai/index.js";
import DefaultError from "../../../src/js/entity/default_error.js";
import ProductoDao from "../../../src/js/control/producto_dao.js";

mocha.setup("tdd");
suite("DefaultError: integración con la API", function () {
    this.timeout(10000);

    test("preserva el rechazo HTTP y los parámetros inválidos de una lectura real", async function () {
        const fallo = await new ProductoDao().findRange(0, 0).catch(error => error);
        expect(fallo).to.be.instanceOf(DefaultError);
        expect(fallo.error.status).to.equal(422);
        expect(fallo.error.headers.get("Wrong-Param")).to.equal("min,max");
        expect(fallo.mensaje).to.equal("Error al obtener los datos: 422");
    });
});
mocha.run();
