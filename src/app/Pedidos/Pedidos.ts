import { Component } from '@angular/core';
import { HasRoleDirective } from '../shared/has-role.directive';

// Pantallas de cada rol (carpetas admin, cliente y trabajador dentro de Pedidos)
import { Admin } from './admin/admin';
import { Clientes } from './cliente/cliente';
import { Trabajador } from './trabajador/trabajador';

@Component({
    selector: 'app-pedidos',
    standalone: true,
    imports: [HasRoleDirective, Admin, Clientes, Trabajador],
    templateUrl: './Pedidos.html'
})
export class Pedidos { }
