import { Component } from '@angular/core';
import { HasRoleDirective } from '../shared/has-role.directive';

// Importa los componentes de las subcarpetas de sucursales
import { AdminSucur } from './AdminSucur/admin-sucur';
import { ClienteSucur } from './ClienteSucur/cliente-sucur';
import { TrabajadorSucur } from './TrabajadorSucur/trabajador-sucur';

@Component({
    selector: 'app-sucursales',
    standalone: true,
    imports: [HasRoleDirective, AdminSucur, ClienteSucur, TrabajadorSucur],
    templateUrl: './Sucursales.html'
})
export class Sucursales { }
