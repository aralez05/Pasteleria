import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

// Importa la directiva reutilizable desde shared
import { HasRoleDirective } from '../shared/has-role.directive';

// Importa los componentes de las subcarpetas
import { Admin } from './admin/admin';
import { Cliente } from './cliente/cliente';
import { Trabajador } from './trabajador/trabajador';

@Component({
    selector: 'app-facturacion',
    standalone: true,
    imports: [CommonModule, HasRoleDirective, Admin, Cliente, Trabajador],
    templateUrl: './Facturacion.html'
})
export class FacturacionComponent { } 
