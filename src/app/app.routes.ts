import { Routes } from '@angular/router';
import { General } from './general/general';
import { Clientes } from './Catalogo/clientes/clientes';
import { Trabajadores } from './Catalogo/trabajadores/trabajadores';
import { Admins } from './Catalogo/admin/admin';
import { Cliente } from './Facturacion/cliente/cliente';
import { Trabajador } from './Facturacion/trabajador/trabajador';
import { Admin } from './Facturacion/admin/admin';
import { DisenaElTuyo } from './disena-el-tuyo/disena-el-tuyo';

import { InicioSesion } from './inicio-sesion/inicio-sesion';
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';


import { Clientes as PedidosCliente } from './Pedidos/cliente/cliente';
import { Trabajador as PedidosTrabajador } from './Pedidos/trabajador/trabajador';
import { Admin as PedidosAdmin } from './Pedidos/admin/admin';

export const routes: Routes = [
    { path: '', redirectTo: 'general', pathMatch: 'full' },
    { path: 'inicio', redirectTo: 'general', pathMatch: 'full' },
    { path: 'general', component: General },
    {
        path: 'catalogo',
        loadComponent: () => import('./Catalogo/Catalogo').then(m => m.Catalogo)
    }, { path: 'disena-tuyo', component: DisenaElTuyo },
    { path: 'disena-el-tuyo', redirectTo: 'disena-tuyo', pathMatch: 'full' },
    { path: 'facturacion', redirectTo: 'facturacion/cliente', pathMatch: 'full' },
    { path: 'facturacion/cliente', component: Cliente },
    { path: 'facturacion/trabajador', component: Trabajador },
    { path: 'facturacion/admin', component: Admin },
    {
        path: 'sucursales',
        loadComponent: () => import('./Sucursales/Sucursales').then(m => m.Sucursales)
    }, { path: 'pedidos', redirectTo: 'pedidos/cliente', pathMatch: 'full' },
    { path: 'mis-pedidos', redirectTo: 'pedidos/cliente', pathMatch: 'full' },
    { path: 'pedidos/cliente', component: PedidosCliente },
    { path: 'pedidos/trabajador', component: PedidosTrabajador },
    { path: 'pedidos/admin', component: PedidosAdmin },
    { path: 'login', component: InicioSesion },
    { path: 'inicio-sesion', redirectTo: 'login', pathMatch: 'full' },
];
