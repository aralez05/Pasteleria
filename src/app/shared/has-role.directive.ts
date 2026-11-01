import { Directive, Input, TemplateRef, ViewContainerRef, effect, inject, signal } from '@angular/core';
import { FacturacionService } from '../Facturacion/facturacion.service';

/**
 * Muestra el contenido solo si el rol del usuario está en la lista.
 * Si no hay sesión iniciada, el rol es 'visitante'.
 *
 * Ejemplos:
 *   <div *hasRole="'admin'">...</div>
 *   <div *hasRole="['cliente', 'visitante']">...</div>
 */
@Directive({
    selector: '[hasRole]',
    standalone: true,
})
export class HasRoleDirective {
    private readonly plantilla = inject(TemplateRef<unknown>);
    private readonly contenedor = inject(ViewContainerRef);
    private readonly facturacionService = inject(FacturacionService);

    private readonly rolesPermitidos = signal<string[]>([]);
    private visible = false;

    @Input() set hasRole(valor: string | string[]) {
        this.rolesPermitidos.set(Array.isArray(valor) ? valor : [valor]);
    }

    constructor() {
        effect(() => {
            const rol = this.facturacionService.usuarioActual()?.rol ?? 'visitante';
            const permitido = this.rolesPermitidos().includes(rol);

            if (permitido && !this.visible) {
                this.contenedor.createEmbeddedView(this.plantilla);
                this.visible = true;
            } else if (!permitido && this.visible) {
                this.contenedor.clear();
                this.visible = false;
            }
        });
    }
}