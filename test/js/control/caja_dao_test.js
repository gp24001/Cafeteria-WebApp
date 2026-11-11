import * as chai from "../../lib/chai/index.js";
import CajaDao from "../../../src/js/control/caja_dao.js";
import sinon from "../../lib/sinon/sinon-esm.js";
mocha.setup("tdd");
var stubFetch;
suite("CajaDao",function(){
    setup(() => {
        stubFetch=sinon.stub(window,'fetch').resolves(new Response(JSON.stringify([{
        "idCaja": "8d4be86b-0c6c-49ad-8052-62bc05cc8624",
        "nombre": "Caja 1",
        "activo": true,
        "observaciones": ""
    },
    {
        "idCaja": "06b4ccf1-c8e9-4cc7-9650-c96dcc3aa70b",
        "nombre": "Caja 2",
        "activo": false,
        "observaciones": ""
    }]
),{status:200,headers:{"Total-registros":2}})
);
    });
    teardown(() => {
        stubFetch.restore();
    });

    test("CajaDao deberia retornar un DefaultResponse con los dtos correctos ",function(done){
        let servicio=new CajaDao();
        servicio.findRange(0,10).then(respuesta=>{
            chai.expect(respuesta).to.be.an.instanceOf(Object);
            chai.expect(respuesta.datos).to.be.an('array').that.has.lengthOf(2);
            chai.expect(respuesta.totalDatos).to.equal('2');
            done();

        }).catch(err=>{
done(err);
        })
    }) /*no tiene sentido ponerlo en español, oslo era de ejemplo, normalmete se usa should referente a una clas e de pseudolenguaje*/
});

mocha.run();
