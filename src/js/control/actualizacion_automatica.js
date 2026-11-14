/** Programa consultas propias sin solaparlas ni mantenerlas activas fuera de la pantalla. */
export default class ActualizacionAutomatica {
    /**
     * Recibe una consulta y el intervalo de sondeo en milisegundos.
     * @param {function(): Promise<boolean|undefined>} consultar Consulta de la vista; falso indica ausencia de cambios.
     * @param {number} intervalo Tiempo inicial entre consultas completadas.
     */
    constructor(consultar, intervalo = 15000) {
        this.consultar = consultar;
        this.intervalo = intervalo;
        this.despertar = () => { if (!document.hidden) { this.espera = this.intervalo; this.ejecutar(); } };
    }

    /** Activa el sondeo y la sincronización al recuperar visibilidad o conexión. */
    iniciar() {
        this.detener();
        this.activa = true;
        this.espera = this.intervalo;
        document.addEventListener("visibilitychange", this.despertar);
        window.addEventListener("online", this.despertar);
        this.programar();
    }

    /** Espera después de terminar cada consulta, ampliando el descanso cuando no hay cambios. */
    programar() {
        clearTimeout(this.temporizador);
        this.temporizador = setTimeout(() => this.ejecutar(), this.espera);
    }

    /**
     * Consulta una sola vez; los fallos amplían la espera y se reintentan en el siguiente ciclo.
     * La vista conserva la responsabilidad de presentar sus errores; el planificador evita rechazos sin manejar.
     * @returns {Promise<void>} Finaliza después de consultar o descartar un ciclo inactivo.
     */
    async ejecutar() {
        if (!this.activa || this.ocupada || document.hidden || navigator.onLine === false) return;
        clearTimeout(this.temporizador);
        this.ocupada = true;
        try {
            const cambio = await this.consultar();
            this.espera = cambio === false ? Math.min(this.intervalo * 3, this.espera * 1.5) : this.intervalo;
        } catch { this.espera = Math.min(this.intervalo * 3, this.espera * 1.5); }
        finally { this.ocupada = false; if (this.activa) this.programar(); }
    }

    /** Libera temporizador y eventos al retirar el Web Component. */
    detener() {
        this.activa = false;
        clearTimeout(this.temporizador);
        document.removeEventListener("visibilitychange", this.despertar);
        window.removeEventListener("online", this.despertar);
    }
}
